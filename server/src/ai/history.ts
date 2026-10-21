// 재작성 기록 읽기 (중간 보고서 그림 1 · devlog 2026-10-21-04).
// 같은 작업(job_id)의 생성·재작성 시도를 차례로 짝지어 「무엇에 걸렸고, 다시 쓰며 어느 칸이 어떻게 바뀌었나」를 돌려준다.
// 출력은 loop.ts 가 걸린 시도와 그 다음 시도에만 남긴다(ai_runs.output_json). 출력 전체가 아니라 바뀐 잎 칸만 보인다.
import type { DatabaseSync } from 'node:sqlite';

export interface RewriteIssue {
  code: string;
  where: string | null;
  message: string;
  from: 'rule' | 'review';
}
export interface FieldChange {
  /** 예: cards.2.body */
  path: string;
  before: string | null;
  after: string | null;
}
export interface RewriteStep {
  task: string;
  /** 걸린 시도의 번호(작업 안에서 몇 번째 호출인지) */
  attempt: number;
  issues: RewriteIssue[];
  changes: FieldChange[];
  /** 다시 쓴 시도가 통과했는가(아니면 또 걸려 다음 단계가 있다) */
  passedAfter: boolean;
}

type Row = { task: string; attempt: number; kind: string; status: string; issues_json: string | null; output_json: string | null };

/** 한 단계에 보일 바뀐 칸 수 상한 — 카드 전체를 다시 쓴 경우 화면이 끝없이 길어지지 않게 */
export const MAX_CHANGES = 30;

export function rewriteHistory(db: DatabaseSync, jobId: string): RewriteStep[] {
  const rows = db
    .prepare("SELECT task, attempt, kind, status, issues_json, output_json FROM ai_runs WHERE job_id = ? AND kind IN ('generate', 'rewrite') ORDER BY attempt")
    .all(jobId) as Row[];
  const out: RewriteStep[] = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i]!;
    const b = rows[i + 1]!;
    if (a.status !== 'rule_error' || b.kind !== 'rewrite' || b.task !== a.task || a.output_json === null || b.output_json === null) continue;
    const issues = (JSON.parse(a.issues_json ?? '[]') as Array<{ level?: string; code: string; where?: string; message: string; from?: string }>)
      .filter((x) => x.level === 'error')
      .map((x) => ({ code: x.code, where: x.where ?? null, message: x.message, from: x.from === 'review' ? ('review' as const) : ('rule' as const) }));
    out.push({
      task: a.task,
      attempt: a.attempt,
      issues,
      changes: changedFields(JSON.parse(a.output_json), JSON.parse(b.output_json)).slice(0, MAX_CHANGES),
      passedAfter: b.status === 'ok',
    });
  }
  return out;
}

/** 두 JSON 의 잎 값(문자열·숫자·참거짓)을 경로로 펼쳐 다른 것만. 목록 길이가 달라 생긴 칸은 한쪽이 null */
export function changedFields(before: unknown, after: unknown): FieldChange[] {
  const a = flatten(before);
  const b = flatten(after);
  const paths = [...new Set([...a.keys(), ...b.keys()])];
  return paths.filter((p) => a.get(p) !== b.get(p)).map((p) => ({ path: p, before: a.get(p) ?? null, after: b.get(p) ?? null }));
}

function flatten(v: unknown, prefix = '', out = new Map<string, string>()): Map<string, string> {
  if (v === null || v === undefined) return out;
  if (Array.isArray(v)) v.forEach((x, i) => flatten(x, prefix ? `${prefix}.${i}` : String(i), out));
  else if (typeof v === 'object') for (const [k, x] of Object.entries(v)) flatten(x, prefix ? `${prefix}.${k}` : k, out);
  else out.set(prefix, String(v));
  return out;
}
