// 홈 칸 표시 읽기(home_slots) — 홈(store.ts) · 격자 구성 · 계획 다시 만들기(plan.ts)가 같이 쓴다.
// 계획 쪽이 store.ts 를 가져오면 서로 가져오는 고리가 생겨 읽기만 따로 둔다. SQL 은 이 파일과 store.ts 에만
import type { DatabaseSync } from 'node:sqlite';

export interface HomeMark {
  setId: number | null;
  postedAt: string | null;
  delayDays: number;
}

export function homeMarks(db: DatabaseSync, brandId: number): Map<number, HomeMark> {
  const rows = db.prepare('SELECT slot_idx, set_id, posted_at, delay_days FROM home_slots WHERE brand_id = ?').all(brandId) as Array<Record<string, unknown>>;
  return new Map(rows.map((r) => [Number(r.slot_idx), { setId: r.set_id === null ? null : Number(r.set_id), postedAt: (r.posted_at as string | null) ?? null, delayDays: Number(r.delay_days) }]));
}

/** 세트를 잇거나 「올렸어요」를 한 칸 — 프로필 판이 바뀌어도 계획에서 그대로 둔다(결정 2026-10-25) */
export function keptSlots(db: DatabaseSync, brandId: number): Set<number> {
  return new Set([...homeMarks(db, brandId)].filter(([, m]) => m.setId !== null || m.postedAt !== null).map(([i]) => i));
}
