// 카드뉴스 흐름 (가짜 공급자 + 실제 브라우저로 그리기): 표지 후보 → 본문 → 저장 / 넘치면 직접 줄여서 저장
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { AiService } from '../ai/adapter.ts';
import { getSetting, setSetting } from '../config.ts';
import { FakeProvider, type FakeStep } from '../ai/testing/fake-provider.ts';
import { closeBrowser } from '../render/browser.ts';
import { finishWithEdits, generateBody, type BodyOutput } from './body.ts';
import { generateCovers } from './covers.ts';
import { getSet, rendersDir } from './store.ts';
import { checkGloss, editGloss, uncheckedGlosses } from './gloss-check.ts';
import { addTestSource, seedBrand } from './testing/setup.ts';

afterAll(() => closeBrowser());

// AI 생성 예시 소재 — 가상의 앱
const SOURCE =
  '노트 정리 앱 모아 1.2 버전을 써 봤다. 태그를 붙이면 노트가 자동으로 묶인다. 검색창에 날짜를 쓰면 그날 노트만 보인다. 공유 링크는 7일 뒤 사라진다. 무료 요금제는 노트 500개까지다. 내보내기는 마크다운 파일로만 된다.';
const PILLAR = '1a73b8075a69b404';
const noIssues: FakeStep = { structured: { issues: [] } };
const t = (headline: string, sub: string | null = null) => ({ headline, sub, pillar_id: PILLAR, why: '이유' });

const card = (title: string, text: string, evidence: string, image: { prompt: string; filename: string } | null = null) => ({ title, text, evidence, image, glosses: [] as Array<{ sentence: string; term: string }> }); // card_body v2 부터 풀이 표시 칸 필수
const BODY: BodyOutput = {
  cards: [
    card('태그로 묶기', '태그만 붙이면 노트가 **자동으로** 묶여요.', '태그를 붙이면 노트가 자동으로 묶인다.', {
      prompt: 'Flat illustration of colorful tag labels grouping paper notes, 4:5, 1080x1350, no text, no people',
      filename: 'card-02-tags.png',
    }),
    card('날짜로 찾기', '검색창에 날짜를 쓰면 그날 노트만 보여요.', '검색창에 날짜를 쓰면 그날 노트만 보인다.'),
    card('공유 링크', '공유 링크는 7일 뒤 사라져요.', '공유 링크는 7일 뒤 사라진다.'),
    card('무료 한도', '무료 요금제는 노트 500개까지예요.', '무료 요금제는 노트 500개까지다.'),
    card('내보내기', '내보내기는 마크다운 파일로만 돼요.', '내보내기는 마크다운 파일로만 된다.'),
  ],
  closing: { headline: '저장해 두고\n하나씩 써 보세요', sub: null },
};
const cover = { headline: '모아 써 보니\n**달라진 5가지**', sub: null, pillarId: PILLAR, chip: '직접 써 본 새 도구' };

async function setup(steps: FakeStep[]) {
  const s = await seedBrand('me', 'real', 'A');
  const sourceId = addTestSource(s.db, SOURCE);
  const provider = new FakeProvider(steps);
  return { ...s, sourceId, provider, ai: new AiService({ db: s.db, provider }) };
}

describe('표지 제목 후보 (FR-MK-1)', () => {
  it('8개 중 규칙에 걸린 2개(원문 밖 숫자·개수 불일치)를 빼고 6개를 고정 틀로 그려 보인다', async () => {
    const titles = [
      t('모아 써 보니\n**달라진 5가지**'),
      t('태그만 붙이면\n노트가 묶여요'),
      t('무료로 노트\n1000개까지'), // 원문 밖 숫자
      t('모아 1.2 버전\n**5가지 정리**'),
      t('알아둘 세 가지'), // 개수 불일치 (정한 수 5)
      t('날짜만 쓰면\n그날 노트만'),
      t('공유 링크는\n7일 뒤 사라져요'),
      t('내보내기 전에\n알아둘 5가지'),
    ];
    const { ai, db, dataDir } = await setup([{ structured: { titles } }, noIssues]);
    const r = await generateCovers(ai, 1, 1, 5, undefined, dataDir);
    expect(r.candidates.map((c) => c.index)).toEqual([0, 1, 3, 5, 6, 7]);
    expect(r.candidates.every((c) => c.png.startsWith('data:image/png;base64,'))).toBe(true);
    expect(r.dropped.map((d) => d.reasons[0]?.split(']')[0])).toEqual(['[number_not_in_source', '[count_mismatch']);
    expect(r.rewrites).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS n FROM ai_runs WHERE task = 'self_review'").get()).toEqual({ n: 1 });
  }, 60_000);
});

describe('본문 카드 (FR-MK-1·2·8)', () => {
  it('규칙·렌더링·자기 평가를 통과하면 세트와 PNG 를 저장한다 — 표지 1 + 본문 5 + 마무리 1', async () => {
    const { ai, db, dataDir, sourceId } = await setup([{ structured: BODY }, noIssues]);
    const r = await generateBody(ai, 1, { sourceId, cover, requested: null, coverJobId: null }, undefined, dataDir);
    expect(r).toMatchObject({ status: 'saved', rewrites: 0 });
    const set = getSet(db, (r as { setId: number }).setId)!;
    expect(set.cards.map((c) => c.kind)).toEqual(['cover', 'body', 'body', 'body', 'body', 'body', 'closing']);
    expect(set.cards[1]!.image?.filename).toBe('card-02-tags.png');
    expect(set.cards.every((c) => fs.existsSync(path.join(rendersDir(dataDir, set.id), c.pngFile)))).toBe(true);
    expect(set.cards[0]!.render.reference).toBe(true);
  }, 60_000);

  it('표지 「5가지」인데 본문 4장이면 개수 불일치로 다시 쓴다', async () => {
    const four = { ...BODY, cards: BODY.cards.slice(0, 4) };
    const { ai, dataDir, sourceId, provider } = await setup([{ structured: four }, { structured: BODY }, noIssues]);
    const r = await generateBody(ai, 1, { sourceId, cover, requested: null, coverJobId: null }, undefined, dataDir);
    expect(r).toMatchObject({ status: 'saved', rewrites: 1 });
    expect(provider.calls[1]!.prompt).toContain('[count_mismatch]');
  }, 60_000);

  it('근거 인용이 원문에 없거나, 원문 밖 숫자·사람 그림이면 다시 쓴다 (me 는 캐릭터 계정이라 사람 대신 캐릭터)', async () => {
    const bad = structuredClone(BODY);
    bad.cards[0]!.evidence = '태그를 쓰면 정리가 빨라진다.';
    bad.cards[1]!.text = '검색이 3배 빨라졌어요.'; // 3 은 쪽 번호와 같지만 쪽 번호는 구조 숫자가 아니다 — 걸려야 한다
    bad.cards[2]!.image = { prompt: 'A smiling woman holding a phone, 4:5, 1080x1350, no text', filename: 'card-04-share.png' };
    const { ai, dataDir, sourceId, provider } = await setup([{ structured: bad }, { structured: BODY }, noIssues]);
    await generateBody(ai, 1, { sourceId, cover, requested: null, coverJobId: null }, undefined, dataDir);
    const p = provider.calls[1]!.prompt;
    expect(p).toContain('[quote_not_in_source]');
    expect(p).toContain('[number_not_in_source]');
    expect(p).toContain('[prompt_person_not_character]'); // me 의 「보여 주는 방식」: 캐릭터(ZUN) — 결정 2026-10-15
  }, 60_000);

  it('card_body v2: 소재 밖 풀이 문장 표시를 세트와 함께 저장하고, 소재에 없는 용어를 풀이하면 다시 쓴다 (결정 2026-10-15)', async () => {
    const withGloss = structuredClone(BODY);
    withGloss.cards = withGloss.cards.map((c) => ({ ...c, glosses: [] }));
    withGloss.cards[0]!.text = '태그만 붙이면 노트가 **자동으로** 묶여요. 태그는 노트에 다는 이름표예요.';
    withGloss.cards[0]!.glosses = [{ sentence: '태그는 노트에 다는 이름표예요.', term: '태그' }];
    const badTerm = structuredClone(withGloss);
    badTerm.cards[4]!.text = '내보내기는 마크다운 파일로만 돼요. PDF는 모양이 고정된 문서예요.';
    badTerm.cards[4]!.glosses = [{ sentence: 'PDF는 모양이 고정된 문서예요.', term: 'PDF' }]; // 소재에 없는 용어
    const { ai, db, dataDir, sourceId, provider } = await setup([{ structured: badTerm }, { structured: withGloss }, noIssues]);
    setSetting(db, 'prompts.activeVersions', { ...getSetting(db, 'prompts.activeVersions'), card_body: 'v2', card_body_review: 'v3' });
    const r = await generateBody(ai, 1, { sourceId, cover, requested: null, coverJobId: null }, undefined, dataDir);
    expect(r).toMatchObject({ status: 'saved', rewrites: 1 });
    expect(provider.calls[1]!.prompt).toContain('[gloss_term_not_in_source]');
    const set = getSet(db, (r as { setId: number }).setId)!;
    expect(set.cards[1]!.glosses).toEqual([{ sentence: '태그는 노트에 다는 이름표예요.', term: '태그' }]);
    expect(set.cards[2]!.glosses).toEqual([]);
  }, 60_000);

  it('표시된 풀이: 확인 체크는 저장되고, 직접 고치면 그 카드만 다시 그린다 — 넘치면 저장하지 않는다 (결정 2026-10-18)', async () => {
    const withGloss = structuredClone(BODY);
    withGloss.cards = withGloss.cards.map((c) => ({ ...c, glosses: [] }));
    withGloss.cards[0]!.text = '태그만 붙이면 노트가 **자동으로** 묶여요. 태그는 노트에 다는 이름표예요.';
    withGloss.cards[0]!.glosses = [{ sentence: '태그는 노트에 다는 이름표예요.', term: '태그' }];
    withGloss.cards[4]!.text = '내보내기는 마크다운 파일로만 돼요. 마크다운은 기호로 서식을 적는 글 파일이에요.';
    withGloss.cards[4]!.glosses = [{ sentence: '마크다운은 기호로 서식을 적는 글 파일이에요.', term: '마크다운' }];
    const { ai, db, dataDir, sourceId } = await setup([{ structured: withGloss }, noIssues]);
    setSetting(db, 'prompts.activeVersions', { ...getSetting(db, 'prompts.activeVersions'), card_body: 'v2', card_body_review: 'v3' });
    const r = await generateBody(ai, 1, { sourceId, cover, requested: null, coverJobId: null }, undefined, dataDir);
    const setId = (r as { setId: number }).setId;
    expect(uncheckedGlosses(getSet(db, setId)!).length).toBe(2);

    checkGloss(db, setId, 1, '태그는 노트에 다는 이름표예요.', true);
    expect(getSet(db, setId)!.cards[1]!.glosses![0]!.checkedAt).toMatch(/^\d{4}-/); // 다시 읽어도 유지
    expect(uncheckedGlosses(getSet(db, setId)!).map((u) => u.idx)).toEqual([5]);

    const pngBefore = fs.readFileSync(path.join(rendersDir(dataDir, setId), '06-body.png'));
    const tooLong = await editGloss(db, dataDir, setId, 5, '마크다운은 기호로 서식을 적는 글 파일이에요.', '아주 긴 문장을 계속 이어서 씁니다. '.repeat(40));
    expect(tooLong.ok).toBe(false);
    expect(getSet(db, setId)!.cards[5]!.glosses!.length).toBe(1); // 넘치면 아무것도 바꾸지 않는다

    const fixed = await editGloss(db, dataDir, setId, 5, '마크다운은 기호로 서식을 적는 글 파일이에요.', '마크다운은 제목·목록을 기호로 적는 글이에요.');
    expect(fixed).toEqual({ ok: true });
    const card = getSet(db, setId)!.cards[5]!;
    expect((card.content as { text: string }).text).toBe('내보내기는 마크다운 파일로만 돼요. 마크다운은 제목·목록을 기호로 적는 글이에요.');
    expect(card.glosses).toEqual([]); // 고친 문장은 사용자 글이라 표시에서 빠진다
    expect(card.edited).toBe(true);
    expect(fs.readFileSync(path.join(rendersDir(dataDir, setId), '06-body.png')).equals(pngBefore)).toBe(false);
    expect(uncheckedGlosses(getSet(db, setId)!)).toEqual([]);
  }, 60_000);

  it('2회 재작성 뒤에도 넘치면 버리지 않고 어느 카드가 넘쳤는지 돌려준다 → 사용자가 줄이면 저장 (그 전엔 저장 안 함)', async () => {
    const long = structuredClone(BODY);
    long.cards[2]!.text = '공유 링크는 7일 뒤 사라져요. '.repeat(30); // 스키마 상한(600자) 안, 템플릿 본문 칸(약 300자)은 넘게
    const { ai, db, dataDir, sourceId } = await setup([{ structured: long }, { structured: long }, { structured: long }]);
    const input = { sourceId, cover, requested: null, coverJobId: null };
    const r = await generateBody(ai, 1, input, undefined, dataDir);
    expect(r.status).toBe('needs_edit');
    if (r.status !== 'needs_edit') return;
    expect(r.overflows.map((o) => o.where)).toEqual(['cards.2.text']);
    expect(r.overflows[0]!.message).toMatch(/약 \d+자 줄이세요/);
    expect(db.prepare('SELECT COUNT(*) AS n FROM card_sets').get()).toEqual({ n: 0 });

    const fixed = await finishWithEdits(ai, 1, input, r.draft, [{ where: 'cards.2', text: '공유 링크는 7일 뒤 사라져요.' }], null, dataDir);
    expect(fixed.status).toBe('saved');
    const set = getSet(db, (fixed as { setId: number }).setId)!;
    expect(set.edited).toBe(true);
    expect(set.cards.filter((c) => c.edited).map((c) => c.idx)).toEqual([3]);
  }, 90_000);
});
