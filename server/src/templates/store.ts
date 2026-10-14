// 템플릿 판 읽기/쓰기. SQL 은 이 파일에만 둔다
import type { Db } from '../db/index.ts';
import type { BrandLook } from './types.ts';
import type { Budget } from './budget.ts';

type Row = Record<string, unknown>;

export interface TemplateVersion {
  id: number;
  brandId: number;
  version: number;
  draftId: string;
  look: BrandLook;
  budget: Budget;
  browser: string;
  selectionId: number | null;
  createdAt: string;
}

const toVersion = (r: Row): TemplateVersion => ({
  id: Number(r.id),
  brandId: Number(r.brand_id),
  version: Number(r.version),
  draftId: String(r.draft_id),
  look: JSON.parse(String(r.look_json)) as BrandLook,
  budget: JSON.parse(String(r.budget_json)) as Budget,
  browser: String(r.browser),
  selectionId: r.selection_id == null ? null : Number(r.selection_id),
  createdAt: String(r.created_at),
});

/** 고정: 새 판을 만들고 바로 그 판을 브랜드의 고정 판으로 (한 트랜잭션) */
export function fixTemplate(db: Db, brandId: number, draftId: string, look: BrandLook, budget: Budget, browser: string, selectionId: number | null): number {
  db.exec('BEGIN');
  try {
    const next = Number((db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS v FROM template_versions WHERE brand_id = ?').get(brandId) as Row).v);
    const r = db
      .prepare('INSERT INTO template_versions (brand_id, version, draft_id, look_json, budget_json, browser, selection_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(brandId, next, draftId, JSON.stringify(look), JSON.stringify(budget), browser, selectionId);
    const id = Number(r.lastInsertRowid);
    db.prepare('UPDATE brands SET template_version_id = ? WHERE id = ?').run(id, brandId);
    db.exec('COMMIT');
    return id;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getTemplateVersion(db: Db, id: number): TemplateVersion | null {
  const r = db.prepare('SELECT * FROM template_versions WHERE id = ?').get(id) as Row | undefined;
  return r ? toVersion(r) : null;
}

/** 지금 고정한 판 — 이후 모든 콘텐츠가 이 판으로 그려진다 */
export function fixedTemplate(db: Db, brandId: number): TemplateVersion | null {
  const r = db.prepare('SELECT template_version_id AS id FROM brands WHERE id = ?').get(brandId) as Row | undefined;
  return r?.id == null ? null : getTemplateVersion(db, Number(r.id));
}

export function listTemplateVersions(db: Db, brandId: number): TemplateVersion[] {
  return (db.prepare('SELECT * FROM template_versions WHERE brand_id = ? ORDER BY version DESC').all(brandId) as Row[]).map(toVersion);
}
