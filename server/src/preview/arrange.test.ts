import { describe, expect, it } from 'vitest';
import { arrangeOrder, stripeCost } from './arrange.ts';

const apply = (p: string[], order: number[]) => order.map((i) => p[i]!);
const sameColumn = (p: string[]) => p.filter((x, i) => i + 3 < p.length && x === p[i + 3]).length;

describe('계획 칸 순서 — 같은 축이 같은 열에 이어지지 않게 (결정 2026-10-25)', () => {
  it('축 3개가 차례로 도는 9칸(열마다 한 색)을 행마다 밀린 모양으로 — 같은 열 이어짐 0, 옆 칸 같은 축 0', () => {
    const p = ['a', 'b', 'c', 'a', 'b', 'c', 'a', 'b', 'c'];
    expect(sameColumn(p)).toBe(6);
    const q = apply(p, arrangeOrder(p, new Set()));
    expect(sameColumn(q)).toBe(0);
    expect(stripeCost(q)).toBe(0);
    expect([...q].sort()).toEqual([...p].sort());
  });

  it('축이 2 · 4 · 5개여도 같은 열 이어짐 0(9칸)', () => {
    for (const p of [
      ['a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a'],
      ['a', 'b', 'c', 'd', 'a', 'b', 'c', 'd', 'a'],
      ['a', 'b', 'c', 'd', 'e', 'a', 'b', 'c', 'd'],
    ]) {
      const q = apply(p, arrangeOrder(p, new Set()));
      expect(sameColumn(q), p.join('')).toBe(0);
    }
  });

  it('움직이지 않는 칸(고정 · 이은 · 올린)은 그 자리 그대로 — 나머지만 다시 놓는다', () => {
    const p = ['a', 'b', 'c', 'a', 'b', 'c', 'a', 'b', 'c'];
    const fixed = new Set([0, 4]);
    const order = arrangeOrder(p, fixed);
    expect(order[0]).toBe(0);
    expect(order[4]).toBe(4);
    expect([...order].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(stripeCost(apply(p, order))).toBeLessThan(stripeCost(p));
  });

  it('이미 줄무늬가 없으면 순서를 바꾸지 않는다 · 같은 축 안의 순서는 그대로', () => {
    const p = ['a', 'b', 'c', 'b', 'c', 'a', 'c', 'a', 'b'];
    expect(arrangeOrder(p, new Set())).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const r = ['a', 'b', 'c', 'a', 'b', 'c', 'a', 'b', 'c'];
    const order = arrangeOrder(r, new Set());
    for (const k of ['a', 'b', 'c']) {
      const idx = order.filter((i) => r[i] === k);
      expect(idx).toEqual([...idx].sort((x, y) => x - y));
    }
  });
});
