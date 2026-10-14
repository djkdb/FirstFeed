// 생성 → 규칙 검증(코드) → 자기 평가(AI) → 필요하면 재작성 (FR-AI-4).
// 재작성 사유는 두 가지뿐: 코드 규칙의 error, 자기 평가의 "사실 오류(fact)/깨짐(broken)". 말투·취향은 경고만 (CLAUDE.md 「이미 내린 결정」).
// 끝까지 통과하지 못한 결과는 돌려주지 않는다 — 부르는 쪽이 저장할 수 없게.
import { z } from 'zod';
import { getSetting } from '../config.ts';
import type { Issue, Rule } from '../rules/types.ts';
import type { AiService, JobContext } from './adapter.ts';
import { loadPrompt } from './prompts.ts';
import { AiError, type AiRequest } from './types.ts';

export const ReviewSchema = z.object({
  issues: z
    .array(
      z.object({
        kind: z.enum(['fact', 'broken', 'style']),
        where: z.string(),
        message: z.string(),
      }),
    )
    .max(20),
});

export interface CheckedRequest<T> extends AiRequest<T> {
  /** 코드 규칙. error 가 하나라도 있으면 재작성 */
  rules: Rule<T>[];
  /** 자기 평가를 할지 (기본 true). 비용이 큰 opus 호출이라 과제마다 끌 수 있게 */
  selfReview?: boolean;
  /** 자기 평가에 넘길 이 과제만의 판단 기준 (prompts/<과제>_review 파일 내용). self_review v2 부터 쓴다 */
  reviewCriteria?: string;
  /**
   * 후보 여러 개를 받는 과제용: 문제가 있어도 "걸린 후보만 빼면 충분한가"를 판단해 true 면 다시 쓰지 않고 받아들인다.
   * 이때 문제들은 결과의 dropped 로 넘겨 부르는 쪽이 그 후보를 뺀다. 일부 후보만 걸렸는데 전체를 다시 쓰면 opus 호출만 는다
   */
  acceptByDropping?: (errors: Issue[], data: T) => boolean;
}

interface Base {
  jobId: string;
  /** 이 작업에서 AI 를 부른 횟수 (생성·재요청·재작성·자기 평가 모두) */
  calls: number;
  rewrites: number;
  warnings: Issue[];
}
export type CheckedResult<T> =
  | (Base & {
      ok: true;
      data: T;
      /** acceptByDropping 으로 받아들였을 때 빼야 할 후보의 문제들 (없으면 빈 배열) */
      dropped: Issue[];
    })
  | (Base & {
      ok: false;
      errors: Issue[];
      /**
       * 검증에 실패한 마지막 결과. **그대로 저장하면 안 된다.**
       * 실패한 부분을 코드로 덜어 내고 남은 것만 다시 검사하는 구제 단계(예: 근거 없는 축만 빼기)에서만 쓴다.
       */
      rejected: T;
    });

function formatIssues(issues: Issue[]): string {
  return issues.map((i) => `- [${i.code}]${i.where ? ` ${i.where}:` : ''} ${i.message}`).join('\n');
}

function reviewToIssues(r: z.infer<typeof ReviewSchema>): Issue[] {
  return r.issues.map((i) => ({
    level: i.kind === 'style' ? 'warn' : 'error',
    code: `review_${i.kind}`,
    message: i.message,
    where: i.where,
    from: 'review',
  }));
}

export async function generateChecked<T>(ai: AiService, req: CheckedRequest<T>, outer?: JobContext): Promise<CheckedResult<T>> {
  const job = outer ?? ai.startJob(req.signal);
  const maxRewrites = getSetting(ai.db, 'ai.maxRewrites');
  let rewrites = 0;
  let prompt = req.prompt;
  try {
    for (;;) {
      const gen = await ai.call({ ...req, prompt }, job, rewrites === 0 ? 'generate' : 'rewrite');
      const issues: Issue[] = req.rules.flatMap((rule) => rule(gen.data));

      // 자기 평가는 결과가 쓰일 수 있을 때만 부른다 — 어차피 다시 쓸 결과에 opus 호출을 쓰지 않으려고.
      // "쓰일 수 있다" = 코드 규칙 통과, 또는 걸린 후보만 빼면 충분(acceptByDropping). 뒤의 경우도 남은 후보는 평가해야
      // 수용 기준(예: 바이오가 계정 정의와 축을 담는가)을 놓치지 않는다
      const ruleErrors = issues.filter((i) => i.level === 'error');
      const usable = ruleErrors.length === 0 || (req.acceptByDropping?.(ruleErrors, gen.data) ?? false);
      if (usable && req.selfReview !== false) {
        const review = loadPrompt(
          ai.db,
          'self_review',
          { requirements: req.prompt, output: JSON.stringify(gen.data, null, 2), criteria: req.reviewCriteria ?? '(이 과제만의 추가 기준 없음)' },
          undefined,
          ['criteria'],
        );
        try {
          const r = await ai.call({ task: 'self_review', prompt: review.text, schema: ReviewSchema, promptRef: review.ref, signal: req.signal }, job, 'review');
          const reviewIssues = reviewToIssues(r.data);
          ai.markRun(r.runId, 'ok', reviewIssues);
          issues.push(...reviewIssues);
        } catch (err) {
          if (err instanceof AiError && err.kind === 'cancelled') throw err;
          // 자기 평가가 실패해도 코드 규칙은 통과했으므로 결과는 살린다. 대신 경고로 남긴다
          issues.push({
            level: 'warn',
            code: 'review_failed',
            message: `자기 평가를 하지 못했습니다: ${err instanceof Error ? err.message : String(err)}`,
            from: 'review',
          });
        }
      }

      const errors = issues.filter((i) => i.level === 'error');
      const warnings = issues.filter((i) => i.level === 'warn');
      ai.markRun(gen.runId, errors.length ? 'rule_error' : 'ok', issues);

      if (errors.length === 0) {
        return { ok: true, data: gen.data, dropped: [], jobId: job.jobId, calls: job.attempt, rewrites, warnings };
      }
      if (req.acceptByDropping?.(errors, gen.data)) {
        return { ok: true, data: gen.data, dropped: errors, jobId: job.jobId, calls: job.attempt, rewrites, warnings };
      }
      if (rewrites >= maxRewrites) {
        console.warn(`[AI] ${req.task}: 재작성 ${rewrites}회 뒤에도 문제 ${errors.length}건 — 결과를 버립니다`);
        return { ok: false, errors, rejected: gen.data, jobId: job.jobId, calls: job.attempt, rewrites, warnings };
      }
      rewrites++;
      prompt = `${req.prompt}\n\n${
        loadPrompt(ai.db, '_system/rewrite', { previous: JSON.stringify(gen.data, null, 2), issues: formatIssues(errors) }).text
      }`;
    }
  } finally {
    if (!outer) ai.endJob(job);
  }
}
