// 화면에서 시작한 AI 작업의 진행 상태. AI 호출은 수십 초~분이 걸리므로 요청 하나로 기다리지 않고,
// 작업 ID 를 먼저 돌려준 뒤 화면이 상태를 물어보게 한다(취소 버튼도 이 ID 로).
import type { AiService, JobContext } from './adapter.ts';
import { AiError } from './types.ts';

export type JobPhase = 'running' | 'done' | 'failed' | 'cancelled';

export interface JobState {
  jobId: string;
  task: string;
  phase: JobPhase;
  startedAt: string;
  finishedAt: string | null;
  result: unknown;
  error: { message: string; hint: string } | null;
}

export interface RunRow {
  attempt: number;
  task: string;
  kind: string;
  status: string;
  model: string | null;
  duration_ms: number | null;
  error: string | null;
  issues_json: string | null;
}

/** 끝난 작업은 이만큼만 기억한다 — 로컬 앱이 오래 켜져 있어도 메모리가 쌓이지 않게 */
const KEEP_FINISHED = 50;

export class JobStore {
  private readonly jobs = new Map<string, JobState>();
  private readonly ai: AiService;
  constructor(ai: AiService) {
    this.ai = ai;
  }

  start(task: string, fn: (job: JobContext) => Promise<unknown>): string {
    const job = this.ai.startJob();
    const state: JobState = { jobId: job.jobId, task, phase: 'running', startedAt: new Date().toISOString(), finishedAt: null, result: null, error: null };
    this.jobs.set(job.jobId, state);
    fn(job)
      .then((result) => {
        state.phase = 'done';
        state.result = result;
      })
      .catch((err: unknown) => {
        const e = err instanceof AiError ? err : null;
        state.phase = e?.kind === 'cancelled' ? 'cancelled' : 'failed';
        state.error = { message: e?.message ?? String(err), hint: e?.hint ?? '오류 내용을 확인한 뒤 다시 실행하세요.' };
      })
      .finally(() => {
        state.finishedAt = new Date().toISOString();
        this.ai.endJob(job);
        this.prune();
      });
    return job.jobId;
  }

  get(jobId: string): (JobState & { runs: RunRow[] }) | null {
    const state = this.jobs.get(jobId);
    if (!state) return null;
    const runs = this.ai.db
      .prepare('SELECT attempt, task, kind, status, model, duration_ms, error, issues_json FROM ai_runs WHERE job_id = ? ORDER BY id')
      .all(jobId) as unknown as RunRow[];
    return { ...state, runs };
  }

  cancel(jobId: string): boolean {
    return this.ai.cancel(jobId);
  }

  private prune(): void {
    const finished = [...this.jobs.values()].filter((j) => j.phase !== 'running');
    for (const j of finished.slice(0, Math.max(0, finished.length - KEEP_FINISHED))) this.jobs.delete(j.jobId);
  }
}
