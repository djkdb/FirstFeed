// 발표용 「미리 만든 결과」 기준 시각 켜기·끄기 (결정 2026-10-18). 처음엔 기본값 null 설정을 저장하지 못해 500 이었다
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { openDb } from '../db/index.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider } from '../ai/testing/fake-provider.ts';

const H = { host: 'localhost:4317', 'content-type': 'application/json' };

describe('/api/demo', () => {
  it('켜면 지금 시각이 기준이 되고, 끄면 null', async () => {
    const db = openDb(':memory:');
    const app = createApp({ db, ai: new AiService({ db, provider: new FakeProvider([]) }), dataDir: '/tmp' });
    expect(await (await app.request('/api/demo', { headers: H })).json()).toEqual({ premadeBefore: null });
    const before = Date.now();
    const on = await app.request('/api/demo', { method: 'PUT', headers: H, body: JSON.stringify({ on: true }) });
    expect(on.status).toBe(200);
    const t = Date.parse(((await on.json()) as { premadeBefore: string }).premadeBefore);
    expect(t).toBeGreaterThanOrEqual(before - 1000);
    const off = await app.request('/api/demo', { method: 'PUT', headers: H, body: JSON.stringify({ on: false }) });
    expect(await off.json()).toEqual({ premadeBefore: null });
  });
});
