// 업로드 준비 (FR-PB-1 · 결정 2026-10-18): 가짜 공급자로 세트를 만들고(실제 브라우저로 그림) 업로드 폴더·캡션을 확인
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider, type FakeStep } from '../ai/testing/fake-provider.ts';
import { getSetting, setSetting } from '../config.ts';
import { closeBrowser } from '../render/browser.ts';
import { generateBody, type BodyOutput } from '../cards/body.ts';
import { checkGloss } from '../cards/gloss-check.ts';
import { addTestSource, seedBrand } from '../cards/testing/setup.ts';
import { generateCaption } from './caption.ts';
import { ExportError, exportSet } from './export.ts';
import { getCaption } from './store.ts';

afterAll(() => closeBrowser());

const SOURCE = '노트 정리 앱 모아 1.2 버전을 써 봤다. 태그를 붙이면 노트가 자동으로 묶인다. 검색창에 날짜를 쓰면 그날 노트만 보인다. 공유 링크는 7일 뒤 사라진다.';
const noIssues: FakeStep = { structured: { issues: [] } };
const BODY: BodyOutput = {
  cards: [
    // 표지 「모아 1.2」의 1.2 를 본문이 지킨다(결정 2026-10-18 · A 표지 약속 규칙)
    { title: '태그로 묶기', text: '모아 1.2에서는 태그만 붙이면 노트가 묶여요. 태그는 노트에 다는 이름표예요.', evidence: '태그를 붙이면 노트가 자동으로 묶인다.', image: { prompt: 'Flat illustration of tag labels on notes, 4:5, 1080x1350, no text, no people', filename: 'card-02-tags.png' }, glosses: [{ sentence: '태그는 노트에 다는 이름표예요.', term: '태그' }] },
    { title: '날짜로 찾기', text: '검색창에 날짜를 쓰면 그날 노트만 보여요.', evidence: '검색창에 날짜를 쓰면 그날 노트만 보인다.', image: null, glosses: [] },
    { title: '공유 링크', text: '공유 링크는 7일 뒤 사라져요.', evidence: '공유 링크는 7일 뒤 사라진다.', image: null, glosses: [] },
  ],
  closing: { headline: '저장해 두고\n하나씩 써 보세요', sub: null },
};
const cover = { headline: '모아 1.2\n**써 본 메모**', sub: null, pillarId: null, chip: null };

async function makeSet(extra: FakeStep[] = []) {
  const s = await seedBrand('me', 'real', 'A');
  const sourceId = addTestSource(s.db, SOURCE);
  const provider = new FakeProvider([{ structured: BODY }, noIssues, ...extra]);
  const ai = new AiService({ db: s.db, provider });
  const r = await generateBody(ai, 1, { sourceId, cover, requested: null, coverJobId: null }, undefined, s.dataDir);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-upload-'));
  setSetting(s.db, 'publish.uploadRoot', root);
  return { ...s, ai, provider, setId: (r as { setId: number }).setId, root };
}

describe('업로드 폴더 (수용 기준: 업로드 창에서 전체 선택하면 순서가 맞는다)', () => {
  it('확인하지 않은 풀이가 있으면 만들지 않는다 → 확인하면 업로드/ 에 그림만 두 자리 번호로, 수정 시각도 카드 순서대로', async () => {
    const { db, dataDir, setId, root } = await makeSet();
    expect(() => exportSet(db, dataDir, setId)).toThrow(ExportError);
    expect(fs.readdirSync(root)).toEqual([]); // 막혔을 때 아무것도 안 만든다
    checkGloss(db, setId, 1, '태그는 노트에 다는 이름표예요.', true);
    const r = exportSet(db, dataDir, setId);
    expect(path.dirname(r.dir)).toBe(root);
    expect(path.basename(r.dir)).toMatch(/^\d{4}-\d{2}-\d{2}_모아-1\.2-써-본-메모$/);
    const up = fs.readdirSync(path.join(r.dir, '업로드'));
    expect(up).toEqual(['01_cover.png', '02_body.png', '03_body.png', '04_body.png', '05_closing.png']); // 표지 + 본문 3 + 마무리, 그림만
    expect([...up].sort()).toEqual(up); // 이름순 = 카드 순서
    // 시간순 = 카드 순서 (결정 2026-10-18: 휴대폰 사진 앱은 이름이 아니라 시간으로 정렬할 수 있다)
    const byTime = [...up].sort((a, b) => fs.statSync(path.join(r.dir, '업로드', a)).mtimeMs - fs.statSync(path.join(r.dir, '업로드', b)).mtimeMs);
    expect(byTime).toEqual(up);
    const mtimes = up.map((f) => fs.statSync(path.join(r.dir, '업로드', f)).mtimeMs);
    expect(mtimes.every((t, i) => i === 0 || t - mtimes[i - 1]! >= 1000)).toBe(true); // 1초씩
    expect(fs.readFileSync(path.join(r.dir, '그림-프롬프트.txt'), 'utf8')).toContain('02번 카드 · card-02-tags.png');
    expect(fs.readFileSync(path.join(r.dir, '확인한-설명.txt'), 'utf8')).toContain('태그는 노트에 다는 이름표예요.');
    // 다시 만들면 덮어쓰지 않고 -2
    const again = exportSet(db, dataDir, setId);
    expect(path.basename(again.dir)).toBe(`${path.basename(r.dir)}-2`);
    expect(fs.readdirSync(root).length).toBe(2);
  }, 60_000);

  it('캐러셀 최대 장수를 넘는 세트는 만들지 않는다 (확인됨: 인스타 도움말 20장 — 설정값을 줄여 재현)', async () => {
    const { db, dataDir, setId, root } = await makeSet();
    checkGloss(db, setId, 1, '태그는 노트에 다는 이름표예요.', true);
    setSetting(db, 'publish.maxCarousel', 4); // 이 세트는 5장
    expect(() => exportSet(db, dataDir, setId)).toThrow(/캐러셀 최대 4장/);
    expect(fs.readdirSync(root)).toEqual([]);
  }, 60_000);
});

describe('최소 캡션 (근거·풀이 규칙은 카드와 같게, 해시태그는 코드가 자른다)', () => {
  it('원문 밖 숫자는 다시 쓰고, 해시태그는 상한까지 자른다 → 캡션.txt 로 폴더에', async () => {
    const bad = { hook: '모아 1.2 써 보니 3배 빨라요', lines: ['태그만 붙이면 노트가 묶여요'], hashtags: ['#모아'], glosses: [] };
    const good = { hook: '모아 1.2, 태그 하나로 정리 끝', lines: ['태그만 붙이면 노트가 묶여요', '공유 링크는 7일 뒤 사라져요'], hashtags: ['#모아', '#노트앱', '#노트정리', '#태그', '#생산성', '#메모앱', '#기록'], glosses: [] };
    const { db, dataDir, setId, ai, provider } = await makeSet([{ structured: bad }, { structured: good }, noIssues]);
    const r = await generateCaption(ai, 1, setId, undefined, dataDir);
    expect(r).toMatchObject({ status: 'saved', rewrites: 1, cutHashtags: ['#메모앱', '#기록'] });
    expect(provider.calls[3]!.prompt).toContain('[number_not_in_source]');
    const cap = getCaption(db, setId)!;
    expect(cap.hashtags.length).toBe(getSetting(db, 'publish.maxHashtags'));
    checkGloss(db, setId, 1, '태그는 노트에 다는 이름표예요.', true);
    const out = exportSet(db, dataDir, setId);
    expect(fs.readFileSync(path.join(out.dir, '캡션.txt'), 'utf8')).toBe('모아 1.2, 태그 하나로 정리 끝\n\n태그만 붙이면 노트가 묶여요\n공유 링크는 7일 뒤 사라져요\n\n#모아 #노트앱 #노트정리 #태그 #생산성\n');
  }, 60_000);
});
