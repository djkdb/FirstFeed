// 발행 작업 진행 상황 — 실제로 지나온 단계만 적는다(가짜 진행 표시 금지, 결정 2026-10-24). 브라우저 창은 한 번에 하나만
export interface BlogJob {
  id: string;
  kind: 'tistory' | 'litly';
  phase: 'running' | 'done' | 'failed' | 'cancelled';
  steps: Array<{ at: string; text: string }>;
  result: unknown;
  error: { message: string; hint: string } | null;
}

export class BlogJobs {
  private jobs = new Map<string, BlogJob & { ctrl: AbortController }>();
  private running: string | null = null;

  start(kind: BlogJob['kind'], run: (step: (t: string) => void, signal: AbortSignal) => Promise<unknown>): string {
    if (this.running && this.jobs.get(this.running)?.phase === 'running') throw new Error('이미 발행 창이 열려 있어요. 그 작업이 끝나거나 취소한 뒤 다시 하세요.');
    const id = `blog-${Date.now().toString(36)}`;
    const ctrl = new AbortController();
    const job = { id, kind, phase: 'running' as BlogJob['phase'], steps: [] as BlogJob['steps'], result: null as unknown, error: null as BlogJob['error'], ctrl };
    this.jobs.set(id, job);
    this.running = id;
    const step = (text: string) => job.steps.push({ at: new Date().toISOString(), text });
    run(step, ctrl.signal)
      .then((r) => Object.assign(job, { phase: 'done', result: r }))
      .catch((e: unknown) => {
        const hint = (e as { hint?: string }).hint ?? '';
        Object.assign(job, { phase: ctrl.signal.aborted ? 'cancelled' : 'failed', error: { message: e instanceof Error ? e.message : String(e), hint } });
      });
    return id;
  }

  get(id: string): BlogJob | null {
    const j = this.jobs.get(id);
    if (!j) return null;
    const { ctrl: _ctrl, ...rest } = j;
    return rest;
  }

  cancel(id: string): void {
    this.jobs.get(id)?.ctrl.abort();
  }
}
