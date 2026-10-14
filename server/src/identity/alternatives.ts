// 「다른 방향 2개 더」 (FR-ID-5). 결정: CLAUDE.md 2026-10-14 · FR-ID-5·6 설계
// - 한 번의 호출로 두 방향. 방향마다 프로필과 같은 근거 규칙 + 근거 있는 축 3개 이상
// - "지금 판과 너무 비슷한 방향"은 글자 유사도가 아니라 자기 평가로 (prompts/identity_alternatives_review)
// - 끝까지 통과하지 못한 방향만 빼고, 통과한 방향만 보여 준다
// - 고르면 새 판으로 바로 활성. 축은 모두 새 ID — 지금 판의 축과 이어 붙이지 않는다
import { z } from 'zod';
import { commonEnglishTerms, getSetting } from '../config.ts';
import type { AiService, JobContext } from '../ai/adapter.ts';
import { generateChecked } from '../ai/loop.ts';
import { loadPrompt } from '../ai/prompts.ts';
import type { Issue, Rule } from '../rules/types.ts';
import { FlowError, contentFromDraft } from './flow.ts';
import { userAuthoredTexts, type ProfileContent } from './model.ts';
import { ProfileSchema, profileRules, validEvidence, type ProfileContext, type ProfileDraft } from './profile.ts';
import { buildSources, formatSourcesForPrompt } from './sources.ts';
import { getProfile, getSessionState, saveProfileVersion } from './store.ts';

export const DirectionSchema = ProfileSchema.extend({ angle: z.string().min(1).max(40) });
export const AlternativesSchema = z.object({ directions: z.array(DirectionSchema).length(2) });
export type Direction = z.infer<typeof DirectionSchema>;
type Alternatives = z.infer<typeof AlternativesSchema>;

const MIN_PILLARS = 3;

/** 프롬프트에 넣을 「지금 판」 */
export function formatCurrentProfile(c: ProfileContent): string {
  return [
    `계정 소개: ${c.accountLine}`,
    `보는 사람: ${c.audience}`,
    '축:',
    ...c.pillars.map((p, i) => `  ${i + 1}. ${p.name} — ${p.description}`),
    `말투: ${c.voiceRules.map((v) => v.text).join(' / ')}`,
    `피할 것: ${c.avoid.map((v) => v.text).join(' / ')}`,
  ].join('\n');
}

const toDraft = (d: Direction): ProfileDraft => ({
  account_line: d.account_line,
  audience: d.audience,
  pillars: d.pillars,
  voice_rules: d.voice_rules,
  avoid: d.avoid,
  unknown: d.unknown,
});

/** 방향마다 프로필 규칙을 걸고, 문제 위치에 "directions.N." 을 붙인다 — 어느 방향의 문제인지 가르려고 */
export function alternativesRules(ctx: ProfileContext): Rule<Alternatives>[] {
  return [
    (d) =>
      d.directions.flatMap((dir, i) => {
        const prefix = `directions.${i}`;
        const issues: Issue[] = profileRules(ctx)
          .flatMap((r) => r(toDraft(dir)))
          .map((x) => ({ ...x, where: x.where ? `${prefix}.${x.where}` : prefix }));
        const grounded = dir.pillars.filter((p) => validEvidence(p, ctx).length > 0).length;
        if (grounded < MIN_PILLARS) {
          issues.push({
            level: 'error',
            code: 'too_few_pillars',
            where: prefix,
            message: `방향 ${i + 1}("${dir.angle}")에 근거 있는 축이 ${grounded}개뿐입니다. 근거를 인용할 수 있는 축 ${MIN_PILLARS}개 이상으로 다른 조합을 찾으세요.`,
            from: 'rule',
          });
        }
        return issues;
      }),
  ];
}

/** 문제가 어느 방향의 것인지 (where 가 directions.N 으로 시작). 알 수 없으면 null — 두 방향 모두의 문제로 본다 */
export function directionOf(issue: Issue): number | null {
  const m = /^directions\.(\d)/.exec(issue.where ?? '');
  return m ? Number(m[1]) : null;
}

export interface DirectionResult {
  index: number;
  angle: string;
  ok: boolean;
  /** 통과한 방향만: 저장할 내용 (고르면 그대로 새 판이 된다) */
  content: ProfileContent | null;
  reasons: string[];
  /** 화면·측정용 요약 */
  accountLine: string;
  pillars: Array<{ name: string; description: string }>;
}

export interface AlternativesResult {
  baseId: number;
  directions: DirectionResult[];
  calls: number;
  rewrites: number;
  warnings: Issue[];
}

export async function runAlternatives(ai: AiService, baseId: number, job?: JobContext): Promise<AlternativesResult> {
  const base = getProfile(ai.db, baseId);
  if (!base) throw new FlowError('지금 판을 찾지 못했습니다.', '화면을 새로고침한 뒤 다시 시도하세요.');
  const session = base.sessionId === null ? null : getSessionState(ai.db, base.sessionId);
  if (!session) throw new FlowError('이 프로필에는 인터뷰 기록이 없어 다른 방향의 근거를 찾을 수 없습니다.', '정체성 찾기를 처음부터 한 번 진행하세요.');

  const sources = buildSources(session.survey, session.turns);
  const userTexts = userAuthoredTexts(base);
  const ctx: ProfileContext = {
    sources,
    extraUserTexts: userTexts,
    overlapThreshold: getSetting(ai.db, 'identity.pillarOverlapThreshold'),
    minQuoteChars: getSetting(ai.db, 'identity.minQuoteChars'),
    commonTerms: commonEnglishTerms(ai.db),
  };
  const current = formatCurrentProfile(base);
  const prompt = loadPrompt(ai.db, 'identity_alternatives', {
    sources: formatSourcesForPrompt(sources),
    current,
    user_texts: userTexts.length ? userTexts.map((t) => `- ${t}`).join('\n') : '(없음)',
  });
  const criteria = loadPrompt(ai.db, 'identity_alternatives_review', { current }).text;

  const r = await generateChecked(
    ai,
    {
      task: 'identity_alternatives',
      prompt: prompt.text,
      promptRef: prompt.ref,
      schema: AlternativesSchema,
      rules: alternativesRules(ctx),
      reviewCriteria: criteria,
      signal: job?.signal,
    },
    job,
  );
  const data = r.ok ? r.data : r.rejected;
  const errors = r.ok ? [] : r.errors;
  const global = errors.filter((e) => directionOf(e) === null);

  const directions: DirectionResult[] = data.directions.map((dir, i) => {
    const mine = errors.filter((e) => directionOf(e) === i);
    const ok = global.length === 0 && mine.length === 0;
    const pillars = dir.pillars.map((p) => ({ name: p.name, description: p.description, evidence: validEvidence(p, ctx) }));
    return {
      index: i,
      angle: dir.angle,
      ok,
      content: ok ? contentFromDraft({ ...toDraft(dir), pillars }, [], session.survey, 'alternative', base.presence) : null,
      reasons: [...global, ...mine].map((e) => `[${e.code}] ${e.message}`),
      accountLine: dir.account_line,
      pillars: dir.pillars.map((p) => ({ name: p.name, description: p.description })),
    };
  });
  return { baseId, directions, calls: r.calls, rewrites: r.rewrites, warnings: r.warnings };
}

/** 고른 방향을 새 판으로 바로 활성 (축은 모두 새 ID) */
export function chooseDirection(ai: AiService, result: AlternativesResult, index: number): number {
  const dir = result.directions[index];
  if (!dir || !dir.ok || !dir.content) throw new FlowError('고를 수 없는 방향입니다.', '규칙을 통과한 방향만 고를 수 있습니다. 「다른 방향 2개 더」를 다시 요청하세요.');
  const base = getProfile(ai.db, result.baseId);
  if (!base) throw new FlowError('지금 판을 찾지 못했습니다.', '화면을 새로고침한 뒤 다시 시도하세요.');
  return saveProfileVersion(ai.db, base.brandId, dir.content, { reason: 'alternative', sessionId: base.sessionId, basedOn: base.id, jobId: null, activate: true });
}
