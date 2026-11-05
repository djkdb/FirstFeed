// 작업 콘솔 (사용자 지시 2026-11-05 — insta_auto 의 오른쪽 「작업 콘솔」처럼). 어느 화면에서 무엇을 했는지 한 줄씩 시간순으로.
// 새 기록을 따로 쌓지 않고 이미 있는 표(ai_runs · 프로필 · 템플릿 · 세트 · 업로드 폴더 · 계획 · 채팅)에서 읽는다 —
// 기록이 두 군데면 서로 어긋나서. AI 작업이 결과물을 남겼으면 두 줄로 나누지 않고 그 작업 줄에 결과를 붙인다
import type { Db } from '../db/index.ts';
import type { JobPhase, JobStore } from '../ai/jobs.ts';

/** needs_edit: 다 만들었지만 넘친 칸을 사람이 줄여야 저장된다(결정 2026-10-15) */
export type FeedStatus = 'done' | 'failed' | 'cancelled' | 'blocked' | 'needs_edit';
export interface FeedItem {
  /** 화면 key — 종류 + 원래 id */
  key: string;
  /** ai: AI 작업 · 나머지: AI 없이 한 일 */
  kind: 'ai' | 'template' | 'export' | 'chat_apply';
  /** AI 작업이면 과제 이름(identity_profile …) — 화면이 사람 말로 바꾼다 */
  task: string | null;
  /** DB 시각(UTC, 시간대 표시 없음) — 화면이 localTime 으로 */
  at: string;
  status: FeedStatus;
  title: string;
  detail: string | null;
  /** 누르면 갈 화면 */
  href: string | null;
  ai: {
    calls: number;
    rewrites: number;
    durationMs: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    reasons: string[];
  } | null;
}

interface RunAgg {
  job_id: string;
  task: string;
  started: string;
  calls: number;
  rewrites: number;
  duration: number | null;
  input: number | null;
  input_known: number | null;
  output: number | null;
  last_status: string;
}

const RESULT_HREF: Record<string, string> = {
  identity_profile: '#/identity',
  identity_followup: '#/identity',
  identity_alternatives: '#/identity',
  brand_words: '#/brand',
  brand_visual: '#/brand',
  series_plan: '#/preview',
  cover_titles: '#/make',
  card_body: '#/make',
  card_chat: '#/make',
  caption_min: '#/make',
  smoke_extract: '#/check',
};

/** ai_runs 는 ISO(…T…Z), 다른 표는 SQLite datetime('now')(UTC, 공백) — 한 줄로 정렬하려고 같은 모양으로 맞춘다 */
export function dbTime(t: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(t);
  return m ? `${m[1]} ${m[2]}` : t;
}

/**
 * 작업이 예외 없이 끝나도 결과가 실패일 수 있다 — 루프가 재작성 한도를 다 쓰면 { ok: false } 나 { status: 'failed' } 를 돌려준다.
 * 처음엔 phase 만 봐서 끝까지 규칙에 걸린 작업이 「완료」로 보였다(작업 콘솔 시뮬레이션 2026-11-05 에서 발견)
 */
export function outcomeOf(result: unknown): { status: FeedStatus; message: string | null } {
  if (result && typeof result === 'object') {
    const r = result as { ok?: unknown; status?: unknown; errors?: unknown; error?: unknown };
    const first = Array.isArray(r.errors) && r.errors.length ? r.errors[0] : null;
    const msg = typeof first === 'string' ? first : first && typeof first === 'object' && 'message' in first ? String((first as { message: unknown }).message) : null;
    if (r.ok === false || r.status === 'failed') return { status: 'failed', message: msg ?? (typeof r.error === 'string' ? r.error : null) };
    if (r.status === 'needs_edit') return { status: 'needs_edit', message: '넘친 칸이 있어요 — 직접 줄이면 저장돼요' };
  }
  return { status: 'done', message: null };
}

function lastStatusToPhase(s: string): FeedStatus {
  if (s === 'ok') return 'done';
  if (s === 'cancelled') return 'cancelled';
  if (s === 'blocked') return 'blocked';
  return 'failed';
}

/** 걸린 이유(규칙 · 자기 평가) 문장 — 재작성이 있었던 작업만, 앞 3개 */
function reasonsOf(db: Db, jobId: string): string[] {
  const rows = db.prepare("SELECT issues_json FROM ai_runs WHERE job_id = ? AND issues_json IS NOT NULL AND issues_json != '[]' ORDER BY id").all(jobId) as Array<{ issues_json: string }>;
  const out: string[] = [];
  for (const r of rows) {
    try {
      for (const i of JSON.parse(r.issues_json) as Array<{
        level?: string;
        message?: string;
      }>) {
        if (i.level === 'error' && i.message && !out.includes(i.message)) out.push(i.message);
      }
    } catch {
      /* 깨진 기록은 건너뛴다 */
    }
  }
  return out.slice(0, 3);
}

/**
 * 단계마다 끝냈는가 — 처음 쓰는 사람이 왼쪽 메뉴에서 「지금 어디까지 했나」를 보게.
 * 기준은 각 단계가 다음 단계에 넘겨주는 것: 정체성 = 적용 중인 프로필, 브랜드 = 아이디 · 팔레트를 고름, 템플릿 = 고정한 판, 만들기 = 세트 하나 이상
 */
export function progressOf(db: Db, brandId: number): { identity: boolean; brand: boolean; template: boolean; make: boolean } {
  const one = (sql: string) => db.prepare(sql).get(brandId) != null;
  return {
    identity: one('SELECT 1 FROM brands WHERE id = ? AND active_profile_id IS NOT NULL'),
    brand: one('SELECT 1 FROM brand_kit_selections WHERE id = (SELECT MAX(id) FROM brand_kit_selections WHERE brand_id = ?) AND handle IS NOT NULL AND palette_json IS NOT NULL'),
    template: one('SELECT 1 FROM template_versions WHERE brand_id = ? LIMIT 1'),
    make: one('SELECT 1 FROM card_sets WHERE brand_id = ? LIMIT 1'),
  };
}

export function consoleFeed(db: Db, jobs: JobStore, brandId: number, limit = 30): { running: ReturnType<JobStore['running']>; items: FeedItem[]; progress: ReturnType<typeof progressOf> } {
  const running = jobs.running();
  const runningIds = new Set(running.map((r) => r.jobId));

  // AI 작업 — 같은 job_id 의 호출을 묶는다. 진행 중인 것은 위 running 에서 따로 보인다
  const aggs = db
    .prepare(
      `SELECT job_id, (SELECT task FROM ai_runs f WHERE f.job_id = a.job_id ORDER BY id LIMIT 1) AS task, MIN(started_at) AS started, COUNT(*) AS calls,
              SUM(CASE WHEN kind = 'rewrite' THEN 1 ELSE 0 END) AS rewrites,
              SUM(duration_ms) AS duration, SUM(COALESCE(input_tokens, 0) + COALESCE(cache_creation_tokens, 0) + COALESCE(cache_read_tokens, 0)) AS input, SUM(input_tokens) AS input_known, SUM(output_tokens) AS output,
              (SELECT status FROM ai_runs b WHERE b.job_id = a.job_id ORDER BY id DESC LIMIT 1) AS last_status
       FROM ai_runs a GROUP BY job_id ORDER BY MAX(id) DESC LIMIT ?`,
    )
    .all(limit) as unknown as RunAgg[];

  // 결과물 — job_id 로 AI 작업 줄에 붙인다
  const results = new Map<string, { title: string; href: string }>();
  const add = (jobId: unknown, title: string, href: string) => {
    if (typeof jobId === 'string' && jobId) results.set(jobId, { title, href });
  };
  for (const r of db.prepare('SELECT job_id, version FROM brand_profiles WHERE brand_id = ? AND job_id IS NOT NULL').all(brandId) as Array<Record<string, unknown>>)
    add(r.job_id, `정체성 프로필 ${String(r.version)}판`, '#/identity');
  for (const r of db.prepare('SELECT s.id, s.body_job_id, s.body_count, c.content_json FROM card_sets s LEFT JOIN cards c ON c.set_id = s.id AND c.idx = 0 WHERE s.brand_id = ?').all(brandId) as Array<
    Record<string, unknown>
  >) {
    let headline = '';
    try {
      headline = String((JSON.parse(String(r.content_json)) as { headline?: string }).headline ?? '')
        .replace(/\*\*/g, '')
        .replace(/\n/g, ' ');
    } catch {
      /* 표지 없음 */
    }
    add(r.body_job_id, `카드뉴스 #${String(r.id)}${headline ? ` · ${headline}` : ''} (본문 ${String(r.body_count)}장)`, `#/make?set=${String(r.id)}`);
  }
  for (const r of db.prepare('SELECT id, job_id FROM series_plans WHERE brand_id = ? AND job_id IS NOT NULL').all(brandId) as Array<Record<string, unknown>>)
    add(r.job_id, '첫 9개 게시물 계획', '#/preview');
  for (const r of db.prepare('SELECT c.set_id, c.job_id FROM captions c').all() as Array<Record<string, unknown>>)
    add(r.job_id, `카드뉴스 #${String(r.set_id)} 캡션`, `#/make?set=${String(r.set_id)}`);
  const CHAT_STATUS: Record<string, string> = { proposed: '적용 전', applied: '적용함', discarded: '버림', reverted: '되돌림', failed: '못 고침' };
  for (const r of db.prepare('SELECT set_id, job_id, status, message FROM card_chat WHERE job_id IS NOT NULL').all() as Array<Record<string, unknown>>)
    add(r.job_id, `카드뉴스 #${String(r.set_id)} · 「${String(r.message).slice(0, 40)}」 → ${CHAT_STATUS[String(r.status)] ?? String(r.status)}`, `#/make?set=${String(r.set_id)}`);

  const items: FeedItem[] = [];
  for (const a of aggs) {
    if (runningIds.has(a.job_id)) continue;
    const mem = jobs.phaseOf(a.job_id);
    let status: FeedStatus = mem && mem.phase !== 'running' ? (mem.phase as Exclude<JobPhase, 'running'>) : lastStatusToPhase(a.last_status);
    let message = status === 'failed' ? (mem?.error?.message ?? null) : null;
    if (mem?.phase === 'done') ({ status, message } = outcomeOf(mem.result));
    const res = results.get(a.job_id);
    items.push({
      key: `ai:${a.job_id}`,
      kind: 'ai',
      task: a.task,
      at: dbTime(a.started),
      status,
      title: res?.title ?? '',
      detail: message,
      href: res?.href ?? RESULT_HREF[a.task] ?? null,
      ai: {
        calls: Number(a.calls),
        rewrites: Number(a.rewrites),
        durationMs: a.duration == null ? null : Number(a.duration),
        inputTokens: a.input_known == null ? null : Number(a.input),
        outputTokens: a.output == null ? null : Number(a.output),
        reasons: Number(a.rewrites) > 0 || status === 'failed' ? reasonsOf(db, a.job_id) : [],
      },
    });
  }

  // AI 없이 한 일
  for (const r of db.prepare('SELECT id, version, draft_id, created_at FROM template_versions WHERE brand_id = ? ORDER BY id DESC LIMIT ?').all(brandId, limit) as Array<Record<string, unknown>>)
    items.push({
      key: `tpl:${String(r.id)}`,
      kind: 'template',
      task: null,
      at: String(r.created_at),
      status: 'done',
      title: `템플릿 고정 · 시안 ${String(r.draft_id)} ${String(r.version)}판`,
      detail: null,
      href: '#/template',
      ai: null,
    });
  for (const r of db.prepare('SELECT e.id, e.set_id, e.path, e.files, e.created_at FROM exports e ORDER BY e.id DESC LIMIT ?').all(limit) as Array<Record<string, unknown>>)
    items.push({
      key: `exp:${String(r.id)}`,
      kind: 'export',
      task: null,
      at: String(r.created_at),
      status: 'done',
      title: `업로드 폴더 · 카드뉴스 #${String(r.set_id)} · ${String(r.files)}개 파일`,
      detail: String(r.path),
      href: `#/make?set=${String(r.set_id)}`,
      ai: null,
    });
  // 채팅 제안을 적용한 것 — 보통은 그 AI 작업 줄에 「→ 적용함」으로 붙고, 작업 ID 가 없는 옛 기록만 따로. 적용 시각은 따로 없어서 제안 시각으로(알려진 한계)
  for (const r of db.prepare("SELECT id, set_id, message, created_at FROM card_chat WHERE status = 'applied' AND job_id IS NULL ORDER BY id DESC LIMIT ?").all(limit) as Array<Record<string, unknown>>)
    items.push({
      key: `chat:${String(r.id)}`,
      kind: 'chat_apply',
      task: null,
      at: String(r.created_at),
      status: 'done',
      title: `채팅으로 고친 것 적용 · 카드뉴스 #${String(r.set_id)}`,
      detail: String(r.message),
      href: `#/make?set=${String(r.set_id)}`,
      ai: null,
    });

  items.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
  return { running, items: items.slice(0, limit), progress: progressOf(db, brandId) };
}
