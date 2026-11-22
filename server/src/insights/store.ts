// 성과 분석 읽기/쓰기(FR-IN-2~6 · 결정 2026-11-22). SQL 은 이 파일에만.
// 모르는 수치는 NULL 로 넣고 NULL 로 읽는다 — 0 으로 바꾸지 않는다(PRD 5장)
import { randomBytes } from 'node:crypto';
import type { Db } from '../db/index.ts';
import { FlowError } from '../identity/flow.ts';
import type { FetchedPost } from './metricool/tools.ts';

type Row = Record<string, unknown>;

export const METRICS = ['reach', 'saved', 'shares', 'views', 'likes', 'comments'] as const;
export type MetricKey = (typeof METRICS)[number];

export interface InsightPost {
  id: number;
  source: 'metricool' | 'manual';
  externalId: string;
  url: string | null;
  type: string | null;
  publishedAt: string | null;
  content: string | null;
  reach: number | null;
  saved: number | null;
  shares: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  fetchedAt: string | null;
  setId: number | null;
}

const n = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const s = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

function toPost(r: Row): InsightPost {
  return {
    id: Number(r.id),
    source: r.source as InsightPost['source'],
    externalId: String(r.external_id),
    url: s(r.url),
    type: s(r.type),
    publishedAt: s(r.published_at),
    content: s(r.content),
    reach: n(r.reach),
    saved: n(r.saved),
    shares: n(r.shares),
    views: n(r.views),
    likes: n(r.likes),
    comments: n(r.comments),
    fetchedAt: s(r.fetched_at),
    setId: r.set_id === null || r.set_id === undefined ? null : Number(r.set_id),
  };
}

export function listPosts(db: Db, brandId: number): InsightPost[] {
  return (db.prepare('SELECT * FROM insight_posts WHERE brand_id = ? ORDER BY published_at DESC, id DESC').all(brandId) as Row[]).map(toPost);
}

export function getPost(db: Db, brandId: number, id: number): InsightPost | null {
  const r = db.prepare('SELECT * FROM insight_posts WHERE id = ? AND brand_id = ?').get(id, brandId) as Row | undefined;
  return r ? toPost(r) : null;
}

/**
 * Metricool 에서 받은 게시물을 넣거나 고친다(수치는 시간이 지나며 바뀌어서 다시 받으면 덮어쓴다). 이은 세트(set_id)는 그대로.
 * 한 번에(트랜잭션) — 반쯤 들어간 상태로 남지 않게
 */
export function upsertFetched(db: Db, brandId: number, posts: FetchedPost[], fetchedAt: string): { added: number; updated: number } {
  let added = 0;
  let updated = 0;
  const find = db.prepare("SELECT id FROM insight_posts WHERE brand_id = ? AND source = 'metricool' AND external_id = ?");
  const ins = db.prepare(
    `INSERT INTO insight_posts (brand_id, source, external_id, url, type, published_at, content, reach, saved, shares, views, likes, comments, fetched_at)
     VALUES (?, 'metricool', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const upd = db.prepare(
    `UPDATE insight_posts SET url = ?, type = ?, published_at = ?, content = ?, reach = ?, saved = ?, shares = ?, views = ?, likes = ?, comments = ?,
       fetched_at = ?, updated_at = datetime('now') WHERE id = ?`,
  );
  db.exec('BEGIN');
  try {
    for (const p of posts) {
      const v = [p.url, p.type, p.publishedAt, p.content, p.reach, p.saved, p.shares, p.views, p.likes, p.comments, fetchedAt] as const;
      const had = find.get(brandId, p.externalId) as Row | undefined;
      if (had) {
        upd.run(...v, Number(had.id));
        updated++;
      } else {
        ins.run(brandId, p.externalId, ...v);
        added++;
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { added, updated };
}

export function lastFetchedAt(db: Db, brandId: number): string | null {
  const r = db.prepare("SELECT MAX(fetched_at) AS t FROM insight_posts WHERE brand_id = ? AND source = 'metricool'").get(brandId) as Row;
  return s(r.t);
}

export interface ManualInput {
  publishedAt: string;
  type: string | null;
  url: string | null;
  content: string | null;
  reach: number | null;
  saved: number | null;
  shares: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
}

export function addManual(db: Db, brandId: number, m: ManualInput): number {
  const r = db
    .prepare(
      `INSERT INTO insight_posts (brand_id, source, external_id, url, type, published_at, content, reach, saved, shares, views, likes, comments)
       VALUES (?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(brandId, `manual-${randomBytes(6).toString('hex')}`, m.url, m.type, m.publishedAt, m.content, m.reach, m.saved, m.shares, m.views, m.likes, m.comments);
  return Number(r.lastInsertRowid);
}

function manualOrThrow(db: Db, brandId: number, id: number): InsightPost {
  const p = getPost(db, brandId, id);
  if (!p) throw new FlowError('게시물을 찾지 못했어요.', '화면을 새로고침한 뒤 다시 시도하세요.');
  if (p.source !== 'manual') throw new FlowError('Metricool 에서 받은 숫자는 고칠 수 없어요.', '「불러오기」로 다시 받으세요. Metricool 에 없는 게시물만 직접 입력해요.');
  return p;
}

export function updateManual(db: Db, brandId: number, id: number, m: ManualInput): void {
  manualOrThrow(db, brandId, id);
  db.prepare(
    `UPDATE insight_posts SET url = ?, type = ?, published_at = ?, content = ?, reach = ?, saved = ?, shares = ?, views = ?, likes = ?, comments = ?,
       updated_at = datetime('now') WHERE id = ?`,
  ).run(m.url, m.type, m.publishedAt, m.content, m.reach, m.saved, m.shares, m.views, m.likes, m.comments, id);
}

export function deleteManual(db: Db, brandId: number, id: number): void {
  manualOrThrow(db, brandId, id);
  db.prepare('DELETE FROM insight_posts WHERE id = ?').run(id);
}

/** 게시물 ↔ 세트 잇기(사용자가 「맞아요」 또는 직접 고른 때만). null 이면 끊는다. 한 세트는 게시물 하나에만 */
export function linkPost(db: Db, brandId: number, postId: number, setId: number | null): void {
  if (!getPost(db, brandId, postId)) throw new FlowError('게시물을 찾지 못했어요.', '화면을 새로고침한 뒤 다시 시도하세요.');
  if (setId !== null) {
    const set = db.prepare('SELECT id FROM card_sets WHERE id = ? AND brand_id = ?').get(setId, brandId) as Row | undefined;
    if (!set) throw new FlowError('카드 세트를 찾지 못했어요.', '「만들기」에서 세트가 있는지 확인하세요.');
    const other = db.prepare('SELECT id FROM insight_posts WHERE set_id = ? AND id != ?').get(setId, postId) as Row | undefined;
    if (other) throw new FlowError('이 세트는 이미 다른 게시물과 이어져 있어요.', '그 게시물에서 먼저 끊은 뒤 다시 이으세요.');
  }
  db.prepare(`UPDATE insight_posts SET set_id = ?, linked_at = ${setId === null ? 'NULL' : "datetime('now')"}, updated_at = datetime('now') WHERE id = ?`).run(setId, postId);
}

export function rejectCandidate(db: Db, postId: number, setId: number): void {
  db.prepare('INSERT OR IGNORE INTO insight_link_rejections (post_id, set_id) VALUES (?, ?)').run(postId, setId);
}

export function rejectedPairs(db: Db): Set<string> {
  return new Set((db.prepare('SELECT post_id, set_id FROM insight_link_rejections').all() as Row[]).map((r) => `${Number(r.post_id)}:${Number(r.set_id)}`));
}

// ---------- 제안 ----------

export interface Evidence {
  groupKey: string;
  metric: 'saveRate' | 'shareRate';
  value: string;
}

export interface StoredSuggestion {
  id: number;
  jobId: string;
  kind: 'more' | 'less';
  groupKey: string;
  text: string;
  rule: string;
  evidence: Evidence[];
  status: 'pending' | 'accepted' | 'rejected';
  profileId: number | null;
  expiresAt: string | null;
  decidedAt: string | null;
  createdAt: string;
}

const toSuggestion = (r: Row): StoredSuggestion => ({
  id: Number(r.id),
  jobId: String(r.job_id),
  kind: r.kind as StoredSuggestion['kind'],
  groupKey: String(r.group_key),
  text: String(r.text),
  rule: String(r.rule),
  evidence: JSON.parse(String(r.evidence_json)) as Evidence[],
  status: r.status as StoredSuggestion['status'],
  profileId: r.profile_id === null ? null : Number(r.profile_id),
  expiresAt: s(r.expires_at),
  decidedAt: s(r.decided_at),
  createdAt: String(r.created_at),
});

export function saveSuggestions(db: Db, brandId: number, jobId: string, items: Array<Pick<StoredSuggestion, 'kind' | 'groupKey' | 'text' | 'rule' | 'evidence'>>, table: unknown): void {
  const st = db.prepare('INSERT INTO insight_suggestions (brand_id, job_id, kind, group_key, text, rule, evidence_json, table_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  db.exec('BEGIN');
  try {
    for (const x of items) st.run(brandId, jobId, x.kind, x.groupKey, x.text, x.rule, JSON.stringify(x.evidence), JSON.stringify(table));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** 가장 최근에 받은 제안 묶음 */
export function latestSuggestions(db: Db, brandId: number): StoredSuggestion[] {
  const last = db.prepare('SELECT job_id FROM insight_suggestions WHERE brand_id = ? ORDER BY id DESC LIMIT 1').get(brandId) as Row | undefined;
  if (!last) return [];
  return (db.prepare('SELECT * FROM insight_suggestions WHERE brand_id = ? AND job_id = ? ORDER BY id').all(brandId, String(last.job_id)) as Row[]).map(toSuggestion);
}

export function getSuggestion(db: Db, brandId: number, id: number): StoredSuggestion | null {
  const r = db.prepare('SELECT * FROM insight_suggestions WHERE id = ? AND brand_id = ?').get(id, brandId) as Row | undefined;
  return r ? toSuggestion(r) : null;
}

export function decideSuggestion(db: Db, id: number, d: { status: 'accepted' | 'rejected'; profileId: number | null; expiresAt: string | null }): void {
  db.prepare("UPDATE insight_suggestions SET status = ?, profile_id = ?, expires_at = ?, decided_at = datetime('now') WHERE id = ? AND status = 'pending'").run(
    d.status,
    d.profileId,
    d.expiresAt,
    id,
  );
}

export function acceptedSuggestions(db: Db, brandId: number): StoredSuggestion[] {
  return (db.prepare("SELECT * FROM insight_suggestions WHERE brand_id = ? AND status = 'accepted' ORDER BY decided_at DESC, id DESC").all(brandId) as Row[]).map(toSuggestion);
}

/** 세트마다 표지 제목 · 축 — 묶음(축 · 제목 유형)을 정하려고 */
export function setMeta(db: Db, brandId: number): Map<number, { title: string | null; pillarId: string | null; createdAt: string }> {
  const rows = db
    .prepare('SELECT s.id, s.pillar_id, s.created_at, c.content_json FROM card_sets s LEFT JOIN cards c ON c.set_id = s.id AND c.idx = 0 WHERE s.brand_id = ? ORDER BY s.id')
    .all(brandId) as Row[];
  return new Map(
    rows.map((r) => {
      let title: string | null;
      try {
        const h = (JSON.parse(String(r.content_json)) as { headline?: unknown }).headline;
        title = typeof h === 'string' && h.trim() ? h : null;
      } catch {
        title = null;
      }
      return [Number(r.id), { title, pillarId: s(r.pillar_id), createdAt: String(r.created_at) }];
    }),
  );
}
