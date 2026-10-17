import { describe, expect, it } from 'vitest';
import { missingJobOutcome, rememberFinished, type KeyValueStore } from './finishedJobs.ts';

const memory = (): KeyValueStore => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

describe('서버가 모르는 작업 ID (서버 재시작 뒤)', () => {
  it('화면이 끝난 것을 본 작업 → stale: 조용히 지운다 (발표 중 페이지를 열다 오류가 뜨면 안 된다)', () => {
    const s = memory();
    rememberFinished('job-done', s);
    expect(missingJobOutcome('job-done', s)).toBe('stale');
  });

  it('끝난 것을 본 적 없는 작업 = 진행 중이던 작업이 사라짐 → lost: 다시 하라고 안내', () => {
    const s = memory();
    rememberFinished('job-other', s);
    expect(missingJobOutcome('job-running', s)).toBe('lost');
  });

  it('저장소를 못 쓰면 lost (엄한 쪽 — 안내가 뜬다)', () => {
    expect(missingJobOutcome('job-done', null)).toBe('lost');
  });

  it('최근 50개만 기억한다', () => {
    const s = memory();
    for (let i = 0; i < 60; i++) rememberFinished(`job-${i}`, s);
    expect(missingJobOutcome('job-5', s)).toBe('lost');
    expect(missingJobOutcome('job-59', s)).toBe('stale');
  });
});
