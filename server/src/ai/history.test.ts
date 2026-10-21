import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { openDb } from '../db/index.ts';
import { findUngrounded } from '../rules/grounding.ts';
import type { Rule } from '../rules/types.ts';
import { AiService } from './adapter.ts';
import { changedFields, rewriteHistory } from './history.ts';
import { generateChecked } from './loop.ts';
import { FakeProvider, type FakeStep } from './testing/fake-provider.ts';

// 재작성 기록 (devlog 2026-10-21-04) — 1차에 원문 밖 숫자 → 재작성 → 통과
const SOURCE = '주말에는 줄이 길었다.';
const Schema = z.object({ title: z.string(), sub: z.string() });
type Out = z.infer<typeof Schema>;
const numberRule: Rule<Out> = (d) =>
  findUngrounded(d.title, { source: [SOURCE] }, []).map((u) => ({ level: 'error', code: 'number_not_in_source', message: `원문에 없는 "${u.value}"`, where: 'title', from: 'rule' }));

function run(steps: FakeStep[]) {
  const db = openDb(':memory:');
  const ai = new AiService({ db, provider: new FakeProvider(steps) });
  return { db, go: () => generateChecked(ai, { task: 'smoke_extract', prompt: '제목을 써라', schema: Schema, rules: [numberRule], selfReview: false }) };
}

describe('재작성 기록', () => {
  it('걸린 시도의 문제와, 다시 쓰며 바뀐 칸만 전/후로 남는다', async () => {
    const { db, go } = run([{ structured: { title: '주말 40분 줄', sub: '같은 부제' } }, { structured: { title: '주말엔 줄이 길어요', sub: '같은 부제' } }]);
    const r = await go();
    expect(r).toMatchObject({ ok: true, rewrites: 1 });
    const h = rewriteHistory(db, r.jobId);
    expect(h).toHaveLength(1);
    expect(h[0]!.issues).toEqual([expect.objectContaining({ code: 'number_not_in_source', where: 'title', from: 'rule' })]);
    expect(h[0]!.changes).toEqual([{ path: 'title', before: '주말 40분 줄', after: '주말엔 줄이 길어요' }]); // 안 바뀐 부제는 없다
    expect(h[0]!.passedAfter).toBe(true);
  });

  it('한 번에 통과한 작업은 출력을 저장하지 않고 기록도 없다 (용량)', async () => {
    const { db, go } = run([{ structured: { title: '주말엔 줄이 길어요', sub: '부제' } }]);
    const r = await go();
    expect(rewriteHistory(db, r.jobId)).toEqual([]);
    expect(db.prepare('SELECT output_json FROM ai_runs').all()).toEqual([{ output_json: null }]);
  });

  it('바뀐 칸: 목록 길이가 달라지면 없는 쪽은 null', () => {
    expect(changedFields({ cards: [{ b: '가' }] }, { cards: [{ b: '가' }, { b: '나' }] })).toEqual([{ path: 'cards.1.b', before: null, after: '나' }]);
  });
});
