// 릴스 읽기/쓰기 — SQL 은 이 파일에만. 파일은 data/reels/reel-<id>/
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from '../db/index.ts';
import { currentSelection } from '../brand/store.ts';
import { newReelDoc, withOriginals, type ReelBrand, type ReelDoc } from './model.ts';
import { FALLBACK_THEME } from './color.ts';

type Row = Record<string, unknown>;

export interface ReelRow {
  id: number;
  name: string;
  doc: ReelDoc;
  updatedAt: string;
}

export const reelDir = (dataDir: string, id: number) => path.join(dataDir, 'reels', `reel-${id}`);

export function listReels(db: Db, brandId: number): Array<{ id: number; name: string; updatedAt: string }> {
  return (db.prepare('SELECT id, name, updated_at FROM reels WHERE brand_id = ? ORDER BY updated_at DESC, id DESC').all(brandId) as Row[]).map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    updatedAt: String(r.updated_at),
  }));
}

export function getReel(db: Db, brandId: number, id: number): ReelRow | null {
  const r = db.prepare('SELECT * FROM reels WHERE id = ? AND brand_id = ?').get(id, brandId) as Row | undefined;
  if (!r) return null;
  return { id: Number(r.id), name: String(r.name), doc: withOriginals(JSON.parse(String(r.doc_json)) as ReelDoc), updatedAt: String(r.updated_at) };
}

export function createReel(db: Db, brandId: number, name: string): ReelRow {
  const doc = newReelDoc(name);
  const id = Number(db.prepare('INSERT INTO reels (brand_id, name, doc_json) VALUES (?, ?, ?)').run(brandId, name, JSON.stringify(doc)).lastInsertRowid);
  return getReel(db, brandId, id)!;
}

/** 자동 저장 — 화면이 보낸 편집 내용 그대로(모양은 routes.ts 에서 확인) */
export function saveReel(db: Db, brandId: number, id: number, doc: ReelDoc): string | null {
  const r = db
    .prepare("UPDATE reels SET name = ?, doc_json = ?, updated_at = datetime('now') WHERE id = ? AND brand_id = ? RETURNING updated_at")
    .get(doc.name.slice(0, 80) || '이름 없는 릴스', JSON.stringify(withOriginals(doc)), id, brandId) as Row | undefined;
  return r ? String(r.updated_at) : null;
}

/** 릴스와 그 파일(올린 복사본 · 뽑은 영상)을 함께 지운다 — 얼굴이 나오는 원본도 같이(0-16) */
export function deleteReel(db: Db, brandId: number, id: number, dataDir: string): boolean {
  const ok = db.prepare('DELETE FROM reels WHERE id = ? AND brand_id = ?').run(id, brandId).changes > 0;
  if (ok) fs.rmSync(reelDir(dataDir, id), { recursive: true, force: true });
  return ok;
}

const NEUTRAL = { primary: FALLBACK_THEME, secondary: '#8f949c', accent: '#d9d9de', background: '#f4f5f7', text: '#111318' };

/** 영상이 쓰는 브랜드 — 브랜딩 키트에서 고른 팔레트 · 글꼴. 아직 없으면 중립 색 · 기본 글꼴(화면이 「브랜딩부터」를 알린다) */
export function reelBrand(db: Db, brandId: number): ReelBrand & { ready: boolean } {
  const sel = currentSelection(db, brandId);
  return {
    palette: sel.palette ? { ...sel.palette.colors } : NEUTRAL,
    titleFont: sel.titleFont ?? 'pretendard',
    bodyFont: sel.bodyFont ?? 'pretendard',
    handle: sel.handle,
    ready: !!sel.palette,
  };
}
