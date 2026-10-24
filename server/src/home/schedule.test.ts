import { describe, expect, it } from 'vitest';
import { addDays, dueDates, pickToday } from './schedule.ts';

describe('「오늘 올릴 것」 예정일 (결정 2026-10-24)', () => {
  it('기본 3일마다 1개 — 9칸이면 24일째가 마지막', () => {
    const d = dueDates('2026-10-25', 9, 'every3');
    expect(d[0]).toBe('2026-10-25');
    expect(d[1]).toBe('2026-10-28');
    expect(d[8]).toBe(addDays('2026-10-25', 24));
  });

  it('주 2회는 3일 · 4일 번갈아(일주일에 두 번), 주 3회는 2 · 2 · 3일(일주일에 세 번)', () => {
    expect(dueDates('2026-10-26', 5, 'twice')).toEqual(['2026-10-26', '2026-10-29', '2026-11-02', '2026-11-05', '2026-11-09']);
    expect(dueDates('2026-10-26', 7, 'thrice')).toEqual(['2026-10-26', '2026-10-28', '2026-10-30', '2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09']);
  });

  it('하루 미루기는 그 칸과 뒤의 모든 칸을 하루씩 민다 — 앞 칸은 그대로', () => {
    const base = dueDates('2026-10-25', 4, 'every3');
    const moved = dueDates('2026-10-25', 4, 'every3', [0, 0, 1]);
    expect(moved.slice(0, 2)).toEqual(base.slice(0, 2));
    expect(moved.slice(2)).toEqual(base.slice(2).map((d) => addDays(d, 1)));
  });

  it('달 · 해가 넘어가도 날짜가 맞다', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('오늘 할 칸 = 안 올린 칸 중 예정일이 오늘이거나 지난 가장 앞 칸, 다음 칸 = 아직 안 온 첫 칸', () => {
    const slots = [
      { due: '2026-10-25', posted: true },
      { due: '2026-10-28', posted: false },
      { due: '2026-10-31', posted: false },
    ];
    expect(pickToday(slots, '2026-10-29')).toEqual({ today: 1, next: 2 });
    expect(pickToday(slots, '2026-10-27')).toEqual({ today: null, next: 1 });
    expect(pickToday(slots.map((s) => ({ ...s, posted: true })), '2026-11-30')).toEqual({ today: null, next: null });
  });
});
