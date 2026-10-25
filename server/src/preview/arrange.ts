// 계획 칸 순서 맞추기 (결정 2026-10-25 · 줄무늬): 같은 축이 같은 열에 이어지지 않게. 격자는 3열이라 게시 순서에서 i 번째와 i+3 번째가
// 같은 열 위아래(만든 세트가 몇 개 앞에 있어도 이 관계는 같다). 축 3개가 차례로 돌면 열마다 한 색(세로 줄무늬)이 된다.
// - 비용: 같은 열 위아래가 같은 축(i, i+3) = 3, 바로 옆 칸이 같은 축(i, i+1) = 1 — 가장 작은 비용, 같으면 원래 순서와 가장 가까운 것
// - 움직이지 않는 칸(고정 · 이은 · 올린)은 그 자리 그대로, 나머지 칸만 축 단위로 다시 놓는다(같은 축 안 순서는 그대로)
// - 9칸이면 축 배치 경우의 수가 많아야 수천 개라 모두 따져 본다(가지치기). AI 없음
const COLS = 3;
const W_COL = 3;
const W_ROW = 1;

/** 축 줄(게시 순서)의 비용 */
export function stripeCost(pillars: string[]): number {
  let c = 0;
  for (let i = 0; i < pillars.length; i++) {
    if (i + COLS < pillars.length && pillars[i] === pillars[i + COLS]) c += W_COL;
    if (i + 1 < pillars.length && pillars[i] === pillars[i + 1]) c += W_ROW;
  }
  return c;
}

/** 새 순서(원래 칸 번호의 목록)를 돌려준다. fixed = 움직이지 않는 칸 번호 */
export function arrangeOrder(pillars: string[], fixed: Set<number>): number[] {
  const n = pillars.length;
  const movable = [...Array(n).keys()].filter((i) => !fixed.has(i));
  const counts = new Map<string, number>();
  for (const i of movable) counts.set(pillars[i]!, (counts.get(pillars[i]!) ?? 0) + 1);
  const kinds = [...counts.keys()].sort();
  const seq: string[] = pillars.slice();
  let best: { cost: number; moved: number; seq: string[] } | null = null;
  // i 자리까지 채웠을 때 그 자리로 끝나는 비용만 더한다(앞 칸과의 관계는 앞에서 다 셌다)
  const local = (i: number) => (i >= COLS && seq[i] === seq[i - COLS] ? W_COL : 0) + (i >= 1 && seq[i] === seq[i - 1] ? W_ROW : 0);
  const walk = (i: number, cost: number, moved: number) => {
    if (best && (cost > best.cost || (cost === best.cost && moved >= best.moved))) return;
    if (i === n) {
      best = { cost, moved, seq: seq.slice() };
      return;
    }
    if (fixed.has(i)) {
      walk(i + 1, cost + local(i), moved);
      return;
    }
    // 원래 축을 먼저 해 보면 원래 순서에 가까운 답이 먼저 나와 가지치기가 잘 된다
    for (const k of [pillars[i]!, ...kinds.filter((x) => x !== pillars[i])]) {
      const left = counts.get(k) ?? 0;
      if (left === 0) continue;
      counts.set(k, left - 1);
      seq[i] = k;
      walk(i + 1, cost + local(i), moved + (k === pillars[i] ? 0 : 1));
      counts.set(k, left);
    }
    seq[i] = pillars[i]!;
  };
  walk(0, 0, 0);
  const target = (best as { seq: string[] } | null)?.seq ?? pillars;
  // 축마다 원래 칸 번호를 원래 순서대로 줄 세워 새 자리에 차례로 놓는다
  const queue = new Map<string, number[]>();
  for (const i of movable) queue.set(pillars[i]!, [...(queue.get(pillars[i]!) ?? []), i]);
  return target.map((k, i) => (fixed.has(i) ? i : queue.get(k)!.shift()!));
}
