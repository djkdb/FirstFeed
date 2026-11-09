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

/**
 * 인터뷰 다양화(2026-11-08, 꼬리질문 v3): 질문 각도(lens)와 답하는 방식(format).
 * 주제(축)만 묻던 v2 는 말투 · 관점 · 고집 같은 개성이 프로필에 덜 드러나서, 각도를 돌려 가며 묻고 답하는 방식도 넷으로 늘린다
 */
export const LENSES = ['experience', 'opinion', 'reason', 'struggle', 'quirk', 'others_view', 'audience', 'voice'] as const;
export type Lens = (typeof LENSES)[number];
export const LENS_LABEL: Record<Lens, string> = {
  experience: '경험',
  opinion: '관점',
  reason: '이유',
  struggle: '삽질',
  quirk: '고집·취향',
  others_view: '남이 보는 나',
  audience: '보는 사람',
  voice: '말투',
};
export const FORMATS = ['open', 'this_or_that', 'rewrite', 'scale'] as const;
export type Format = (typeof FORMATS)[number];
export const FORMAT_LABEL: Record<Format, string> = { open: '글로 답하기', this_or_that: '둘 중 고르기', rewrite: '고쳐 쓰기', scale: '말투 척도' };

// 스키마는 넉넉하게 — 방식마다 어떤 칸이 차야 하는지는 규칙이 이유를 붙여 알려 준다
export const FollowupV3Schema = z.object({
  question: z.string().min(5).max(150),
  why: z.string().max(100),
  lens: z.enum(LENSES),
  format: z.enum(FORMATS),
  examples: z.array(z.string().min(1).max(100)).max(3),
  options: z.array(z.string().min(1).max(40)).max(5),
  /** 고쳐 쓰기: 이 사람 말투로 다시 써 달라고 보일 짧은 예시 문장. 다른 방식이면 빈 글 */
  sample: z.string().max(140),
  /** 말투 척도의 양 끝 낱말. 다른 방식이면 빈 글 */
  scale_left: z.string().max(20),
  scale_right: z.string().max(20),
  target: z.string().max(40),
  ready_for_profile: z.boolean(),
});

/** 저장 · 규칙이 쓰는 한 모양. v2 이하 결과는 lens null · format open 으로 채운다 */
export interface Followup {
  question: string;
  why: string;
  lens: Lens | null;
  format: Format;
  examples: string[];
  options: string[];
  sample: string;
  scaleLeft: string;
  scaleRight: string;
  target: string;
  ready_for_profile: boolean;
}

export const fromV2 = (d: z.infer<typeof FollowupSchema>): Followup => ({ ...d, lens: null, format: 'open', sample: '', scaleLeft: '', scaleRight: '' });
export const fromV3 = (d: z.infer<typeof FollowupV3Schema>): Followup => {
  const { scale_left, scale_right, ...rest } = d;
  return { ...rest, scaleLeft: scale_left, scaleRight: scale_right };
};
/** v3 부터 각도 · 방식 스키마. 프롬프트 판으로 고른다 — 같은 코드로 v2 와 비교 측정할 수 있게 */
export const usesV3 = (version: string) => Number(version.replace(/^v/, '')) >= 3;

export interface PastTurn {
  turnNo: number;
  question: string;
  answer: string | null;
  answerKind: AnswerKind | null;
  lens?: Lens | null;
  format?: Format;
  options?: string[];
  sample?: string | null;
  scale?: { left: string; right: string } | null;
  pick?: string | null;
}

export interface FollowupContext {
  previousQuestions: string[];
  lastAnswerUnknown: boolean;
  duplicateThreshold: number;
  /** v3: 지난 질문들의 각도 · 방식(고정 질문 · v2 질문은 lens null). 없으면 각도 · 방식 규칙을 걸지 않는다 */
  previous?: Array<{ lens: Lens | null; format: Format }>;
  variety?: { window: number; minDistinctLenses: number; formatBy: number };
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
    ...(ctx.previous ? v3Rules(ctx, ctx.previous, ctx.variety ?? { window: 5, minDistinctLenses: 4, formatBy: 4 }) : []),
  ];
}

const err = (code: string, message: string, where?: string): Issue => ({ level: 'error', code, message, where, from: 'rule' });
const norm = (x: string) => x.replace(/[\s.,!?·~'"“”‘’]/g, '');

/** 각도 · 방식 규칙(v3). 「잘 모르겠어요」 뒤 다시 묻기는 같은 빈칸을 같은 각도 · 글로 다시 묻는 것이 정상이라 각도 반복 · 방식 규칙에서 뺀다 */
function v3Rules(ctx: FollowupContext, prev: Array<{ lens: Lens | null; format: Format }>, v: { window: number; minDistinctLenses: number; formatBy: number }): Rule<Followup>[] {
  return [
    // 방식마다 차야 하는 칸
    (d) => {
      if (d.format === 'open' && d.examples.length < 2) return [err('format_open_examples', '글로 답하기는 서로 다른 방향의 예시 답 2~3개가 있어야 합니다.', 'examples')];
      if (d.format === 'this_or_that') {
        if (d.options.length !== 2) return [err('format_pick_two', `둘 중 고르기는 options 가 정확히 2개여야 합니다(지금 ${d.options.length}개).`, 'options')];
        if (norm(d.options[0]!) === norm(d.options[1]!)) return [err('format_pick_same', '둘 중 고르기의 두 선택지가 같습니다. 서로 맞서는 둘로 쓰세요.', 'options')];
      }
      if (d.format === 'rewrite' && [...norm(d.sample)].length < 10) return [err('format_rewrite_sample', '고쳐 쓰기는 다시 써 달라고 보일 예시 문장(sample, 10자 이상)이 있어야 합니다.', 'sample')];
      if (d.format === 'scale') {
        if (!d.scaleLeft.trim() || !d.scaleRight.trim()) return [err('format_scale_ends', '말투 척도는 양 끝 낱말(scale_left · scale_right)이 둘 다 있어야 합니다.', 'scale_left')];
        if (norm(d.scaleLeft) === norm(d.scaleRight)) return [err('format_scale_same', '척도 양 끝이 같은 말입니다. 서로 반대인 말로 쓰세요.', 'scale_right')];
      }
      return [];
    },
    // 화면에 보이는 「왜 묻나요?」는 사용자에게 하는 말 — 3인칭(「이 사람」)으로 부르면 다시 쓰게(사용자 시뮬레이션 2026-11-09)
    (d) => {
      const m = /이 사람|이분|사용자|계정 주인/.exec(d.why);
      return m ? [err('why_third_person', `「왜 묻나요?」에 「${m[0]}」 — 화면에서 사용자가 읽는 글이에요. 사용자에게 직접 말하듯(「~하려고 물어요」) 쓰세요.`, 'why')] : [];
    },
    // 「잘 모르겠어요」 뒤에는 글로 답하기 + 선택지
    (d) => (ctx.lastAnswerUnknown && d.format !== 'open' ? [err('unknown_needs_open', '직전 답이 "잘 모르겠어요"였습니다. 같은 빈칸을 글로 답하기(format open) + 선택지로 더 쉽게 다시 물으세요.', 'format')] : []),
    // 같은 각도를 연달아 묻지 않는다
    (d) => {
      const last = prev.at(-1);
      if (ctx.lastAnswerUnknown || !d.lens || !last?.lens || last.lens !== d.lens) return [];
      return [err('lens_repeat', `바로 앞 질문도 「${LENS_LABEL[d.lens]}」 각도였습니다. 아직 덜 쓴 다른 각도로 물으세요.`, 'lens')];
    },
    // 최근 질문 몇 개 안에서 각도가 고루 돌아야 한다 (각도를 아는 질문만 센다 — 고정 질문 · v2 질문은 모름)
    (d) => {
      const known = [...prev.map((p) => p.lens), d.lens].filter((x): x is Lens => !!x);
      if (ctx.lastAnswerUnknown || known.length < v.window) return [];
      const recent = new Set(known.slice(-v.window));
      return recent.size < v.minDistinctLenses
        ? [err('lens_variety', `최근 질문 ${v.window}개의 각도가 ${recent.size}가지뿐입니다(${[...recent].map((l) => LENS_LABEL[l]).join(' · ')}). 아직 안 쓴 각도로 물으세요.`, 'lens')]
        : [];
    },
    // 각도를 아는 질문이 formatBy 개가 될 때까지 모두 글로 답하기면 다른 방식을 하나 섞는다
    (d) => {
      const known = [...prev.filter((p) => p.lens), { lens: d.lens, format: d.format }];
      if (ctx.lastAnswerUnknown || known.length < v.formatBy || known.some((k) => k.format !== 'open')) return [];
      return [err('format_variety', `질문 ${known.length}개가 모두 글로 답하기입니다. 둘 중 고르기 · 고쳐 쓰기 · 말투 척도 중 하나로 물으세요.`, 'format')];
    },
    // 프로필로 가기 전에 말투를 한 번은 묻는다 — 말투 규칙이 이 사람의 실제 말에서 나오게
    (d) => {
      const voiced = [...prev, { lens: d.lens, format: d.format }].some((k) => k.lens === 'voice' || k.format === 'rewrite' || k.format === 'scale');
      return d.ready_for_profile && !voiced ? [err('voice_before_ready', '아직 말투를 묻지 않았습니다. ready_for_profile 은 false 로 두고, 이번 질문을 말투(voice) 각도 · 고쳐 쓰기나 척도로 물으세요.', 'ready_for_profile')] : [];
    },
  ];
}

export function formatSurvey(survey: SurveyAnswers): string {
  return SURVEY.map((q) => `[${q.id}] ${q.label}: ${surveyAnswerText(survey[q.id]) || '(비어 있음)'}`).join('\n');
}

/** 방식에 따라 무엇을 보였고 무엇을 골랐는지까지 — AI 가 다음 질문을 정할 때 「예시를 그대로 고른 답」처럼 무게를 알 수 있게 */
export function formatTranscript(turns: PastTurn[]): string {
  if (turns.length === 0) return '(아직 없음)';
  return turns
    .map((t) => {
      const head = `[A${t.turnNo}]${t.lens ? ` (${LENS_LABEL[t.lens]} · ${FORMAT_LABEL[t.format ?? 'open']})` : ''} 질문: ${t.question}`;
      if (t.answerKind === 'unknown') return `${head}\n     답: 잘 모르겠어요`;
      if (t.answer === null) return `${head}\n     답: (아직 답 없음)`;
      const lines = [head];
      if (t.format === 'this_or_that') {
        lines.push(`     보인 둘: 「${t.options?.[0] ?? ''}」 / 「${t.options?.[1] ?? ''}」 → 고름: 「${t.pick ?? ''}」`);
        if (t.answerKind !== 'choice') lines.push(`     이유${t.answerKind === 'example' ? ' (예시 답을 그대로 고름)' : ''}: ${t.answer}`);
        return lines.join('\n');
      }
      if (t.format === 'scale' && t.scale) {
        lines.push(`     척도 「${t.scale.left}」 1 ~ 5 「${t.scale.right}」 → ${t.pick ?? '?'}`);
        if (t.answerKind !== 'choice') lines.push(`     덧붙인 말${t.answerKind === 'example' ? ' (예시 답을 그대로 고름)' : ''}: ${t.answer}`);
        return lines.join('\n');
      }
      if (t.format === 'rewrite') lines.push(`     보인 예시 문장: ${t.sample ?? ''}`);
      const mark = t.answerKind === 'example' ? (t.format === 'rewrite' ? ' (예시 문장을 그대로 보냄)' : ' (예시 답을 그대로 고름)') : t.answerKind === 'choice' ? ' (선택지를 고름)' : '';
      lines.push(`     ${t.format === 'rewrite' ? '고쳐 쓴 답' : '답'}${mark}: ${t.answer}`);
      return lines.join('\n');
    })
    .join('\n');
}

/** 지금까지 쓴 각도 · 방식 — v3 프롬프트에 보인다 */
export function formatCoverage(turns: PastTurn[]): string {
  const used = new Map<Lens, number>();
  const formats = new Map<Format, number>();
  for (const t of turns) {
    if (!t.lens) continue;
    used.set(t.lens, (used.get(t.lens) ?? 0) + 1);
    formats.set(t.format ?? 'open', (formats.get(t.format ?? 'open') ?? 0) + 1);
  }
  const unused = LENSES.filter((l) => !used.has(l)).map((l) => `${l}(${LENS_LABEL[l]})`);
  return [
    `- 쓴 각도: ${used.size ? [...used].map(([l, n]) => `${l}(${LENS_LABEL[l]}) ${n}`).join(' · ') : '아직 없음(고정 질문은 각도를 모름)'}`,
    `- 아직 안 쓴 각도: ${unused.join(' · ') || '없음'}`,
    `- 쓴 방식: ${formats.size ? [...formats].map(([f, n]) => `${f}(${FORMAT_LABEL[f]}) ${n}`).join(' · ') : '아직 없음'}`,
    `- 말투를 물었나: ${turns.some((t) => t.lens === 'voice' || t.format === 'rewrite' || t.format === 'scale') ? '예' : '아직 아니오'}`,
  ].join('\n');
}

export async function runFollowup(ai: AiService, survey: SurveyAnswers, turns: PastTurn[], job?: JobContext): Promise<CheckedResult<Followup>> {
  const answered = turns.filter((t) => t.answer !== null).length;
  const last = turns.at(-1);
  const lastUnknown = last?.answerKind === 'unknown';
  const version = getSetting(ai.db, 'prompts.activeVersions').identity_followup ?? 'v1';
  const v3 = usesV3(version);
  const prompt = loadPrompt(
    ai.db,
    'identity_followup',
    {
      answered: String(answered),
      min_turns: String(getSetting(ai.db, 'identity.minTurns')),
      max_turns: String(getSetting(ai.db, 'identity.maxTurns')),
      last_unknown: lastUnknown ? '직전 답이 "잘 모르겠어요"였다. 같은 빈칸을 선택지(options 3~5개)와 함께 더 쉽게 다시 묻는다.' : '',
      survey: formatSurvey(survey),
      transcript: formatTranscript(turns),
      coverage: formatCoverage(turns),
    },
    undefined,
    ['coverage'], // coverage 는 v3 부터 — v2 로 비교 측정할 때도 같은 코드로 돌게
  );
  const ctx: FollowupContext = {
    // 직전 "모름" 질문은 같은 빈칸을 다시 묻는 것이 정상이므로 중복 비교에서 뺀다
    previousQuestions: turns.filter((t) => !(lastUnknown && t === last)).map((t) => t.question),
    lastAnswerUnknown: lastUnknown,
    duplicateThreshold: getSetting(ai.db, 'identity.duplicateQuestionThreshold'),
    ...(v3 ? { previous: turns.map((t) => ({ lens: t.lens ?? null, format: t.format ?? 'open' })), variety: getSetting(ai.db, 'identity.variety') } : {}),
  };
  const base = { task: 'identity_followup', prompt: prompt.text, promptRef: prompt.ref, selfReview: false, signal: job?.signal };
  if (!v3) {
    const r = await generateChecked(ai, { ...base, schema: FollowupSchema, rules: followupRules(ctx).map((rule) => (d: z.infer<typeof FollowupSchema>) => rule(fromV2(d))) }, job);
    return r.ok ? { ...r, data: fromV2(r.data) } : { ...r, rejected: fromV2(r.rejected) };
  }
  const r = await generateChecked(ai, { ...base, schema: FollowupV3Schema, rules: followupRules(ctx).map((rule) => (d: z.infer<typeof FollowupV3Schema>) => rule(fromV3(d))) }, job);
  return r.ok ? { ...r, data: fromV3(r.data) } : { ...r, rejected: fromV3(r.rejected) };
}
