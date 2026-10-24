// 축 색 변형 (2026-10-25) — 미리보기 계획 칸과 실제 카드 표지가 같은 그림이 되는지 실제 브라우저로
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
import { closeBrowser } from '../render/browser.ts';
import { draftById } from './index.ts';
import { renderFrame } from './render-frame.ts';
import { fixTemplate } from './store.ts';
import type { BrandLook } from './types.ts';

afterAll(() => closeBrowser());

// AI 생성 데모 브랜드(doyun) — 사용자 실제 자료가 아니다
const look: BrandLook = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/generated/brands/doyun.json'), 'utf8')).look;
const P = (id: string, name: string) => ({ id, name, description: name, evidence: [], origin: 'interview' as const, expiresAt: null });
const PILLARS = [P('a'.repeat(16), '써 본 도구'), P('b'.repeat(16), '만든 것')];

function setup() {
  const db = openDb(':memory:');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-variant-'));
  const content: ProfileContent = { accountLine: '계정', accountLineOrigin: 'interview', audience: '누구', audienceOrigin: 'interview', pillars: PILLARS, dropped: [], voiceRules: [text('쉽게', 'interview')], avoid: [], unknown: [], presence: null };
  const pid = saveProfileVersion(db, 1, content, { reason: 'interview', sessionId: createSession(db, 1, {}), basedOn: null, jobId: null, activate: true });
  fixTemplate(db, 1, 'A', look, { cover: { headline: { charsPerLine: 9, maxLines: 2, maxChars: null } } }, 'test', null);
  savePlan(db, 1, pid, PILLARS.map((p) => ({ title: '같은 제목으로 그려 보기', pillarId: p.id, locked: false, origin: 'ai' as const })), null);
  return { db, dataDir };
}

/** 실제 카드 표지를 그리는 길(cards/covers.ts · body.ts 와 같은 인자) */
async function cardCover(db: ReturnType<typeof openDb>, pillar: number, colorIndex: number = pillar) {
  const r = await renderFrame(db, draftById('A')!, look, { kind: 'cover', headline: '같은 제목으로 그려 보기', sub: null, chip: PILLARS[pillar]!.name }, { pillarIndex: colorIndex });
  expect(r.ok).toBe(true);
  return r.png!;
}
const planPng = async (t: ReturnType<typeof setup>, slot: number) => {
  const r = await planCover(t.db, t.dataDir, 1, slot);
  if (!r.ok) throw new Error(r.reason);
  return fs.readFileSync(path.join(previewDir(t.dataDir), r.file));
};

describe('축 색 변형 — 미리보기와 실제가 같은 그림', () => {
  it('같은 축이면 계획 칸 표지와 실제 카드 표지가 같은 PNG, 축이 다르면 다른 PNG', async () => {
    const t = setup();
    const [plan0, plan1] = [await planPng(t, 0), await planPng(t, 1)];
    expect(plan0.equals(await cardCover(t.db, 0))).toBe(true);
    expect(plan1.equals(await cardCover(t.db, 1))).toBe(true);
    expect(plan0.equals(plan1)).toBe(false);
  }, 60_000);

  it('설정을 끄면 모든 축이 원래 모양(0번 축 색) — 계획 칸도 다시 그린다', async () => {
    const t = setup();
    const before = await planPng(t, 1);
    setSetting(t.db, 'render.pillarCoverVariant', false);
    const off = await planPng(t, 1);
    expect(off.equals(before)).toBe(false);
    expect(off.equals(await cardCover(t.db, 1, 0))).toBe(true);
  }, 60_000);
});
