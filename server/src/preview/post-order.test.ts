// 표지 바둑판 색 (결정 2026-11-04): 색을 게시 순번 홀짝으로 정하면 3열 격자에서 바둑판이 되는가 — 게시물이 늘어 칸이 밀려도
import { describe, expect, it } from 'vitest';
import type { HomeMark } from '../home/marks.ts';
import { composeGrid, type GridCell } from './compose-grid.ts';
import type { PlanSlot } from './plan.ts';
import { postOrder } from './post-order.ts';
import { checkerTone } from '../templates/variant.ts';

const made = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, cover: `세트 ${i + 1}`, createdAt: '2026-11-01 00:00:00' }));
const plan = (n: number): PlanSlot[] => Array.from({ length: n }, (_, i) => ({ title: `계획 ${i + 1}`, pillarId: ['a', 'b', 'c'][i % 3]!, locked: false, origin: 'ai' }));
const mark = (setId: number | null, posted = false): HomeMark => ({ setId, postedAt: posted ? '2026-11-02' : null, delayDays: 0 });

/** 격자(최근 것이 왼쪽 위)의 칸마다 순번 홀짝 색 — 이웃한(가로 · 세로) 칸끼리 색이 늘 다르면 바둑판 */
function isChecker(cells: GridCell[], cols: number): boolean {
  const tone = (c: GridCell | undefined) => (c && c.kind !== 'empty' ? checkerTone(c.seq) : null);
  return cells.every((c, i) => {
    const t = tone(c);
    const right = i % cols < cols - 1 ? tone(cells[i + 1]) : null;
    const down = tone(cells[i + cols]);
    return t === null || ((right === null || right !== t) && (down === null || down !== t));
  });
}

describe('게시 순번 — 격자 구성과 같은 순서', () => {
  it('잇지 않은 만든 세트(만든 순) → 계획 칸 1번부터, 칸에 이은 세트는 그 칸의 순번', () => {
    const o = postOrder(made(3), new Map([[1, mark(2)]]));
    expect(o.unlinked).toEqual([1, 3]);
    expect(o.ofSet.get(1)).toBe(0);
    expect(o.ofSet.get(3)).toBe(1);
    expect(o.ofSet.get(2)).toBe(o.ofSlot(1));
    expect(o.ofSlot(0)).toBe(2);
    expect(o.next).toBe(2); // 새 세트는 잇지 않은 세트 맨 뒤
  });

  it('격자 칸의 순번 = 격자 구성의 게시 순서(최근 것이 왼쪽 위라 왼쪽 위가 가장 큰 순번)', () => {
    const cells = composeGrid(made(2), plan(9), new Map(), 9, new Map([[3, mark(1, true)]]));
    const seqs = cells.map((c) => (c.kind === 'empty' ? null : c.seq));
    expect(seqs).toEqual([8, 7, 6, 5, 4, 3, 2, 1, 0]); // 30일 뒤 모습 = 처음 9개(마지막 계획 칸은 9칸 밖), 순번 0(잇지 않은 세트 2)이 오른쪽 아래
    expect(cells.find((c) => c.kind === 'made' && c.setId === 1)).toMatchObject({ slot: 3, seq: 4 });
  });
});

describe('3열 격자에서 순번 홀짝 = 바둑판', () => {
  it('만든 세트 0~12개 × 계획 0~9칸 × 칸에 이은 세트가 있든 없든 — 이웃 칸 색이 늘 다르다', () => {
    for (let m = 0; m <= 12; m++)
      for (let p = 0; p <= 9; p++)
        for (const linked of [false, true]) {
          const marks = linked && p > 2 && m > 0 ? new Map([[2, mark(1)]]) : new Map<number, HomeMark>();
          expect(isChecker(composeGrid(made(m), plan(p), new Map(), 9, marks), 3), `만든 ${m} · 계획 ${p} · 이음 ${linked}`).toBe(true);
        }
  });

  it('게시물이 하나 늘어 칸이 밀려도 이미 있던 게시물의 색은 그대로이고 격자는 여전히 바둑판(왼쪽 위 색만 번갈아 바뀐다)', () => {
    for (let n = 1; n <= 15; n++) {
      const before = composeGrid(made(n), [], new Map(), 9);
      const after = composeGrid(made(n + 1), [], new Map(), 9);
      const toneOf = (cells: GridCell[]) => new Map(cells.flatMap((c) => (c.kind === 'made' ? [[c.setId, checkerTone(c.seq)] as const] : [])));
      const a = toneOf(after);
      for (const [id, t] of toneOf(before)) if (a.has(id)) expect(a.get(id)).toBe(t);
      expect(isChecker(after, 3)).toBe(true);
    }
  });

  it('왜 3열이라 되는가: 칸 위치 i = 3·행 + 열 이고 3 이 홀수라 i 홀짝 = (행+열) 홀짝. 열 수가 짝수(4열)면 순번 홀짝은 세로 줄무늬가 된다', () => {
    const grid = (cols: number, n = 12) => Array.from({ length: n }, (_, i) => ({ kind: 'plan', seq: n - 1 - i }) as GridCell);
    expect(isChecker(grid(3), 3)).toBe(true);
    expect(isChecker(grid(4), 4)).toBe(false);
  });
});
