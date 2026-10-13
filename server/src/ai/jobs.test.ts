import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { openDb } from '../db/index.ts';
import { AiService } from './adapter.ts';
import { FakeProvider, type FakeStep } from './testing/fake-provider.ts';
import type { JobState, RunRow } from './jobs.ts';

type View = JobState & { runs: RunRow[] };
type Started = { jobId: string; source: string };

const H = { host: 'localhost:4317', 'content-type': 'application/json' };

function setup(steps: FakeStep[]) {
  const db = openDb(':memory:');
  return createApp({ db, ai: new AiService({ db, provider: new FakeProvider(steps) }) });
}

async function waitDone(app: ReturnType<typeof setup>, jobId: string): Promise<View> {
  for (let i = 0; i < 100; i++) {
    const s = (await (await app.request(`/api/ai/jobs/${jobId}`, { headers: H })).json()) as View;
    if (s.phase !== 'running') return s;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('작업이 끝나지 않음');
}

const SOURCE = '동네 빵집은 2024년 3월 문을 열었다. 하루 120개만 굽는다.';
const good = {
  structured: {
    facts: [
      { fact: '2024년 3월 개업', quote: '동네 빵집은 2024년 3월 문을 열었다.' },
      { fact: '하루 120개만 굽는다', quote: '하루 120개만 굽는다.' },
    ],
  },
};

describe('시험 호출 작업 (화면 ↔ 서버)', () => {
  it('작업 ID 를 먼저 받고, 끝나면 결과와 호출 이력을 본다', async () => {
    const app = setup([good, { structured: { issues: [] } }]);
    const start = (await (await app.request('/api/ai/smoke', { method: 'POST', headers: H, body: JSON.stringify({ source: SOURCE }) })).json()) as Started;
    const s = await waitDone(app, start.jobId);
    expect(s.phase).toBe('done');
    expect(s.result).toMatchObject({ ok: true, rewrites: 0 });
    expect(s.runs.map((r) => r.kind)).toEqual(['generate', 'review']);
  });

  it('실행 중인 작업을 취소하면 cancelled 로 끝난다', async () => {
    const app = setup([{ waitMs: 10_000, structured: {} }]);
    const { jobId } = (await (await app.request('/api/ai/smoke', { method: 'POST', headers: H, body: JSON.stringify({ source: SOURCE }) })).json()) as Started;
    const c = await (await app.request(`/api/ai/jobs/${jobId}/cancel`, { method: 'POST', headers: H })).json();
    expect(c).toEqual({ cancelled: true });
    const s = await waitDone(app, jobId);
    expect(s.phase).toBe('cancelled');
    expect(s.runs).toMatchObject([{ status: 'cancelled' }]);
  });

  it('원문을 비우면 기본 예시 원문(AI 생성 자료)을 쓴다', async () => {
    const app = setup([good, { structured: { issues: [] } }]);
    const start = (await (await app.request('/api/ai/smoke', { method: 'POST', headers: H, body: '{}' })).json()) as Started;
    expect(start.source).toContain('밀가루상점');
    expect(start.source).not.toContain('<!--');
    await waitDone(app, start.jobId);
  });
});
