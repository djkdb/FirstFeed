// 「30일 뒤 내 계정」 공유 이미지 (FR-BR-7 · 결정 2026-10-24) — 실제 브라우저로 그린다(카드와 같은 렌더링 경로)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider } from '../ai/testing/fake-provider.ts';
import { saveSelection } from '../brand/store.ts';
import { env } from '../config.ts';
import { openDb } from '../db/index.ts';
import { text, type ProfileContent } from '../identity/model.ts';
import { createSession, saveProfileVersion } from '../identity/store.ts';
import { closeBrowser } from '../render/browser.ts';
import { fixTemplate } from '../templates/store.ts';
import type { BrandLook } from '../templates/types.ts';
import { savePlan } from './plan.ts';
import { shareHtml, shareImage, shareView } from './share-image.ts';

afterAll(() => closeBrowser());

const look: BrandLook = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/real/brands/me.json'), 'utf8')).look;
const P = (id: string, name: string) => ({ id, name, description: `${name} 이야기`, evidence: [], origin: 'interview' as const, expiresAt: null });
const PILLARS = [P('a'.repeat(16), '써 본 도구'), P('b'.repeat(16), '만든 것')];

function setup(bio: string) {
  const db = openDb(':memory:');
  const content: ProfileContent = {
    accountLine: '직접 써 본 도구 정리',
    accountLineOrigin: 'interview',
    audience: '대학생',
    audienceOrigin: 'interview',
    pillars: PILLARS,
    dropped: [],
    voiceRules: [text('쉽게 쓴다', 'interview')],
    avoid: [],
    unknown: [],
    presence: null,
  };
  const pid = saveProfileVersion(db, 1, content, { reason: 'interview', sessionId: createSession(db, 1, {}), basedOn: null, jobId: null, activate: true });
  saveSelection(db, 1, pid, { handle: 'tool.notes', displayName: '도구 노트', bio });
  fixTemplate(db, 1, 'A', look, { cover: { headline: { charsPerLine: 9, maxLines: 2, maxChars: null } } }, 'playwright-chromium', null);
  // 계획 2칸만 — 만든 카드도 없어 나머지 7칸은 빈칸(9칸 미만)
  savePlan(db, 1, pid, [
    { title: '설치만 하고 멈췄다면', pillarId: PILLARS[0]!.id, locked: false, origin: 'ai' },
    { title: '처음 만든 것부터', pillarId: PILLARS[1]!.id, locked: false, origin: 'ai' },
  ], null);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-share-'));
  return { db, dataDir };
}

const pngSize = (b: Buffer) => ({ width: b.readUInt32BE(16), height: b.readUInt32BE(20) });

describe('공유 이미지', () => {
  it('스토리 크기(1080×1920) PNG — 칸이 9개보다 적게 채워져도(계획 2 · 빈칸 7) 그린다', async () => {
    const t = setup('직접 써 본 도구만\n▸ 써 본 도구\n▸ 만든 것');
    const r = await shareImage(t.db, t.dataDir, 1);
    if (!r.ok) throw new Error(r.reason);
    expect(pngSize(r.png)).toEqual({ width: 1080, height: 1920 });
    expect(r.view.cells.map((c) => c.kind)).toEqual(['plan', 'plan', ...Array(7).fill('empty')]);
    expect(r.view.cells.filter((c) => c.kind === 'plan').every((c) => c.img?.startsWith('data:image/png'))).toBe(true);
    expect(r.view).toMatchObject({ made: 0, plan: 2 });
    // 「▸」 는 앱 글꼴 어디에도 없어 대체 글꼴 — 카드와 달리 경고만(결정 2026-10-24)
    expect(r.warnings.map((w) => w.code)).toEqual(['font_fallback']);
  });

  it('계획 칸에는 「계획」 배지가 그대로 — 만든 칸 · 빈칸에는 없다. 팔로워 같은 없는 숫자는 없다', async () => {
    const t = setup('짧은 바이오');
    const html = shareHtml(await shareView(t.db, t.dataDir, 1));
    expect(html.match(/data-badge>계획</g)).toHaveLength(2);
    expect(html).toContain('만든 카드 <b>0</b> · 계획 <b>2</b>');
    expect(html).toContain('FirstFeed</b>로 만든 30일 계획');
    expect(html).not.toMatch(/팔로워|팔로잉/);
  });

  it('바이오가 머리 칸(5줄)을 넘치면 PNG 를 만들지 않고 이유를 알린다', async () => {
    const t = setup(Array.from({ length: 8 }, (_, i) => `${i + 1}번째 줄 바이오`).join('\n'));
    const r = await shareImage(t.db, t.dataDir, 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.map((p) => p.slot)).toContain('bio');
  });

  it('API 는 내려받기 이름을 붙여 PNG 로 준다', async () => {
    const t = setup('짧은 바이오');
    const app = createApp({ db: t.db, ai: new AiService({ db: t.db, provider: new FakeProvider([]) }), dataDir: t.dataDir });
    const r = await app.request('/api/preview/share.png', { headers: { host: 'localhost:4317' } });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('image/png');
    expect(r.headers.get('content-disposition')).toContain('attachment;');
    expect(pngSize(Buffer.from(await r.arrayBuffer()))).toEqual({ width: 1080, height: 1920 });
  });
});
