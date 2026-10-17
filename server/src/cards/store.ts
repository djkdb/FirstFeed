// 소재·카드 세트 읽기/쓰기. SQL 은 이 파일에만 둔다. PNG 는 데이터 폴더(data/renders/set-<id>/)에
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from '../db/index.ts';
import type { FrameContent } from '../templates/types.ts';

/** 소재 밖 용어 풀이·비유 문장 표시 (결정 2026-10-15) */
export interface GlossMark {
  sentence: string;
  term: string;
  /** 사용자가 「확인했어요」를 누른 때 (결정 2026-10-18 — 모두 확인하기 전엔 업로드 폴더를 만들 수 없다) */
  checkedAt?: string | null;
}

type Row = Record<string, unknown>;

export interface Source {
  id: number;
  brandId: number;
  title: string | null;
  body: string;
  memo: string | null;
  createdAt: string;
}

export function addSource(db: Db, brandId: number, body: string, title: string | null, memo: string | null): number {
  return Number(db.prepare('INSERT INTO sources (brand_id, title, body, memo) VALUES (?, ?, ?, ?)').run(brandId, title, body, memo).lastInsertRowid);
}

const toSource = (r: Row): Source => ({
  id: Number(r.id),
  brandId: Number(r.brand_id),
  title: (r.title as string | null) ?? null,
  body: String(r.body),
  memo: (r.memo as string | null) ?? null,
  createdAt: String(r.created_at),
});

export function getSource(db: Db, id: number): Source | null {
  const r = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as Row | undefined;
  return r ? toSource(r) : null;
}

export interface CardToSave {
  kind: 'cover' | 'body' | 'closing';
  content: FrameContent;
  evidence: string | null;
  image: { prompt: string; filename: string } | null;
  glosses: GlossMark[];
  edited: boolean;
  png: Buffer;
  render: { browser: string; reference: boolean; scale: number };
}

export interface SetToSave {
  brandId: number;
  sourceId: number;
  profileId: number;
  templateVersionId: number;
  pillarId: string | null;
  edited: boolean;
  coverJobId: string | null;
  bodyJobId: string | null;
  cards: CardToSave[];
}

export const rendersDir = (dataDir: string, setId: number) => path.join(dataDir, 'renders', `set-${setId}`);

/** 세트 저장: DB 와 PNG 를 함께 — 하나라도 실패하면 둘 다 되돌린다(반쯤 저장된 세트가 남지 않게) */
export function saveSet(db: Db, dataDir: string, s: SetToSave): number {
  db.exec('BEGIN');
  let dir: string | null = null;
  try {
    const bodyCount = s.cards.filter((c) => c.kind === 'body').length;
    const setId = Number(
      db
        .prepare(
          'INSERT INTO card_sets (brand_id, source_id, profile_id, template_version_id, pillar_id, body_count, edited, cover_job_id, body_job_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(s.brandId, s.sourceId, s.profileId, s.templateVersionId, s.pillarId, bodyCount, s.edited ? 1 : 0, s.coverJobId, s.bodyJobId).lastInsertRowid,
    );
    dir = rendersDir(dataDir, setId);
    fs.mkdirSync(dir, { recursive: true });
    const ins = db.prepare('INSERT INTO cards (set_id, idx, kind, content_json, evidence, image_json, glosses_json, edited, png_file, render_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    s.cards.forEach((c, idx) => {
      const file = `${String(idx + 1).padStart(2, '0')}-${c.kind}.png`;
      fs.writeFileSync(path.join(dir!, file), c.png);
      ins.run(setId, idx, c.kind, JSON.stringify(c.content), c.evidence, c.image ? JSON.stringify(c.image) : null, JSON.stringify(c.glosses), c.edited ? 1 : 0, file, JSON.stringify(c.render));
    });
    db.exec('COMMIT');
    return setId;
  } catch (err) {
    db.exec('ROLLBACK');
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    throw err;
  }
}

export interface SavedCard {
  idx: number;
  kind: string;
  content: FrameContent;
  evidence: string | null;
  image: { prompt: string; filename: string } | null;
  /** 풀이 칸이 생기기 전(card_body v1)에 만든 세트는 null — 표시했는지 모른다 */
  glosses: GlossMark[] | null;
  edited: boolean;
  pngFile: string;
  render: { browser: string; reference: boolean; scale: number };
}

export function getSet(db: Db, id: number) {
  const r = db.prepare('SELECT * FROM card_sets WHERE id = ?').get(id) as Row | undefined;
  if (!r) return null;
  const cards = (db.prepare('SELECT * FROM cards WHERE set_id = ? ORDER BY idx').all(id) as Row[]).map(
    (c): SavedCard => ({
      idx: Number(c.idx),
      kind: String(c.kind),
      content: JSON.parse(String(c.content_json)) as FrameContent,
      evidence: (c.evidence as string | null) ?? null,
      image: c.image_json ? (JSON.parse(String(c.image_json)) as SavedCard['image']) : null,
      glosses: c.glosses_json ? (JSON.parse(String(c.glosses_json)) as GlossMark[]) : null,
      edited: Number(c.edited) === 1,
      pngFile: String(c.png_file),
      render: JSON.parse(String(c.render_json)) as SavedCard['render'],
    }),
  );
  return {
    id: Number(r.id),
    sourceId: Number(r.source_id),
    profileId: Number(r.profile_id),
    templateVersionId: Number(r.template_version_id),
    pillarId: (r.pillar_id as string | null) ?? null,
    bodyCount: Number(r.body_count),
    edited: Number(r.edited) === 1,
    /** 그림 바탕 표지에 올린 그림(data/brand-assets 안 이름) — 없으면 null */
    coverImage: (r.cover_image as string | null) ?? null,
    createdAt: String(r.created_at),
    cards,
  };
}

export function listSets(db: Db, brandId: number): Array<{ id: number; sourceId: number; bodyCount: number; createdAt: string; cover: string }> {
  return (
    db
      .prepare(
        `SELECT s.id, s.source_id, s.body_count, s.created_at, c.content_json FROM card_sets s JOIN cards c ON c.set_id = s.id AND c.idx = 0
         WHERE s.brand_id = ? ORDER BY s.id DESC`,
      )
      .all(brandId) as Row[]
  ).map((r) => ({
    id: Number(r.id),
    sourceId: Number(r.source_id),
    bodyCount: Number(r.body_count),
    createdAt: String(r.created_at),
    cover: (JSON.parse(String(r.content_json)) as { headline?: string }).headline ?? '',
  }));
}

/** 카드 한 장의 풀이 표시만 바꾼다 (확인 체크) */
export function updateCardGlosses(db: Db, setId: number, idx: number, glosses: GlossMark[]): void {
  db.prepare('UPDATE cards SET glosses_json = ? WHERE set_id = ? AND idx = ?').run(JSON.stringify(glosses), setId, idx);
}

/** 카드 한 장을 사용자가 고친 글로 바꾼다: 원고·PNG·렌더링 기록·풀이 표시를 함께. PNG 를 먼저 임시 파일로 써서 DB 와 어긋나지 않게 */
export function replaceCard(
  db: Db,
  dataDir: string,
  setId: number,
  idx: number,
  c: { content: FrameContent; png: Buffer; render: CardToSave['render']; glosses: GlossMark[] },
  /** 글을 사용자가 고쳤는가 — 그림만 바꿔 다시 그린 것은 「직접 고침」이 아니다 */
  edited = true,
): void {
  const row = db.prepare('SELECT png_file FROM cards WHERE set_id = ? AND idx = ?').get(setId, idx) as Row | undefined;
  if (!row) throw new Error(`카드를 찾지 못했습니다: 세트 ${setId} · ${idx}`);
  const file = path.join(rendersDir(dataDir, setId), String(row.png_file));
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, c.png);
  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE cards SET content_json = ?, glosses_json = ?, render_json = ?${edited ? ', edited = 1' : ''} WHERE set_id = ? AND idx = ?`).run(
      JSON.stringify(c.content),
      JSON.stringify(c.glosses),
      JSON.stringify(c.render),
      setId,
      idx,
    );
    if (edited) db.prepare('UPDATE card_sets SET edited = 1 WHERE id = ?').run(setId);
    fs.renameSync(tmp, file);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

export function setCoverImage(db: Db, setId: number, name: string): void {
  db.prepare('UPDATE card_sets SET cover_image = ? WHERE id = ?').run(name, setId);
}
