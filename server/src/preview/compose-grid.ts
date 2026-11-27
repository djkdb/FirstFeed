// 30일 뒤 미리보기 격자 구성 (FR-BR-6 · FR-HM-4). 화면 API(routes.ts) · 공유 이미지(share-image.ts) · 소개 페이지 내보내기가 같은 구성을 쓴다.
// 순서는 실제 인스타 프로필처럼 **가장 최근 게시물이 왼쪽 위**(결정 2026-10-25). 「30일 뒤 모습」이라 게시 순서(오래된 것 → 최근)를
//   어느 칸에도 잇지 않은 만든 세트(만든 순) → 계획 칸 1번부터(칸에 이은 세트는 그 칸 자리)
// 로 보고, 그중 칸 수만큼을 최근 것부터 왼쪽 위에 놓는다 → 마지막에 올릴 칸이 왼쪽 위, 먼저 올리는 것이 오른쪽 아래, 모자라면 뒤가 빈칸.
// 만든 세트가 먼저 자리를 차지한다(칸 수보다 많으면 가장 최근 세트들만 — 계획 칸 없음).
// 칸마다 게시 순번(seq, post-order.ts)을 붙인다 — 표지 바둑판 색이 이 번호의 홀짝이라 화면이 그 칸의 색을 알 수 있게.
// 칸 상태(FR-HM-4): 계획(아직 안 만듦) / 만듦(세트 있음) / 올림(사용자가 「올렸어요」로 표시 — 확인한 것 아님)
import type { HomeMark } from '../home/marks.ts';
import type { PlanSlot } from './plan.ts';
import { postOrder } from './post-order.ts';

export type CellState = 'plan' | 'made' | 'posted';

export type GridCell =
  | { kind: 'made'; setId: number; headline: string; createdAt: string; slot: number | null; state: 'made' | 'posted'; seq: number }
  | { kind: 'plan'; slot: number; title: string; pillarId: string; pillarName: string | null; locked: boolean; origin: PlanSlot['origin']; state: 'plan' | 'posted'; seq: number }
  | { kind: 'empty' };

export function composeGrid(
  made: Array<{ id: number; cover: string; createdAt: string }>,
  plan: PlanSlot[],
  pillarNames: Map<string, string>,
  cells: number,
  marks: Map<number, HomeMark> = new Map(),
): GridCell[] {
  const byId = new Map(made.map((s) => [s.id, s]));
  const order = postOrder(made, marks);
  const unlinked = order.unlinked.map((id) => byId.get(id)!);
  const madeCell = (s: { id: number; cover: string; createdAt: string }, slot: number | null, posted: boolean): GridCell => ({
    kind: 'made',
    setId: s.id,
    headline: s.cover,
    createdAt: s.createdAt,
    slot,
    state: posted ? 'posted' : 'made',
    seq: slot === null ? order.ofSet.get(s.id)! : order.ofSlot(slot),
  });
  const timeline: GridCell[] = [
    ...unlinked.map((s) => madeCell(s, null, false)),
    ...plan.map((p, slot): GridCell => {
      const m = marks.get(slot);
      const set = m?.setId !== null && m?.setId !== undefined ? byId.get(m.setId) : undefined;
      if (set) return madeCell(set, slot, m?.postedAt != null);
      return { kind: 'plan', slot, title: p.title, pillarId: p.pillarId, pillarName: pillarNames.get(p.pillarId) ?? null, locked: p.locked, origin: p.origin, state: m?.postedAt ? 'posted' : 'plan', seq: order.ofSlot(slot) };
    }),
  ];
  const shown = unlinked.length >= cells ? timeline.slice(unlinked.length - cells, unlinked.length) : timeline.slice(0, cells);
  const out = shown.reverse();
  while (out.length < cells) out.push({ kind: 'empty' });
  return out;
}
