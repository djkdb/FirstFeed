// 업로드 준비(FR-PB-1) 읽기/쓰기 — 최소 캡션 · 만든 업로드 폴더. SQL 은 이 파일에만
import type { Db } from '../db/index.ts';
import type { GlossMark } from '../cards/store.ts';

type Row = Record<string, unknown>;

export interface Caption {
  setId: number;
  hook: string;
  lines: string[];
  hashtags: string[];
  glosses: GlossMark[];
  edited: boolean;
  createdAt: string;
}

const toCaption = (r: Row): Caption => ({
  setId: Number(r.set_id),
  hook: String(r.hook),
  lines: JSON.parse(String(r.lines_json)) as string[],
  hashtags: JSON.parse(String(r.hashtags_json)) as string[],
  glosses: JSON.parse(String(r.glosses_json)) as GlossMark[],
  edited: Number(r.edited) === 1,
  createdAt: String(r.created_at),
});

export function getCaption(db: Db, setId: number): Caption | null {
  const r = db.prepare('SELECT * FROM captions WHERE set_id = ?').get(setId) as Row | undefined;
  return r ? toCaption(r) : null;
}

/** 세트마다 하나 — 다시 만들거나 고치면 바꾼다 */
export function saveCaption(db: Db, c: Omit<Caption, 'createdAt'>, jobId: string | null): void {
  db.prepare(
    `INSERT INTO captions (set_id, hook, lines_json, hashtags_json, glosses_json, edited, job_id) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(set_id) DO UPDATE SET hook = excluded.hook, lines_json = excluded.lines_json, hashtags_json = excluded.hashtags_json,
       glosses_json = excluded.glosses_json, edited = excluded.edited, job_id = excluded.job_id, created_at = datetime('now')`,
  ).run(c.setId, c.hook, JSON.stringify(c.lines), JSON.stringify(c.hashtags), JSON.stringify(c.glosses), c.edited ? 1 : 0, jobId);
}

export function updateCaptionGlosses(db: Db, setId: number, glosses: GlossMark[]): void {
  db.prepare('UPDATE captions SET glosses_json = ? WHERE set_id = ?').run(JSON.stringify(glosses), setId);
}

/** 캡션 글 한 덩어리: 첫 줄 · 빈 줄 · 핵심 줄들 · 빈 줄 · 해시태그 */
export const captionText = (c: Pick<Caption, 'hook' | 'lines' | 'hashtags'>) => [c.hook, '', ...c.lines, ...(c.hashtags.length ? ['', c.hashtags.join(' ')] : [])].join('\n');

export interface ExportRow {
  id: number;
  setId: number;
  path: string;
  files: number;
  createdAt: string;
}

export function addExport(db: Db, setId: number, dir: string, files: number): number {
  return Number(db.prepare('INSERT INTO exports (set_id, path, files) VALUES (?, ?, ?)').run(setId, dir, files).lastInsertRowid);
}

export function getExport(db: Db, id: number): ExportRow | null {
  const r = db.prepare('SELECT * FROM exports WHERE id = ?').get(id) as Row | undefined;
  return r ? { id: Number(r.id), setId: Number(r.set_id), path: String(r.path), files: Number(r.files), createdAt: String(r.created_at) } : null;
}

export function listExports(db: Db, setId: number): ExportRow[] {
  return (db.prepare('SELECT * FROM exports WHERE set_id = ? ORDER BY id DESC').all(setId) as Row[]).map((r) => ({
    id: Number(r.id),
    setId: Number(r.set_id),
    path: String(r.path),
    files: Number(r.files),
    createdAt: String(r.created_at),
  }));
}
