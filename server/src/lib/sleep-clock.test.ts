import { describe, expect, it } from 'vitest';
import { sleptNote, startStopwatch } from './sleep-clock.ts';

describe('잠자기가 낀 시간 재기', () => {
  it('벽시계만 흐른 만큼이 잠든 시간이다 (5초 이하는 오차로 본다)', () => {
    let wall = 1_000_000;
    let mono = 50;
    const sw = startStopwatch(
      () => wall,
      () => mono,
    );
    wall += 3000;
    mono += 3000;
    expect([sw.wallMs(), sw.sleptMs()]).toEqual([3000, 0]);
    wall += 3_810_000; // 덮개를 닫아 63분 30초 잠듦 — 단조 시계는 멈춤
    wall += 357_000;
    mono += 357_000;
    expect(sw.wallMs()).toBe(4_170_000);
    expect(sw.sleptMs()).toBe(3_810_000);
    expect(sleptNote(sw.sleptMs())).toBe(' · 컴퓨터 잠자기 약 3810초 포함');
    expect(sleptNote(0)).toBe('');
  });
});
