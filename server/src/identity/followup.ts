// 인터뷰 꼬리질문 한 개 만들기 (FR-ID-2). 자기 평가는 끄고 코드 규칙만 쓴다 — 왕복마다 opus 평가를 붙이면 질문마다 7초 넘게 늦어져서 (결정).
import { z } from 'zod';
import { getSetting } from '../config.ts';
import type { AiService, JobContext } from '../ai/adapter.ts';
import { generateChecked, type CheckedResult } from '../ai/loop.ts';
import { loadPrompt } from '../ai/prompts.ts';
import { similarity } from '../rules/similarity.ts';
import type { Issue, Rule } from '../rules/types.ts';
import { SURVEY, surveyAnswerText, type SurveyAnswers } from './survey.ts';
import type { AnswerKind } from './sources.ts';

export const FollowupSchema = z.object({
  question: z.string().min(5).max(150),
  why: z.string().max(100),
  examples: z.array(z.string().min(1).max(100)).min(2).max(3),
  options: z.array(z.string().min(1).max(40)).max(5),
  target: z.string().max(40),
  ready_for_profile: z.boolean(),
});
export type Followup = z.infer<typeof FollowupSchema>;

export interface PastTurn {
  turnNo: number;
  question: string;
  answer: string | null;
  answerKind: AnswerKind | null;
}

export interface FollowupContext {
  previousQuestions: string[];
  lastAnswerUnknown: boolean;
  duplicateThreshold: number;
}

export function followupRules(ctx: FollowupContext): Rule<Followup>[] {
  return [
    // 한 번에 한 질문
    (d) => {
      const marks = (d.question.match(/[?？]/g) ?? []).length;
      return marks > 1
        ? [{ level: 'error', code: 'multiple_questions', where: 'question', message: `질문이 ${marks}개 섞여 있습니다. 하나만 물으세요.`, from: 'rule' }]
        : [];
    },
    // 같은 질문을 두 번 하지 않는다
    (d) => {
      let best = { score: 0, q: '' };
      for (const q of ctx.previousQuestions) {
        const score = similarity(d.question, q);
        if (score > best.score) best = { score, q };
      }
      return best.score >= ctx.duplicateThreshold
        ? [
            {
              level: 'error',
              code: 'duplicate_question',
              where: 'question',
              message: `앞에서 한 질문("${best.q}")과 거의 같습니다(유사도 ${best.score.toFixed(2)}). 아직 비어 있는 다른 빈칸을 물으세요.`,
              from: 'rule',
            },
          ]
        : [];
    },
    // "잘 모르겠어요" 뒤에는 선택지로 다시 묻는다 (FR-ID-2 수용 기준)
    (d) =>
      ctx.lastAnswerUnknown && (d.options.length < 3 || d.options.length > 5)
        ? [{ level: 'error', code: 'unknown_needs_options', where: 'options', message: '직전 답이 "잘 모르겠어요"였습니다. 고를 수 있는 선택지 3~5개를 options 에 주세요.', from: 'rule' }]
        : [],
    // 예시끼리 같은 말이면 예시를 여러 개 주는 의미가 없다 (원칙 7-1-6)
    (d): Issue[] => {
      for (let i = 0; i < d.examples.length; i++)
        for (let j = i + 1; j < d.examples.length; j++)
          if (similarity(d.examples[i]!, d.examples[j]!) >= 0.8)
            return [{ level: 'error', code: 'similar_examples', where: `examples.${j}`, message: '예시 답끼리 거의 같습니다. 서로 다른 방향으로 쓰세요.', from: 'rule' }];
      return [];
    },
  ];
}

export function formatSurvey(survey: SurveyAnswers): string {
  return SURVEY.map((q) => `[${q.id}] ${q.label}: ${surveyAnswerText(survey[q.id]) || '(비어 있음)'}`).join('\n');
}

export function formatTranscript(turns: PastTurn[]): string {
  if (turns.length === 0) return '(아직 없음)';
  return turns
    .map((t) => {
      const ans = t.answerKind === 'unknown' ? '잘 모르겠어요' : (t.answer ?? '(아직 답 없음)');
      const mark = t.answerKind === 'example' ? ' (예시 답을 그대로 고름)' : t.answerKind === 'choice' ? ' (선택지를 고름)' : '';
      return `[A${t.turnNo}] 질문: ${t.question}\n     답${mark}: ${ans}`;
    })
    .join('\n');
}

export async function runFollowup(
  ai: AiService,
  survey: SurveyAnswers,
  turns: PastTurn[],
  job?: JobContext,
): Promise<CheckedResult<Followup>> {
  const answered = turns.filter((t) => t.answer !== null).length;
  const last = turns.at(-1);
  const lastUnknown = last?.answerKind === 'unknown';
  const prompt = loadPrompt(ai.db, 'identity_followup', {
    answered: String(answered),
    min_turns: String(getSetting(ai.db, 'identity.minTurns')),
    max_turns: String(getSetting(ai.db, 'identity.maxTurns')),
    last_unknown: lastUnknown ? '직전 답이 "잘 모르겠어요"였다. 같은 빈칸을 선택지(options 3~5개)와 함께 더 쉽게 다시 묻는다.' : '',
    survey: formatSurvey(survey),
    transcript: formatTranscript(turns),
  });
  const ctx: FollowupContext = {
    // 직전 "모름" 질문은 같은 빈칸을 다시 묻는 것이 정상이므로 중복 비교에서 뺀다
    previousQuestions: turns.filter((t) => !(lastUnknown && t === last)).map((t) => t.question),
    lastAnswerUnknown: lastUnknown,
    duplicateThreshold: getSetting(ai.db, 'identity.duplicateQuestionThreshold'),
  };
  return generateChecked(
    ai,
    { task: 'identity_followup', prompt: prompt.text, promptRef: prompt.ref, schema: FollowupSchema, rules: followupRules(ctx), selfReview: false, signal: job?.signal },
    job,
  );
}
