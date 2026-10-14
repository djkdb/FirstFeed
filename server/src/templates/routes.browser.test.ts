// 템플릿 API: 키트 선택이 모자라면 거절 → 시안 미리 보기 → 고정 → 키트를 바꿔도 고정한 판은 그대로
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { openDb } from '../db/index.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider } from '../ai/testing/fake-provider.ts';
import { saveSelection } from '../brand/store.ts';
import { closeBrowser } from '../render/browser.ts';
import { getTemplateVersion } from './store.ts';

afterAll(() => closeBrowser());
const H = { host: 'localhost:4317', 'content-type': 'application/json' };

describe('템플릿 API', () => {
  it('선택 → 미리 보기 → 고정 → 키트 변경 뒤에도 판은 그대로', async () => {
    const db = openDb(':memory:');
    const app = createApp({ db, ai: new AiService({ db, provider: new FakeProvider([]) }) });
    const post = (p: string, body?: unknown) => app.request(`/api/templates${p}`, { method: 'POST', headers: H, body: body ? JSON.stringify(body) : undefined });

    const r0 = await post('/preview', { draftId: 'A' });
    expect(r0.status).toBe(400);
    expect(((await r0.json()) as { error: string }).error).toContain('색 팔레트·폰트 짝');

    const palette = { name: '밤', colors: { primary: '#10B981', secondary: '#1E293B', accent: '#FDE047', background: '#0B1220', text: '#E2E8F0' }, why: '' };
    saveSelection(db, 1, null, { palette, titleFont: 'paperlogy', bodyFont: 'pretendard', handle: 'zun.ai.tools' });
    const prev = (await (await post('/preview', { draftId: 'B' })).json()) as { frames: Array<{ kind: string; ok: boolean; png: string | null; browser: string; reference: boolean }> };
    expect(prev.frames.map((f) => [f.kind, f.ok, f.reference])).toEqual([
      ['cover', true, true],
      ['body', true, true],
      ['closing', true, true],
      ['reel_cover', true, true],
    ]);
    expect(prev.frames[0]!.png).toMatch(/^data:image\/png;base64,/);

    const fix = (await (await post('/fix', { draftId: 'B' })).json()) as { id: number; version: number; budget: Record<string, unknown> };
    expect(fix.version).toBe(1);
    expect(Object.keys(fix.budget)).toEqual(['cover', 'body', 'closing', 'reel_cover']);

    saveSelection(db, 1, null, { palette: { ...palette, colors: { ...palette.colors, primary: '#B0304A' } } });
    expect(getTemplateVersion(db, fix.id)!.look.palette.primary).toBe('#10B981');
    const again = (await (await post(`/versions/${fix.id}/preview`)).json()) as { frames: Array<{ ok: boolean }> };
    expect(again.frames.every((f) => f.ok)).toBe(true);
    const list = (await (await app.request('/api/templates', { headers: H })).json()) as { fixed: { draftId: string } };
    expect(list.fixed.draftId).toBe('B');
  }, 60_000);
});
