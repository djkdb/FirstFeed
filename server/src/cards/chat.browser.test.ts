// 채팅으로 고치기 (FR-MK-3 · 가짜 공급자 + 실제 브라우저로 그리기): 제안 → 적용 → 되돌리기, 범위 밖 카드 · 지어낸 숫자 막기
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider, type FakeStep } from '../ai/testing/fake-provider.ts';
import { closeBrowser } from '../render/browser.ts';
import { generateBody, type BodyOutput } from './body.ts';
import { applyChat, ChatError, discardChat, listChat, proposeChat, revertChat } from './chat.ts';
import { getSet, rendersDir } from './store.ts';
import { addTestSource, seedBrand } from './testing/setup.ts';

afterAll(() => closeBrowser());

// AI 생성 예시 소재 — 가상의 앱 (cards.browser.test.ts 와 같은 것)
const SOURCE =
  '노트 정리 앱 모아 1.2 버전을 써 봤다. 태그를 붙이면 노트가 자동으로 묶인다. 검색창에 날짜를 쓰면 그날 노트만 보인다. 공유 링크는 7일 뒤 사라진다. 무료 요금제는 노트 500개까지다. 내보내기는 마크다운 파일로만 된다.';
const PILLAR = '1a73b8075a69b404';
const noIssues: FakeStep = { structured: { issues: [] } };
const card = (title: string, text: string, evidence: string) => ({ title, text, evidence, image: null, glosses: [] as Array<{ sentence: string; term: string }> });
const BODY: BodyOutput = {
  cards: [
    card('태그로 묶기', '태그만 붙이면 노트가 **자동으로** 묶여요.', '태그를 붙이면 노트가 자동으로 묶인다.'),
    card('날짜로 찾기', '검색창에 날짜를 쓰면 그날 노트만 보여요.', '검색창에 날짜를 쓰면 그날 노트만 보인다.'),
    card('공유 링크', '공유 링크는 7일 뒤 사라져요.', '공유 링크는 7일 뒤 사라진다.'),
  ],
  closing: { headline: '저장해 두고\n하나씩 써 보세요', sub: null },
};
const cover = { headline: '모아 써 보니\n편해진 것', sub: null, pillarId: PILLAR, chip: '직접 써 본 새 도구' };
/** 본문 2번째 카드(세트의 3번 카드)를 고친 제안 */
const change = (where: string, text: string, extra: Record<string, unknown> = {}) => ({
  where,
  headline: null,
  sub: null,
  title: '날짜만 쓰면 끝',
  text,
  evidence: '검색창에 날짜를 쓰면 그날 노트만 보인다.',
  glosses: [],
  ...extra,
});

async function setup(chatSteps: FakeStep[]) {
  const s = await seedBrand('me', 'real', 'A');
  const sourceId = addTestSource(s.db, SOURCE);
  const provider = new FakeProvider([{ structured: BODY }, noIssues, ...chatSteps]);
  const ai = new AiService({ db: s.db, provider });
  const r = await generateBody(ai, 1, { sourceId, cover, requested: null, coverJobId: null }, undefined, s.dataDir);
  if (r.status !== 'saved') throw new Error(`세트 준비 실패: ${r.status}`);
  return { ...s, ai, setId: r.setId };
}
const pngOf = (dataDir: string, setId: number, file: string) => fs.readFileSync(path.join(rendersDir(dataDir, setId), file));

describe('채팅으로 고치기 (FR-MK-3)', () => {
  it('지시한 카드만 제안하고(세트는 그대로) → 적용하면 그 카드 글 · PNG 만 바뀌고 → 되돌리면 원래대로', async () => {
    const { ai, db, dataDir, setId } = await setup([{ structured: { changes: [change('cards.1', '날짜를 쓰면 **그날 노트만** 보여요.')], reply: '설명조를 줄였어요.' } }, noIssues]);
    const before = getSet(db, setId)!;
    const png3 = pngOf(dataDir, setId, before.cards[2]!.pngFile);
    const png2 = pngOf(dataDir, setId, before.cards[1]!.pngFile);
    const r = await proposeChat(ai, 1, setId, '3번 카드 너무 설명조야', null, undefined, dataDir);
    expect(r.status).toBe('proposed');
    const [item] = listChat(db, setId);
    expect(item!.changes.map((c) => c.idx)).toEqual([2]);
    expect(getSet(db, setId)!.cards[2]!.content).toEqual(before.cards[2]!.content); // 적용 전엔 그대로

    applyChat(db, dataDir, setId, r.chatId);
    const after = getSet(db, setId)!;
    expect(after.cards[2]!.content).toMatchObject({ title: '날짜만 쓰면 끝', text: '날짜를 쓰면 **그날 노트만** 보여요.' });
    expect(pngOf(dataDir, setId, after.cards[2]!.pngFile).equals(png3)).toBe(false);
    expect(pngOf(dataDir, setId, after.cards[1]!.pngFile).equals(png2)).toBe(true); // 다른 카드는 그대로
    expect(after.cards[2]!.edited).toBe(false); // AI 가 고친 글 — 사람이 직접 고친 것으로 표시하지 않는다

    revertChat(db, dataDir, setId, r.chatId);
    expect(getSet(db, setId)!.cards[2]!.content).toEqual(before.cards[2]!.content);
    expect(pngOf(dataDir, setId, before.cards[2]!.pngFile).equals(png3)).toBe(true);
    expect(listChat(db, setId)[0]!.status).toBe('reverted');
  }, 90_000);

  it('지시에 없는 표지를 바꾸면 다시 쓰게 하고, 고쳐 온 제안만 받는다', async () => {
    const coverChange = { where: 'cover', headline: '모아로 바뀐\n노트 정리', sub: null, title: null, text: null, evidence: null, glosses: [] };
    const { ai, db, dataDir, setId } = await setup([
      { structured: { changes: [coverChange, change('cards.1', '날짜만 쓰면 그날 노트가 보여요.')], reply: '고쳤어요.' } },
      { structured: { changes: [change('cards.1', '날짜만 쓰면 그날 노트가 보여요.')], reply: '3번만 고쳤어요.' } },
      noIssues,
    ]);
    const r = await proposeChat(ai, 1, setId, '3번 카드 더 짧게', null, undefined, dataDir);
    expect(r.status).toBe('proposed');
    expect(listChat(db, setId)[0]!.changes.map((c) => c.idx)).toEqual([2]);
    const codes = db.prepare("SELECT issues_json FROM ai_runs WHERE task = 'card_chat' AND kind = 'generate'").get() as { issues_json: string };
    expect(codes.issues_json).toContain('chat_out_of_scope');
  }, 90_000);

  it('지시에 쓴 숫자는 통과(사용자가 직접 입력한 문장), 어디에도 없는 숫자는 끝까지 걸리면 제안을 만들지 않는다', async () => {
    const ok = await setup([{ structured: { changes: [change('cards.2', '공유 링크는 7일 뒤 사라져요. 11월 15일까지 써 보세요.', { title: '공유 링크', evidence: '공유 링크는 7일 뒤 사라진다.' })], reply: '마감을 넣었어요.' } }, noIssues]);
    expect((await proposeChat(ok.ai, 1, ok.setId, '4번 카드에 11월 15일까지 써 보라고 넣어줘', null, undefined, ok.dataDir)).status).toBe('proposed');

    const bad = { structured: { changes: [change('cards.2', '공유 링크는 30일 뒤 사라져요.', { title: '공유 링크', evidence: '공유 링크는 7일 뒤 사라진다.' })], reply: '고쳤어요.' } };
    const ng = await setup([bad, bad, bad]);
    const r = await proposeChat(ng.ai, 1, ng.setId, '4번 카드 다르게 써 줘', null, undefined, ng.dataDir);
    expect(r.status).toBe('failed');
    expect(listChat(ng.db, ng.setId)[0]!.error).toContain('30');
  }, 120_000);

  it('제안 뒤에 세트가 바뀌었으면 옛 제안은 적용하지 않는다 · 버린 제안은 다시 적용 못 한다 · 되돌리기는 최근 것부터', async () => {
    const p1 = { structured: { changes: [change('cards.1', '날짜를 쓰면 그날 노트만 보여요!')], reply: 'a' } };
    const p2 = { structured: { changes: [change('cards.0', '태그를 붙이면 노트가 자동으로 묶여요!', { title: '태그로 묶기', evidence: '태그를 붙이면 노트가 자동으로 묶인다.' })], reply: 'b' } };
    const p3 = { structured: { changes: [change('cards.1', '날짜만 쓰면 그날 노트가 떠요.')], reply: 'c' } };
    const { ai, db, dataDir, setId } = await setup([p1, noIssues, p2, noIssues, p3, noIssues]);
    const a = await proposeChat(ai, 1, setId, '3번 카드 바꿔', null, undefined, dataDir);
    const b = await proposeChat(ai, 1, setId, '2번 카드 바꿔', null, undefined, dataDir);
    applyChat(db, dataDir, setId, a.chatId);
    expect(() => applyChat(db, dataDir, setId, b.chatId)).toThrow(ChatError); // a 를 적용한 뒤라 b 는 옛 세트 위의 제안
    const c = await proposeChat(ai, 1, setId, '3번 카드 바꿔', null, undefined, dataDir);
    expect(c.status).toBe('proposed');
    discardChat(db, setId, c.chatId);
    expect(() => applyChat(db, dataDir, setId, c.chatId)).toThrow(ChatError);
    revertChat(db, dataDir, setId, a.chatId);
    expect(() => revertChat(db, dataDir, setId, a.chatId)).toThrow(ChatError);
  }, 120_000);
});
