// AI 호출의 유일한 통로 (FR-AI-2).
// 요청 {task, prompt, schema, images, web, timeout} → 공급자 실행 → JSON 꺼내기 → 스키마 검증 → 실패하면 이유를 붙여 다시 요청.
// 동시 호출 수 제한·취소·호출 기록(ai_runs)도 여기서 한 번에 처리한다.
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSetting, modelForTask } from '../config.ts';
import type { Db } from '../db/index.ts';
import { extractJson, type ExtractVia } from './extract.ts';
import { loadPrompt } from './prompts.ts';
import { AiError, type AiProvider, type AiRequest } from './types.ts';
import { sleptNote, startStopwatch } from '../lib/sleep-clock.ts';

export type RunKind = 'generate' | 'json_retry' | 'rewrite' | 'review';
export type RunStatus = 'ok' | 'invalid_json' | 'schema_error' | 'rule_error' | 'failed' | 'timeout' | 'cancelled' | 'blocked';

/** 한 작업(생성 → 검증 → 재작성 묶음) 안에서 호출 순번을 이어 가기 위한 문맥 */
export interface JobContext {
  jobId: string;
  signal: AbortSignal;
  attempt: number;
}

export interface AiCallResult<T> {
  data: T;
  /** ai_runs 의 줄 번호 — 규칙 검증 결과를 이 줄에 덧붙인다 */
  runId: number;
  jobId: string;
  model: string;
  via: ExtractVia;
  durationMs: number;
}

/** 동시 실행 수 제한. 한도는 매번 설정에서 읽는다 — 사용자가 설정을 바꾸면 다음 호출부터 적용되게 */
class Limiter {
  private running = 0;
  private readonly waiting: Array<{ resolve: () => void; reject: (e: unknown) => void; signal: AbortSignal; onAbort: () => void }> = [];
  private readonly limit: () => number;
  constructor(limit: () => number) {
    this.limit = limit;
  }

  acquire(signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.reject(cancelledError());
    if (this.running < Math.max(1, this.limit())) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const entry = {
        resolve,
        reject,
        signal,
        onAbort: () => {
          // 기다리는 중에 취소되면 줄에서 빠진다
          const i = this.waiting.indexOf(entry);
          if (i >= 0) this.waiting.splice(i, 1);
          reject(cancelledError());
        },
      };
      signal.addEventListener('abort', entry.onAbort, { once: true });
      this.waiting.push(entry);
    });
  }

  release(): void {
    const next = this.waiting.shift();
    if (next) {
      next.signal.removeEventListener('abort', next.onAbort);
      next.resolve(); // 자리를 그대로 넘긴다 (running 수는 그대로)
    } else {
      this.running--;
    }
  }

  get stats() {
    return { running: this.running, waiting: this.waiting.length };
  }
}

function cancelledError(): AiError {
  return new AiError('cancelled', 'AI 호출을 취소했습니다.', '필요하면 다시 실행하세요.');
}

function statusOf(err: AiError): RunStatus {
  switch (err.kind) {
    case 'timeout':
      return 'timeout';
    case 'cancelled':
      return 'cancelled';
    case 'invalid_json':
      return 'invalid_json';
    case 'schema_error':
      return 'schema_error';
    case 'not_subscription':
      return 'blocked';
    default:
      return 'failed';
  }
}

/** 스키마 오류를 AI 와 사람이 둘 다 읽을 수 있게 짧게 정리한다 */
function describeZodError(err: z.ZodError): string {
  return err.issues
    .slice(0, 8)
    .map((i) => `- ${i.path.length ? i.path.join('.') : '(전체)'}: ${i.message}`)
    .join('\n');
}

export interface AiServiceDeps {
  db: Db;
  provider: AiProvider;
}

export class AiService {
  readonly db: Db;
  private readonly provider: AiProvider;
  private readonly limiter: Limiter;
  private readonly jobs = new Map<string, AbortController>();

  constructor(deps: AiServiceDeps) {
    this.db = deps.db;
    this.provider = deps.provider;
    this.limiter = new Limiter(() => getSetting(this.db, 'ai.concurrency'));
  }

  /** 새 작업을 연다. 돌려받은 jobId 로 cancel() 할 수 있다 */
  startJob(outer?: AbortSignal): JobContext {
    const jobId = randomUUID();
    const ac = new AbortController();
    this.jobs.set(jobId, ac);
    const signal = outer ? AbortSignal.any([outer, ac.signal]) : ac.signal;
    return { jobId, signal, attempt: 0 };
  }

  endJob(job: JobContext): void {
    this.jobs.delete(job.jobId);
  }

  /** 실행 중이거나 차례를 기다리는 작업을 취소한다. 실행 중인 CLI 프로세스는 끝내고 ai_runs 에 cancelled 로 남는다 */
  cancel(jobId: string): boolean {
    const ac = this.jobs.get(jobId);
    if (!ac) return false;
    ac.abort();
    return true;
  }

  get queue() {
    return this.limiter.stats;
  }

  /**
   * AI 를 한 번 부르고 스키마를 통과한 JSON 을 돌려준다.
   * JSON 이 깨졌거나 스키마에 맞지 않으면 그 이유를 붙여 설정값(ai.maxJsonRetries)만큼 다시 요청한다.
   * 규칙 검증·재작성은 이 위의 loop.ts 가 맡는다.
   */
  async call<T>(req: AiRequest<T>, job?: JobContext, kind: RunKind = 'generate'): Promise<AiCallResult<T>> {
    const ownJob = job === undefined;
    const ctx = job ?? this.startJob(req.signal);
    const model = modelForTask(this.db, req.task);
    const effort = req.effort ?? getSetting(this.db, 'ai.taskEffort')[req.task];
    const timeoutMs =
      req.timeoutMs ?? (req.web ? getSetting(this.db, 'ai.webTimeoutMs') : (getSetting(this.db, 'ai.taskTimeoutsMs')[req.task] ?? getSetting(this.db, 'ai.timeoutMs')));
    const maxRetries = getSetting(this.db, 'ai.maxJsonRetries');
    const jsonSchema = toCliSchema(req.schema);

    try {
      let lastError = '';
      let lastKind: 'invalid_json' | 'schema_error' = 'invalid_json';
      for (let retry = 0; retry <= maxRetries; retry++) {
        const runKind: RunKind = retry === 0 ? kind : 'json_retry';
        const prompt = retry === 0 ? req.prompt : `${req.prompt}\n\n${loadPrompt(this.db, '_system/json_retry', { error: lastError }).text}`;
        ctx.attempt++;
        const startedAt = new Date().toISOString();
        const sw = startStopwatch();
        const base = { job: ctx, task: req.task, model, kind: runKind, startedAt, promptRef: req.promptRef };

        try {
          await this.limiter.acquire(ctx.signal);
        } catch (err) {
          this.log({ ...base, status: 'cancelled', error: '차례를 기다리는 중에 취소됨', durationMs: 0 });
          throw err;
        }
        let out;
        try {
          out = await this.provider.run({
            prompt,
            jsonSchema,
            model,
            ...(effort ? { effort } : {}),
            images: req.images ?? [],
            web: req.web ?? false,
            timeoutMs,
            signal: ctx.signal,
          });
        } catch (err) {
          const e = err instanceof AiError ? err : new AiError('cli_failed', String(err), '오류 내용을 확인한 뒤 다시 실행하세요.', { cause: err });
          this.log({ ...base, status: statusOf(e), error: e.message, durationMs: sw.wallMs(), sleptMs: sw.sleptMs() });
          throw e;
        } finally {
          this.limiter.release();
        }

        const usedModel = out.model ?? model;
        const extracted = extractJson(out.structured, out.text);
        if (!extracted.ok) {
          lastError = extracted.error;
          lastKind = 'invalid_json';
          this.log({ ...base, model: usedModel, status: 'invalid_json', error: lastError, durationMs: out.durationMs, sleptMs: sw.sleptMs() });
          continue;
        }
        const parsed = req.schema.safeParse(extracted.value);
        if (!parsed.success) {
          lastError = `스키마에 맞지 않음:\n${describeZodError(parsed.error)}`;
          lastKind = 'schema_error';
          this.log({ ...base, model: usedModel, status: 'schema_error', error: lastError, durationMs: out.durationMs, sleptMs: sw.sleptMs() });
          continue;
        }
        const runId = this.log({ ...base, model: usedModel, status: 'ok', error: null, durationMs: out.durationMs, sleptMs: sw.sleptMs() });
        return { data: parsed.data, runId, jobId: ctx.jobId, model: usedModel, via: extracted.via, durationMs: out.durationMs };
      }
      throw new AiError(
        lastKind,
        `AI 응답이 ${maxRetries + 1}번 모두 요구한 형식에 맞지 않았습니다. 마지막 문제: ${lastError}`,
        '잠시 뒤 다시 시도하세요. 같은 과제에서 반복되면 프롬프트를 고쳐야 하므로 devlog 에 기록하세요.',
      );
    } finally {
      if (ownJob) this.endJob(ctx);
    }
  }

  /** 규칙 검증 결과를 그 호출의 기록에 덧붙인다 */
  /** output 은 재작성 기록용(걸린 시도와 그 다음 시도만 — loop.ts). 넘기지 않으면 남기지 않는다 */
  markRun(runId: number, status: RunStatus, issues: unknown[], output?: unknown): void {
    this.db
      .prepare('UPDATE ai_runs SET status = ?, issues_json = ?, output_json = ? WHERE id = ?')
      .run(status, JSON.stringify(issues), output === undefined ? null : JSON.stringify(output), runId);
  }

  private log(r: {
    job: JobContext;
    task: string;
    model: string;
    kind: RunKind;
    status: RunStatus;
    error: string | null;
    durationMs: number;
    /** 그중 컴퓨터가 잠들어 있던 시간 — 로그에만 보인다 (duration_ms 는 벽시계 그대로) */
    sleptMs?: number;
    startedAt: string;
    promptRef?: { name: string; version: string };
  }): number {
    const res = this.db
      .prepare(
        `INSERT INTO ai_runs (job_id, task, provider, model, prompt_name, prompt_ver, attempt, kind, status, error, duration_ms, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        r.job.jobId,
        r.task,
        this.provider.id,
        r.model,
        r.promptRef?.name ?? null,
        r.promptRef?.version ?? null,
        r.job.attempt,
        r.kind,
        r.status,
        r.error,
        r.durationMs,
        r.startedAt,
        new Date().toISOString(),
      );
    const tag = r.status === 'ok' ? '성공' : r.status;
    console.log(`[AI] ${r.task} #${r.job.attempt} ${r.kind} → ${tag} (${r.model}, ${(r.durationMs / 1000).toFixed(1)}초${sleptNote(r.sleptMs ?? 0)})${r.error ? ` — ${r.error.split('\n')[0]}` : ''}`);
    return Number(res.lastInsertRowid);
  }
}

/** zod 스키마 → CLI 에 넘길 JSON Schema. $schema 머리표는 빼고 넘긴다(공급자마다 지원 버전이 달라서) */
export function toCliSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}
