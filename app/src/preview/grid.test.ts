import { describe, expect, it } from 'vitest';
import { cellBox } from './grid.ts';

// 카드 1080×1350, 격자 가림 좌우 34px(설정 render.safeArea.feed 기본값 — 결정 2026-10-18)
const G = { card: { width: 1080, height: 1350 }, safe: { x: 34, y: 0, w: 1012, h: 1350 } };

describe('격자 칸 모양 (FR-BR-6)', () => {
  it('격자처럼 보일 때: 칸은 1012:1350(≈3:4), 그림은 칸보다 넓고 왼쪽 34px 만큼 밀린다', () => {
    const b = cellBox(G, false);
    expect(b.aspect).toBe('1012 / 1350');
    expect(b.imgWidthPct).toBeCloseTo((1080 / 1012) * 100);
    expect(b.imgLeftPct).toBeCloseTo(-(34 / 1012) * 100);
    expect(b.hiddenPct).toBe(0);
  });
  it('가려지는 곳 보기: 카드 전체(4:5)와 양옆 34px 띠', () => {
    const b = cellBox(G, true);
    expect(b.aspect).toBe('1080 / 1350');
    expect(b.hiddenPct).toBeCloseTo((34 / 1080) * 100);
  });
});
