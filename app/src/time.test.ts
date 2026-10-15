import { describe, expect, it } from 'vitest';
import { localTime } from './time.ts';

describe('DB 시각(UTC) → 화면 현지 시각', () => {
  it('UTC 문자열을 이 컴퓨터 시간대로 — 한국이면 9시간 더한다(날짜도 넘어간다)', () => {
    const before = process.env.TZ;
    process.env.TZ = 'Asia/Seoul';
    try {
      expect(localTime('2026-10-15 00:25:40')).toBe('2026-10-15 09:25');
      expect(localTime('2026-10-14 17:49:55')).toBe('2026-10-15 02:49');
    } finally {
      process.env.TZ = before;
    }
  });

  it('모르는 모양은 그대로', () => {
    expect(localTime('어제')).toBe('어제');
  });
});
