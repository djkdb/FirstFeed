// 표지 바탕색 규칙 (2026-11-04 바둑판 · 2026-10-25 축 색 변형) — 미리보기 계획 칸 · 실제 카드 표지 · 표지 색 다시 맞추기가 같은 그림이 되는지 실제 브라우저로
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { env, setSetting } from '../config.ts';
import { openDb } from '../db/index.ts';
import { text, type ProfileContent } from '../identity/model.ts';
import { createSession, saveProfileVersion } from '../identity/store.ts';
import { planCover, previewDir } from '../preview/covers.ts';
import { savePlan } from '../preview/plan.ts';
import { recolorCovers, staleCovers } from '../cards/recolor.ts';
import { addSource, getSet, rendersDir, saveSet } from '../cards/store.ts';
import { linkSet } from '../home/store.ts';
import { closeBrowser } from '../render/browser.ts';
import { draftById } from './index.ts';
import { renderFrame } from './render-frame.ts';
import { fixTemplate } from './store.ts';
import type { BrandLook, FrameContent } from './types.ts';

afterAll(() => closeBrowser());

// AI 생성 데모 브랜드(doyun) — 사용자 실제 자료가 아니다
const look: BrandLook = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/generated/brands/doyun.json'), 'utf8')).look;
const P = (id: string, name: string) => ({ id, name, description: name, evidence: [], origin: 'interview' as const, expiresAt: null });
const PILLARS = [P('a'.repeat(16), '써 본 도구'), P('b'.repeat(16), '만든 것')];
const TITLE = '같은 제목으로 그려 보기';
const content = (pillar: number): FrameContent => ({ kind: 'cover', headline: TITLE, sub: null, chip: PILLARS[pillar]!.name });

function setup() {
  const db = openDb(':memory:');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-variant-'));
  const c: ProfileContent = { accountLine: '계정', accountLineOrigin: 'interview', audience: '누구', audienceOrigin: 'interview', pillars: PILLARS, dropped: [], voiceRules: [text('쉽게', 'interview')], avoid: [], unknown: [], presence: null };
  const pid = saveProfileVersion(db, 1, c, { reason: 'interview', sessionId: createSession(db, 1, {}), basedOn: null, jobId: null, activate: true });
  const tvId = fixTemplate(db, 1, 'A', look, { cover: { headline: { charsPerLine: 9, maxLines: 2, maxChars: null } } }, 'test', null);
  // 같은 축 두 칸 + 다른 축 한 칸 — 바둑판이면 같은 축도 순번에 따라 색이 다르다
  savePlan(db, 1, pid, [0, 0, 1].map((p) => ({ title: TITLE, pillarId: PILLARS[p]!.id, locked: false, origin: 'ai' as const })), null);
  return { db, dataDir, pid, tvId };
}
type T = ReturnType<typeof setup>;

/** 실제 카드 표지를 그리는 길(cards/covers.ts · body.ts 와 같은 인자) */
async function cardCover(t: T, pillar: number, postIndex: number) {
  const r = await renderFrame(t.db, draftById('A')!, look, content(pillar), { pillarIndex: pillar, postIndex });
  expect(r.ok).toBe(true);
  return r;
}
const planPng = async (t: T, slot: number) => {
  const r = await planCover(t.db, t.dataDir, 1, slot);
  if (!r.ok) throw new Error(r.reason);
  return fs.readFileSync(path.join(previewDir(t.dataDir), r.file));
};
/** 만든 세트 하나(표지만 의미 있음) — 표지는 일부러 다른 색(순번 1 = 주색)으로 그려 저장해 「규칙 전에 만든 카드」처럼 */
async function madeSet(t: T, pillar: number) {
  const r = await cardCover(t, pillar, 1);
  const card = { kind: 'cover' as const, content: content(pillar), evidence: null, image: null, glosses: [], edited: false, png: r.png!, render: { browser: 'test', reference: true, scale: 1 } };
  return saveSet(t.db, t.dataDir, { brandId: 1, sourceId: addSource(t.db, 1, '소재', null, null), profileId: t.pid, templateVersionId: t.tvId, pillarId: PILLARS[pillar]!.id, edited: false, coverJobId: null, bodyJobId: null, cards: [card] });
}
const coverPng = (t: T, setId: number) => fs.readFileSync(path.join(rendersDir(t.dataDir, setId), getSet(t.db, setId)!.cards[0]!.pngFile));

describe('표지 바탕색 규칙 — 미리보기와 실제가 같은 그림', () => {
  it('바둑판(기본): 계획 칸 표지 = 같은 순번의 실제 카드 표지, 같은 축이어도 순번 홀짝이 다르면 다른 색', async () => {
    const t = setup();
    const [s0, s1, s2] = [await planPng(t, 0), await planPng(t, 1), await planPng(t, 2)];
    expect(s0.equals((await cardCover(t, 0, 0)).png!)).toBe(true);
    expect(s1.equals((await cardCover(t, 0, 1)).png!)).toBe(true);
    expect(s0.equals(s1)).toBe(false); // 같은 축 · 다른 홀짝
    expect((await cardCover(t, 0, 0)).tone).toBe(look.palette.background.toLowerCase());
    expect((await cardCover(t, 0, 1)).tone).toBe(look.palette.primary.toLowerCase());
    expect(s2.length).toBeGreaterThan(0);
  }, 60_000);

  it('앞에 세트가 생겨 순번이 밀리면 계획 칸 표지도 다시 그린다(홀짝이 바뀌므로)', async () => {
    const t = setup();
    const before = await planPng(t, 0);
    await madeSet(t, 1);
    const after = await planPng(t, 0);
    expect(after.equals(before)).toBe(false);
    expect(after.equals((await cardCover(t, 0, 1)).png!)).toBe(true);
  }, 60_000);

  it('한 톤: 모든 계획 칸이 고정 판 그대로 · 축 색 변형: 같은 축이면 같은 색', async () => {
    const t = setup();
    setSetting(t.db, 'render.coverColorRule', 'single');
    expect((await planPng(t, 0)).equals(await planPng(t, 1))).toBe(true);
    setSetting(t.db, 'render.coverColorRule', 'pillar');
    expect((await planPng(t, 0)).equals(await planPng(t, 1))).toBe(true);
    expect((await planPng(t, 0)).equals(await planPng(t, 2))).toBe(false);
  }, 60_000);
});

describe('표지 색 다시 맞추기 — 만든 카드도 같은 규칙(AI 없음, 표지만)', () => {
  it('색이 다른(색 기록 없는) 표지만 다시 그리고, 다시 그린 표지는 같은 자리의 계획 칸 표지와 같은 그림 · 두 번째는 그대로', async () => {
    const t = setup();
    const id = await madeSet(t, 0); // 순번 0(바탕색)인데 주색으로 저장됨
    expect(staleCovers(t.db, t.dataDir, 1)).toEqual([id]);
    const r = await recolorCovers(t.db, t.dataDir, 1);
    expect(r).toMatchObject({ redrawn: [id], failed: [] });
    expect(coverPng(t, id).equals((await cardCover(t, 0, 0)).png!)).toBe(true);
    expect(getSet(t.db, id)!.cards[0]!.render.tone).toBe(look.palette.background.toLowerCase());
    expect(staleCovers(t.db, t.dataDir, 1)).toEqual([]);
    expect(await recolorCovers(t.db, t.dataDir, 1)).toMatchObject({ redrawn: [], unchanged: 1 });
  }, 60_000);

  it('세트를 칸에 이어 순번 홀짝이 바뀌면 다시 맞출 표지로 잡힌다', async () => {
    const t = setup();
    const id = await madeSet(t, 0);
    await recolorCovers(t.db, t.dataDir, 1); // 순번 0 으로 맞춤
    linkSet(t.db, 1, 1, id); // 계획 칸 2번(순번 1)에 이음
    expect(staleCovers(t.db, t.dataDir, 1)).toEqual([id]);
  }, 60_000);
});
