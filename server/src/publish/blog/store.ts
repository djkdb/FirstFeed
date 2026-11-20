// 티스토리 발행 기록 읽기/쓰기 — SQL 은 이 파일에만
import type { Db } from '../../db/index.ts';

export interface BlogPostRow {
  id: number;
  site: string;
  setId: number | null;
  title: string;
  url: string | null;
  visibility: string;
  createdAt: string;
}
type Row = Record<string, unknown>;
const toRow = (r: Row): BlogPostRow => ({
  id: Number(r.id),
  site: String(r.site),
  setId: r.set_id === null ? null : Number(r.set_id),
  title: String(r.title),
  url: (r.url as string | null) ?? null,
  visibility: String(r.visibility),
  createdAt: String(r.created_at),
});

export function addBlogPost(db: Db, brandId: number, p: Omit<BlogPostRow, 'id' | 'createdAt'>): number {
  return Number(db.prepare('INSERT INTO blog_posts (brand_id, site, set_id, title, url, visibility) VALUES (?, ?, ?, ?, ?, ?)').run(brandId, p.site, p.setId, p.title, p.url, p.visibility).lastInsertRowid);
}

export function postsForSet(db: Db, site: string, setId: number): BlogPostRow[] {
  return (db.prepare('SELECT * FROM blog_posts WHERE site = ? AND set_id = ? ORDER BY id DESC').all(site, setId) as Row[]).map(toRow);
}

export function recentPosts(db: Db, brandId: number, site: string, limit: number): BlogPostRow[] {
  return (db.prepare('SELECT * FROM blog_posts WHERE brand_id = ? AND site = ? ORDER BY id DESC LIMIT ?').all(brandId, site, limit) as Row[]).map(toRow);
}
