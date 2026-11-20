// 작업 콘솔 기록 (사용자 지시 2026-11-05): 도는 작업 · 끝난 모양 · 단계 진행. 시뮬레이션에서 겪은 「끝까지 규칙에 걸렸는데 완료」를 다시 막는다
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { openDb } from '../db/index.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider, type FakeStep } from '../ai/testing/fake-provider.ts';
import { dbTime, outcomeOf } from './feed.ts';

const H = { host: 'localhost:4317', 'content-type': 'application/json' };
const SOURCE = '동네 빵집은 2024년 3월 문을 열었다. 하루 120개만 굽는다.';
const good = { facts: [{ fact: '2024년 3월 개업', quote: '동네 빵집은 2024년 3월 문을 열었다.' }, { fact: '하루 120개만 굽는다', quote: '하루 120개만 굽는다.' }] };
const bad = { facts: [{ fact: '하루 300개를 굽는다', quote: '하루 120개만 굽는다.' }, good.facts[0]] };
type Feed = { running: Array<{ jobId: string; task: string }>; items: Array<{ key: string; status: string; task: string | null; detail: string | null; ai: { rewrites: number; reasons: string[] } | null }>; progress: Record<string, boolean> };

function setup(steps: FakeStep[]) {
  const db = openDb(':memory:');
  return createApp({ db, ai: new AiService({ db, provider: new FakeProvider(steps) }) });
}
const feed = async (app: ReturnType<typeof setup>) => (await (await app.request('/api/console', { headers: H })).json()) as Feed;
const start = async (app: ReturnType<typeof setup>) =>
  ((await (await app.request('/api/ai/smoke', { method: 'POST', headers: H, body: JSON.stringify({ source: SOURCE }) })).json()) as { jobId: string }).jobId;
async function until(app: ReturnType<typeof setup>, ok: (f: Feed) => boolean): Promise<Feed> {
  for (let i = 0; i < 200; i++) {
    const f = await feed(app);
    if (ok(f)) return f;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('기다린 상태가 오지 않음');
}

describe('작업 콘솔', () => {
  it('처음 쓰는 사람: 도는 것 · 한 일 없음, 단계는 모두 아직', async () => {
    const f = await feed(setup([]));
    expect(f).toEqual({ running: [], items: [], progress: { identity: false, brand: false, template: false, make: false } });
  });

  it('도는 동안은 running 에만, 끝나면 한 일로 — 다시 쓴 이유가 붙는다', async () => {
    const app = setup([{ waitMs: 80, structured: bad }, { structured: good }, { structured: { issues: [] } }]);
    const id = await start(app);
    expect((await feed(app)).running.map((r) => r.jobId)).toEqual([id]);
    const f = await until(app, (x) => x.running.length === 0 && x.items.length > 0);
    expect(f.items[0]).toMatchObject({ key: `ai:${id}`, task: 'smoke_extract', status: 'done' });
    expect(f.items[0]!.ai!.rewrites).toBe(1);
    expect(f.items[0]!.ai!.reasons.join(' ')).toContain('300');
  });

  it('예외 없이 끝나도 규칙을 끝까지 통과 못 했으면 「실패」 (시뮬레이션에서 「완료」로 보였다)', async () => {
    const app = setup([{ structured: bad }, { structured: bad }, { structured: bad }]);
    const id = await start(app);
    const f = await until(app, (x) => x.items.some((i) => i.key === `ai:${id}`) && x.running.length === 0);
    const it0 = f.items.find((i) => i.key === `ai:${id}`)!;
    expect(it0.status).toBe('failed');
    expect(it0.detail).toContain('300');
  });

  it('취소한 작업은 취소함', async () => {
    const app = setup([{ waitMs: 5000, structured: good }]);
    const id = await start(app);
    await until(app, (x) => x.running.length === 1);
    await app.request(`/api/ai/jobs/${id}/cancel`, { method: 'POST', headers: H });
    const f = await until(app, (x) => x.running.length === 0 && x.items.length > 0);
    expect(f.items[0]!.status).toBe('cancelled');
  });

  it('결과 모양 판정 · 시각 맞추기', () => {
    expect(outcomeOf({ ok: false, errors: [{ message: '원문에 없는 숫자' }] })).toEqual({ status: 'failed', message: '원문에 없는 숫자' });
    expect(outcomeOf({ status: 'failed', errors: ['[x] 넘침'] }).status).toBe('failed');
    expect(outcomeOf({ status: 'needs_edit' }).status).toBe('needs_edit');
    expect(outcomeOf({ status: 'saved' }).status).toBe('done');
    expect(dbTime('2026-11-05T01:02:03.456Z')).toBe('2026-11-05 01:02:03');
    expect(dbTime('2026-11-05 01:02:03')).toBe('2026-11-05 01:02:03');
  });
});
