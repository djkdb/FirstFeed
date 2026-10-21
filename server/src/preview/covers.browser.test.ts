// 계획 칸을 실제 표지로 그리기 (FR-BR-6 확장) — 실제 브라우저(기준: Playwright Chromium)로 그린다. 없으면 건너뛴다
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider } from '../ai/testing/fake-provider.ts';
import { env } from '../config.ts';
import { openDb } from '../db/index.ts';
import { text, type ProfileContent } from '../identity/model.ts';
import { createSession, saveProfileVersion } from '../identity/store.ts';
import { closeBrowser, getBrowser } from '../render/browser.ts';
import { fixTemplate } from '../templates/store.ts';
import type { BrandLook } from '../templates/types.ts';
import { planCover } from './covers.ts';
import { editSlot, savePlan } from './plan.ts';

let hasBrowser = false;
beforeAll(async () => {
  try {
    await getBrowser(null);
    hasBrowser = true;
  } catch (e) {
    console.warn(`[계획 표지 테스트 건너뜀] ${(e as Error).message}`);
  }
}, 30_000);
afterAll(() => closeBrowser());

const PILLAR = { id: 'a'.repeat(16), name: '두 번 가 본 판정', description: '평일·주말 두 번 가 보고 판정', evidence: [], origin: 'interview' as const, expiresAt: null };
// AI 생성 데모 브랜드(seoyeon) — 사용자 실제 자료가 아니다
const look: BrandLook = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/generated/brands/seoyeon.json'), 'utf8')).look;

function setup(charsPerLine = 9) {
  const db = openDb(':memory:');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'firstfeed-plancover-'));
  const content: ProfileContent = {
    accountLine: '줄 서도 아깝지 않은 디저트',
    accountLineOrigin: 'interview',
    audience: '디저트 좋아하는 사람',
    audienceOrigin: 'interview',
    pillars: [PILLAR],
    dropped: [],
    voiceRules: [text('결론부터', 'interview')],
    avoid: [],
    unknown: [],
    presence: null,
  };
  const pid = saveProfileVersion(db, 1, content, { reason: 'interview', sessionId: createSession(db, 1, {}), basedOn: null, jobId: null, activate: true });
  fixTemplate(db, 1, 'A', look, { cover: { headline: { charsPerLine, maxLines: 2, maxChars: null } } }, 'test', null);
  const slot = (title: string) => ({ title, pillarId: PILLAR.id, locked: false, origin: 'ai' as const });
  return { db, dataDir, pid, slot };
}

describe('계획 칸 표지 렌더링', () => {
  it('고정 템플릿 표지로 그리고, 같은 제목·축·판이면 다시 그리지 않는다', async () => {
    if (!hasBrowser) return;
    const t = setup();
    savePlan(t.db, 1, t.pid, [t.slot('웨이팅 피하는 시간')], null);
    const first = await planCover(t.db, t.dataDir, 1, 0);
    expect(first).toMatchObject({ ok: true, cached: false });
    expect(first.ok && fs.existsSync(path.join(t.dataDir, 'previews', first.file))).toBe(true);
    expect(await planCover(t.db, t.dataDir, 1, 0)).toMatchObject({ ok: true, cached: true });
  });

  it('표지 틀을 넘치면 PNG 를 만들지 않고 이유를 돌려준다(그 칸만 자리표시로)', async () => {
    if (!hasBrowser) return;
    const t = setup(60); // 길이 규칙은 통과하지만 실제로 그리면 넘치는 제목
    savePlan(t.db, 1, t.pid, [t.slot('띄어쓰기없이아주길게이어붙인디저트가게이름과웨이팅시간과자리잡는요령까지모두')], null);
    const r = await planCover(t.db, t.dataDir, 1, 0);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason.length).toBeGreaterThan(0);
    expect(fs.readdirSync(path.join(t.dataDir, 'previews')).some((f) => f.endsWith('.png'))).toBe(false);
    expect(await planCover(t.db, t.dataDir, 1, 0)).toMatchObject({ ok: false, cached: true });
  });

  it('칸 하나를 고치면 그 칸만 다시 그린다', async () => {
    if (!hasBrowser) return;
    const t = setup();
    savePlan(t.db, 1, t.pid, [t.slot('평일 오후가 낫다'), t.slot('두 번 가 본 판정')], null);
    await planCover(t.db, t.dataDir, 1, 0);
    await planCover(t.db, t.dataDir, 1, 1);
    editSlot(t.db, 1, 1, { title: '주말엔 오픈런' });
    expect(await planCover(t.db, t.dataDir, 1, 0)).toMatchObject({ ok: true, cached: true });
    expect(await planCover(t.db, t.dataDir, 1, 1)).toMatchObject({ ok: true, cached: false });
  });

  it('API: 칸 표지 JSON 과 PNG 를 내주고, 다른 이름의 파일은 거절한다', async () => {
    if (!hasBrowser) return;
    const t = setup();
    savePlan(t.db, 1, t.pid, [t.slot('평일 오후가 낫다')], null);
    const app = createApp({ db: t.db, ai: new AiService({ db: t.db, provider: new FakeProvider([]) }), dataDir: t.dataDir });
    const H = { host: 'localhost:4317' };
    const c = (await (await app.request('/api/preview/plan/0/cover', { headers: H })).json()) as { ok: boolean; file: string };
    expect(c.ok).toBe(true);
    const png = await app.request(`/api/preview/png/${c.file}`, { headers: H });
    expect(png.headers.get('content-type')).toBe('image/png');
    expect((await app.request('/api/preview/png/..%2Fsecret.png', { headers: H })).status).toBe(400);
  });
});
