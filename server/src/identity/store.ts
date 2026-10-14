// 정체성 세션·인터뷰·프로필의 DB 읽기/쓰기. SQL 은 이 파일에만 둔다.
import type { Db } from '../db/index.ts';
import type { AnswerKind, TurnLike } from './sources.ts';
import type { SurveyAnswers } from './survey.ts';
import type { ProfileContent, VersionReason } from './model.ts';
import type { Followup } from './followup.ts';

export type SessionStatus = 'interview' | 'ready' | 'profiled';
export interface SessionNote {
  kind: 'needs_more' | 'failed';
  message: string;
  missing: string[];
}

export interface Turn extends TurnLike {
  why: string | null;
  examples: string[];
  options: string[];
  target: string | null;
}

export interface SavedProfile extends ProfileContent {
  id: number;
  version: number;
  /** 이 판이 왜 생겼는가 */
  reason: VersionReason;
  /** 이 판이 나온 판 (수정·다른 방향·되돌리기) */
  basedOn: number | null;
  sessionId: number | null;
  createdAt: string;
  confirmedAt: string | null;
}

export interface SessionState {
  id: number;
  status: SessionStatus;
  survey: SurveyAnswers;
  note: SessionNote | null;
  turns: Turn[];
  profile: SavedProfile | null;
  activeProfileId: number | null;
}

type Row = Record<string, unknown>;
const json = <T>(v: unknown): T => JSON.parse(String(v)) as T;

export function createSession(db: Db, brandId: number, survey: SurveyAnswers): number {
  const r = db.prepare("INSERT INTO identity_sessions (brand_id, survey_json, status) VALUES (?, ?, 'interview')").run(brandId, JSON.stringify(survey));
  return Number(r.lastInsertRowid);
}

export function latestSessionId(db: Db, brandId: number): number | null {
  const row = db.prepare('SELECT id FROM identity_sessions WHERE brand_id = ? ORDER BY id DESC LIMIT 1').get(brandId) as Row | undefined;
  return row ? Number(row.id) : null;
}

export function sessionBrand(db: Db, sessionId: number): number | null {
  const row = db.prepare('SELECT brand_id FROM identity_sessions WHERE id = ?').get(sessionId) as Row | undefined;
  return row ? Number(row.brand_id) : null;
}

export function listTurns(db: Db, sessionId: number): Turn[] {
  const rows = db.prepare('SELECT * FROM interview_turns WHERE session_id = ? ORDER BY turn_no').all(sessionId) as Row[];
  return rows.map((r) => ({
    turnNo: Number(r.turn_no),
    question: String(r.question),
    why: (r.why as string | null) ?? null,
    examples: json<string[]>(r.examples_json),
    options: json<string[]>(r.options_json),
    target: (r.target as string | null) ?? null,
    answer: (r.answer as string | null) ?? null,
    answerKind: (r.answer_kind as AnswerKind | null) ?? null,
  }));
}

export function addTurn(db: Db, sessionId: number, f: Followup, jobId: string): number {
  const next = listTurns(db, sessionId).length + 1;
  db.prepare(
    'INSERT INTO interview_turns (session_id, turn_no, question, why, examples_json, options_json, target, job_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(sessionId, next, f.question, f.why, JSON.stringify(f.examples), JSON.stringify(f.options), f.target, jobId);
  return next;
}

/** 고정 질문(테스트 세트)처럼 질문과 답을 한 번에 넣는다 */
export function addAnsweredTurn(db: Db, sessionId: number, question: string, answer: string, kind: AnswerKind): void {
  const next = listTurns(db, sessionId).length + 1;
  db.prepare(
    "INSERT INTO interview_turns (session_id, turn_no, question, examples_json, options_json, answer, answer_kind, answered_at) VALUES (?, ?, ?, '[]', '[]', ?, ?, datetime('now'))",
  ).run(sessionId, next, question, answer, kind);
}

export function saveAnswer(db: Db, sessionId: number, turnNo: number, answer: string, kind: AnswerKind): void {
  db.prepare("UPDATE interview_turns SET answer = ?, answer_kind = ?, answered_at = datetime('now') WHERE session_id = ? AND turn_no = ?").run(
    answer,
    kind,
    sessionId,
    turnNo,
  );
}

export function setStatus(db: Db, sessionId: number, status: SessionStatus, note: SessionNote | null = null): void {
  db.prepare("UPDATE identity_sessions SET status = ?, note_json = ?, updated_at = datetime('now') WHERE id = ?").run(
    status,
    note ? JSON.stringify(note) : null,
    sessionId,
  );
}

/**
 * 판 하나를 저장한다. 판 번호 계산과 저장 사이에 다른 저장이 끼지 않게 한 번에(트랜잭션).
 * activate 면 저장과 함께 브랜드의 활성 판으로 바꾼다 — 사용자가 명시적으로 고른 판(수정·다른 방향·되돌리기)은 바로 활성 (결정 2026-10-14)
 */
export function saveProfileVersion(
  db: Db,
  brandId: number,
  content: ProfileContent,
  opts: { reason: VersionReason; sessionId: number | null; basedOn: number | null; jobId: string | null; activate: boolean },
): number {
  db.exec('BEGIN');
  try {
    const row = db.prepare('SELECT COALESCE(MAX(version), 0) AS v FROM brand_profiles WHERE brand_id = ?').get(brandId) as Row;
    const r = db
      .prepare(
        `INSERT INTO brand_profiles (brand_id, session_id, version, account_line, account_line_origin, audience, audience_origin, pillars_json, dropped_json,
           voice_rules_json, avoid_json, unknown_json, presence_json, reason, based_on, job_id, confirmed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${opts.activate ? "datetime('now')" : 'NULL'})`,
      )
      .run(
        brandId,
        opts.sessionId,
        Number(row.v) + 1,
        content.accountLine,
        content.accountLineOrigin,
        content.audience,
        content.audienceOrigin,
        JSON.stringify(content.pillars),
        JSON.stringify(content.dropped),
        JSON.stringify(content.voiceRules),
        JSON.stringify(content.avoid),
        JSON.stringify(content.unknown),
        content.presence ? JSON.stringify(content.presence) : null,
        opts.reason,
        opts.basedOn,
        opts.jobId,
      );
    const id = Number(r.lastInsertRowid);
    if (opts.activate) db.prepare('UPDATE brands SET active_profile_id = ? WHERE id = ?').run(id, brandId);
    db.exec('COMMIT');
    return id;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function toProfile(r: Row): SavedProfile {
  return {
    id: Number(r.id),
    version: Number(r.version),
    reason: r.reason as VersionReason,
    basedOn: r.based_on == null ? null : Number(r.based_on),
    sessionId: r.session_id == null ? null : Number(r.session_id),
    accountLine: String(r.account_line),
    accountLineOrigin: r.account_line_origin as ProfileContent['accountLineOrigin'],
    audience: String(r.audience),
    audienceOrigin: r.audience_origin as ProfileContent['audienceOrigin'],
    pillars: json(r.pillars_json),
    dropped: json(r.dropped_json),
    voiceRules: json(r.voice_rules_json),
    avoid: json(r.avoid_json),
    unknown: json(r.unknown_json),
    presence: r.presence_json ? json(r.presence_json) : null,
    createdAt: String(r.created_at),
    confirmedAt: (r.confirmed_at as string | null) ?? null,
  };
}

export function getProfile(db: Db, profileId: number): (SavedProfile & { brandId: number }) | null {
  const r = db.prepare('SELECT * FROM brand_profiles WHERE id = ?').get(profileId) as Row | undefined;
  return r ? { ...toProfile(r), brandId: Number(r.brand_id) } : null;
}

export function activeProfile(db: Db, brandId: number): SavedProfile | null {
  const b = db.prepare('SELECT active_profile_id FROM brands WHERE id = ?').get(brandId) as Row | undefined;
  if (!b || b.active_profile_id == null) return null;
  return getProfile(db, Number(b.active_profile_id));
}

/** 브랜드의 판 목록 (새 판이 위). 이력 화면용 */
export function listProfiles(db: Db, brandId: number): SavedProfile[] {
  return (db.prepare('SELECT * FROM brand_profiles WHERE brand_id = ? ORDER BY version DESC').all(brandId) as Row[]).map(toProfile);
}

export function confirmProfile(db: Db, profileId: number): boolean {
  const row = db.prepare('SELECT brand_id FROM brand_profiles WHERE id = ?').get(profileId) as Row | undefined;
  if (!row) return false;
  db.exec('BEGIN');
  try {
    db.prepare("UPDATE brand_profiles SET confirmed_at = COALESCE(confirmed_at, datetime('now')) WHERE id = ?").run(profileId);
    db.prepare('UPDATE brands SET active_profile_id = ? WHERE id = ?').run(profileId, Number(row.brand_id));
    db.exec('COMMIT');
    return true;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getSessionState(db: Db, sessionId: number): SessionState | null {
  const s = db.prepare('SELECT * FROM identity_sessions WHERE id = ?').get(sessionId) as Row | undefined;
  if (!s) return null;
  const p = db.prepare('SELECT * FROM brand_profiles WHERE session_id = ? ORDER BY version DESC LIMIT 1').get(sessionId) as Row | undefined;
  const b = db.prepare('SELECT active_profile_id FROM brands WHERE id = ?').get(Number(s.brand_id)) as Row | undefined;
  return {
    id: Number(s.id),
    status: s.status as SessionStatus,
    survey: json(s.survey_json),
    note: s.note_json ? json(s.note_json) : null,
    turns: listTurns(db, sessionId),
    profile: p ? toProfile(p) : null,
    activeProfileId: b?.active_profile_id == null ? null : Number(b.active_profile_id),
  };
}
