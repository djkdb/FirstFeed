// 브랜딩 키트 DB 읽기/쓰기. SQL 은 이 파일에만 둔다.
import type { Db } from '../db/index.ts';
import type { DroppedCandidate, Selection, VisualCandidates, WordsCandidates } from './types.ts';

type Row = Record<string, unknown>;
const json = <T>(v: unknown): T => JSON.parse(String(v)) as T;

export type KitKind = 'words' | 'visual';
export interface SavedKit<T> {
  id: number;
  profileId: number;
  kind: KitKind;
  candidates: T;
  dropped: DroppedCandidate[];
  createdAt: string;
}

export function saveKit(db: Db, brandId: number, profileId: number, kind: KitKind, candidates: WordsCandidates | VisualCandidates, dropped: DroppedCandidate[], jobId: string | null): number {
  const r = db
    .prepare('INSERT INTO brand_kits (brand_id, profile_id, kind, candidates_json, dropped_json, job_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(brandId, profileId, kind, JSON.stringify(candidates), JSON.stringify(dropped), jobId);
  return Number(r.lastInsertRowid);
}

export function latestKit<T>(db: Db, brandId: number, kind: KitKind): SavedKit<T> | null {
  const r = db.prepare('SELECT * FROM brand_kits WHERE brand_id = ? AND kind = ? ORDER BY id DESC LIMIT 1').get(brandId, kind) as Row | undefined;
  if (!r) return null;
  return { id: Number(r.id), profileId: Number(r.profile_id), kind, candidates: json(r.candidates_json), dropped: json(r.dropped_json), createdAt: String(r.created_at) };
}

const EMPTY: Selection = { handle: null, displayName: null, bio: null, palette: null, titleFont: null, bodyFont: null, profileImage: null };

function toSelection(r: Row): Selection {
  return {
    handle: (r.handle as string | null) ?? null,
    displayName: (r.display_name as string | null) ?? null,
    bio: (r.bio as string | null) ?? null,
    palette: r.palette_json ? json(r.palette_json) : null,
    titleFont: (r.title_font as string | null) ?? null,
    bodyFont: (r.body_font as string | null) ?? null,
    profileImage: (r.profile_image as string | null) ?? null,
  };
}

export function currentSelection(db: Db, brandId: number): Selection & { id: number | null; profileId: number | null } {
  const r = db.prepare('SELECT * FROM brand_kit_selections WHERE brand_id = ? ORDER BY id DESC LIMIT 1').get(brandId) as Row | undefined;
  if (!r) return { ...EMPTY, id: null, profileId: null };
  return { ...toSelection(r), id: Number(r.id), profileId: r.profile_id == null ? null : Number(r.profile_id) };
}

/** 고른 것 바꾸기: 직전 선택을 복사하고 바뀐 칸만 덮어쓴 새 줄 (이력) */
export function saveSelection(db: Db, brandId: number, profileId: number | null, patch: Partial<Selection>): number {
  const prev = currentSelection(db, brandId);
  const next: Selection = { ...prev, ...patch };
  const changed = Object.keys(patch).join(',');
  const r = db
    .prepare(
      `INSERT INTO brand_kit_selections (brand_id, profile_id, handle, display_name, bio, palette_json, title_font, body_font, profile_image, changed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(brandId, profileId, next.handle, next.displayName, next.bio, next.palette ? JSON.stringify(next.palette) : null, next.titleFont, next.bodyFont, next.profileImage, changed);
  // 브랜드의 handle 칸도 맞춘다 (다른 화면이 브랜드 이름·아이디를 쓸 때)
  if (patch.handle !== undefined) db.prepare('UPDATE brands SET handle = ? WHERE id = ?').run(patch.handle, brandId);
  return Number(r.lastInsertRowid);
}

export function selectionHistory(db: Db, brandId: number): Array<{ id: number; changed: string; createdAt: string }> {
  return (db.prepare('SELECT id, changed, created_at FROM brand_kit_selections WHERE brand_id = ? ORDER BY id DESC').all(brandId) as Row[]).map((r) => ({
    id: Number(r.id),
    changed: String(r.changed),
    createdAt: String(r.created_at),
  }));
}
