// 스모크 과제: 원문에서 사실 2~3개와 근거 인용을 뽑는다.
// 제품 기능이 아니라, 어댑터·근거 규칙·자기 평가·재작성 루프를 실제 CLI 로 끝까지 돌려 보는 시험대다.
import { z } from 'zod';
import type { AiService, JobContext } from '../ai/adapter.ts';
import { generateChecked, type CheckedResult } from '../ai/loop.ts';
import { loadPrompt } from '../ai/prompts.ts';
import { findUngrounded, quoteInSources } from '../rules/grounding.ts';
import type { Issue, Rule } from '../rules/types.ts';

export const SmokeSchema = z.object({
  facts: z
    .array(
      z.object({
        fact: z.string().min(1).max(80),
        quote: z.string().min(1),
      }),
    )
    .min(2)
    .max(3),
});
export type SmokeOutput = z.infer<typeof SmokeSchema>;

export function smokeRules(source: string): Rule<SmokeOutput>[] {
  return [
    // 인용은 원문에 실제로 있어야 한다
    (d) =>
      d.facts.flatMap((f, i): Issue[] =>
        quoteInSources(f.quote, [source])
          ? []
          : [{ level: 'error', code: 'quote_not_in_source', where: `facts.${i}.quote`, message: `인용이 원문에 없습니다: "${f.quote}"`, from: 'rule' }],
      ),
    // 사실 문장 속 숫자·영문 이름은 원문 안에서만
    (d) =>
      d.facts.flatMap((f, i): Issue[] =>
        findUngrounded(f.fact, { source: [source] }).map((c) => ({
          level: 'error',
          code: c.kind === 'number' ? 'number_not_in_source' : 'english_not_in_source',
          where: `facts.${i}.fact`,
          message: `원문에 없는 ${c.kind === 'number' ? '숫자' : '영문 이름'} "${c.value}" 을(를) 썼습니다`,
          from: 'rule',
        })),
      ),
  ];
}

export async function runSmokeExtract(ai: AiService, source: string, job?: JobContext): Promise<CheckedResult<SmokeOutput>> {
  const prompt = loadPrompt(ai.db, 'smoke_extract', { source });
  return generateChecked(
    ai,
    { task: 'smoke_extract', prompt: prompt.text, promptRef: prompt.ref, schema: SmokeSchema, rules: smokeRules(source), signal: job?.signal },
    job,
  );
}
