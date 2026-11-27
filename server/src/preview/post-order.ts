// 게시 순번 (표지 바둑판 색 · 결정 2026-11-04). 격자 구성(compose-grid.ts)과 같은 「30일 뒤」 게시 순서:
//   어느 칸에도 잇지 않은 만든 세트(만든 순) → 계획 칸 1번부터(칸에 이은 세트는 그 칸 자리)
// 0 = 가장 먼저 올리는 것. 격자는 최근 것이 왼쪽 위라 칸 위치 i = (마지막 순번 − 순번)이고, 3열이면 i = 3·행 + 열 이라
// 순번 홀짝 = (행+열) 홀짝(3 이 홀수라서) → 순번 홀짝으로 색을 정하면 게시물이 늘어 칸이 밀려도 바둑판이 그대로다.
// 격자 구성과 표지 그리기가 이 함수 하나를 써서 서로 다른 순번을 쓰지 않는다
import type { DatabaseSync } from 'node:sqlite';
import { listSets } from '../cards/store.ts';
import { homeMarks, type HomeMark } from '../home/marks.ts';

export interface PostOrder {
  /** 칸에 잇지 않은 만든 세트(만든 순) */
  unlinked: number[];
  /** 세트 ID → 순번 (칸에 이은 세트는 그 칸의 순번) */
  ofSet: Map<number, number>;
  /** 계획 칸 번호 → 순번 */
  ofSlot: (slot: number) => number;
  /** 지금 새로 만드는 세트(아직 어느 칸에도 잇지 않음)가 받을 순번 */
  next: number;
}

export function postOrder(made: Array<{ id: number }>, marks: Map<number, HomeMark>): PostOrder {
  const ids = new Set(made.map((s) => s.id));
  const linkedTo = new Map<number, number>();
  for (const [slot, m] of [...marks].sort((a, b) => a[0] - b[0])) if (m.setId !== null && ids.has(m.setId) && !linkedTo.has(m.setId)) linkedTo.set(m.setId, slot);
  const unlinked = made.map((s) => s.id).filter((id) => !linkedTo.has(id)).sort((a, b) => a - b);
  const ofSlot = (slot: number) => unlinked.length + slot;
  const ofSet = new Map<number, number>([...unlinked.map((id, i) => [id, i] as [number, number]), ...[...linkedTo].map(([id, slot]) => [id, ofSlot(slot)] as [number, number])]);
  return { unlinked, ofSet, ofSlot, next: unlinked.length };
}

export const postOrderOf = (db: DatabaseSync, brandId: number): PostOrder => postOrder(listSets(db, brandId), homeMarks(db, brandId));
