// 30일 뒤 미리보기 격자 구성 (FR-BR-6). 화면 API(routes.ts)와 공유 이미지(share-image.ts)가 같은 구성을 쓴다
import type { PlanSlot } from './plan.ts';

export type GridCell =
  | { kind: 'made'; setId: number; headline: string; createdAt: string }
  | { kind: 'plan'; slot: number; title: string; pillarId: string; pillarName: string | null; locked: boolean; origin: PlanSlot['origin'] }
  | { kind: 'empty' };

/** 격자 칸: 만든 세트(최신순)를 먼저, 남은 칸은 계획을 차례로, 그래도 남으면 빈칸 */
export function composeGrid(
  made: Array<{ id: number; cover: string; createdAt: string }>,
  plan: PlanSlot[],
  pillarNames: Map<string, string>,
  cells: number,
): GridCell[] {
  const out: GridCell[] = made.slice(0, cells).map((s) => ({ kind: 'made', setId: s.id, headline: s.cover, createdAt: s.createdAt }));
  for (const [slot, p] of plan.entries()) {
    if (out.length >= cells) break;
    out.push({ kind: 'plan', slot, title: p.title, pillarId: p.pillarId, pillarName: pillarNames.get(p.pillarId) ?? null, locked: p.locked, origin: p.origin });
  }
  while (out.length < cells) out.push({ kind: 'empty' });
  return out;
}
