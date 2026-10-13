import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { setSetting } from '../config.ts';
import { openDb, type Db } from '../db/index.ts';
import { AiService } from './adapter.ts';
import { FakeProvider, type FakeStep } from './testing/fake-provider.ts';
import { AiError } from './types.ts';

const Schema = z.object({ title: z.string().max(10) });

function setup(steps: FakeStep[]) {
  const db = openDb(':memory:');
  const provider = new FakeProvider(steps);
  return { db, provider, ai: new AiService({ db, provider }) };
}

function runs(db: Db) {
  return db.prepare('SELECT attempt, kind, status, model FROM ai_runs ORDER BY id').all();
}

describe('AI 어댑터', () => {
  it('스키마를 통과한 JSON 을 돌려주고 호출을 기록한다', async () => {
    const { db, ai } = setup([{ structured: { title: '안녕' } }]);
    const r = await ai.call({ task: 'smoke_extract', prompt: 'p', schema: Schema });
    expect(r.data).toEqual({ title: '안녕' });
    expect(runs(db)).toEqual([{ attempt: 1, kind: 'generate', status: 'ok', model: 'sonnet' }]);
  });

  it('깨진 JSON 이면 이유를 붙여 1회 다시 요청한다', async () => {
    const { db, ai, provider } = setup([{ text: '죄송합니다' }, { text: '{"title":"둘째"}' }]);
    const r = await ai.call({ task: 'smoke_extract', prompt: '원래 프롬프트', schema: Schema });
    expect(r.data.title).toBe('둘째');
    expect(provider.calls[1]?.prompt).toContain('원래 프롬프트');
    expect(provider.calls[1]?.prompt).toContain('JSON 형식에 맞지 않았다');
    expect(runs(db)).toMatchObject([
      { attempt: 1, kind: 'generate', status: 'invalid_json' },
      { attempt: 2, kind: 'json_retry', status: 'ok' },
    ]);
  });

  it('스키마에 두 번 다 안 맞으면 저장할 결과 없이 실패한다 (재요청은 설정값 1회)', async () => {
    const { db, ai, provider } = setup([{ structured: { title: '열 글자가 넘는 제목입니다' } }, { structured: { nope: 1 } }]);
    await expect(ai.call({ task: 't', prompt: 'p', schema: Schema })).rejects.toMatchObject({ kind: 'schema_error' });
    expect(provider.calls[1]?.prompt).toMatch(/title/);
    expect(runs(db)).toMatchObject([{ status: 'schema_error' }, { status: 'schema_error' }]);
  });

  it('과제별 모델 설정을 따른다 (프로필은 opus, 사용자가 바꾸면 그 값)', async () => {
    const { db, ai, provider } = setup([{ structured: { title: 'a' } }, { structured: { title: 'b' } }]);
    await ai.call({ task: 'identity_profile', prompt: 'p', schema: Schema });
    setSetting(db, 'ai.taskModels', { identity_profile: 'sonnet' });
    await ai.call({ task: 'identity_profile', prompt: 'p', schema: Schema });
    expect(provider.calls.map((c) => c.model)).toEqual(['opus', 'sonnet']);
  });

  it('동시 호출 수는 설정값을 지킨다 (기본 1, 바꾸면 그만큼)', async () => {
    const one = setup([{ waitMs: 50, structured: { title: 'a' } }, { waitMs: 50, structured: { title: 'b' } }]);
    await Promise.all([1, 2].map(() => one.ai.call({ task: 't', prompt: 'p', schema: Schema })));
    expect(one.provider.maxRunning).toBe(1);

    const two = setup([{ waitMs: 50, structured: { title: 'a' } }, { waitMs: 50, structured: { title: 'b' } }]);
    setSetting(two.db, 'ai.concurrency', 2);
    await Promise.all([1, 2].map(() => two.ai.call({ task: 't', prompt: 'p', schema: Schema })));
    expect(two.provider.maxRunning).toBe(2);
  });

  it('실행 중인 호출을 취소하면 멈추고 cancelled 로 기록한다', async () => {
    const { db, ai } = setup([{ waitMs: 10_000, structured: { title: 'a' } }]);
    const job = ai.startJob();
    const p = ai.call({ task: 't', prompt: 'p', schema: Schema }, job);
    setTimeout(() => ai.cancel(job.jobId), 30);
    await expect(p).rejects.toMatchObject({ kind: 'cancelled' });
    expect(runs(db)).toMatchObject([{ status: 'cancelled' }]);
  });

  it('차례를 기다리던 호출도 취소할 수 있다', async () => {
    const { db, ai } = setup([{ waitMs: 100, structured: { title: 'a' } }]);
    const first = ai.call({ task: 't', prompt: 'p', schema: Schema });
    const job = ai.startJob();
    const second = ai.call({ task: 't', prompt: 'p', schema: Schema }, job);
    await new Promise((r) => setTimeout(r, 10));
    expect(ai.queue).toEqual({ running: 1, waiting: 1 });
    ai.cancel(job.jobId);
    await expect(second).rejects.toBeInstanceOf(AiError);
    await first;
    expect(runs(db)).toMatchObject([{ status: 'cancelled' }, { status: 'ok' }]);
  });

  it('시간 초과 같은 실행 오류는 재요청하지 않고 사람 말 안내와 함께 올린다', async () => {
    const timeout = new AiError('timeout', '제한 시간 초과', '잠시 뒤 다시 시도하세요.');
    const { db, ai } = setup([{ error: timeout }]);
    await expect(ai.call({ task: 't', prompt: 'p', schema: Schema })).rejects.toMatchObject({ kind: 'timeout', hint: /다시 시도/ });
    expect(runs(db)).toMatchObject([{ status: 'timeout' }]);
  });
});
