import { describe, expect, it } from 'vitest';
import { isPremade } from './premade.tsx';

describe('「미리 만든 결과」 판정 (결정 2026-10-18)', () => {
  it('DB 시각(UTC, 시간대 표시 없음)이 기준 시각 이전이면 미리 만든 것', () => {
    expect(isPremade('2026-10-17 16:00:00', '2026-10-17T16:20:00.000Z')).toBe(true);
    expect(isPremade('2026-10-17 16:20:00', '2026-10-17T16:20:00.000Z')).toBe(true);
  });
  it('기준 시각 뒤에 만든 것(실시간)은 아니다 — 한국 시각으로 착각해 9시간 어긋나지 않게', () => {
    expect(isPremade('2026-10-17 16:21:00', '2026-10-17T16:20:00.000Z')).toBe(false);
    expect(isPremade('2026-10-18 01:00:00', '2026-10-17T16:20:00.000Z')).toBe(false); // 문자열만 보면 「10-18 01:00 KST」처럼 보여도 UTC 다
  });
  it('기준이 없거나 시각이 없으면 표시 안 함', () => {
    expect(isPremade('2026-10-17 16:00:00', null)).toBe(false);
    expect(isPremade(null, '2026-10-17T16:20:00.000Z')).toBe(false);
  });
});
