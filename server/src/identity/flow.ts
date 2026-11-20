// 정체성 흐름의 단계 이동: 설문 → 인터뷰(3~10턴) → 프로필 초안 → 확정.
// 턴 수 제한은 AI 가 아니라 코드가 강제한다 — 3턴 전에는 "충분하다"를 무시하고, 10턴이면 AI 를 부르지 않는다.
import { getSetting } from '../config.ts';
import type { AiService, JobContext } from '../ai/adapter.ts';
import type { Issue } from '../rules/types.ts';
import { runFollowup } from './followup.ts';
import { runProfile, type ProfileOutcome } from './profile.ts';
import { buildSources, classifyAnswer } from './sources.ts';
import { addTurn, getSessionState, listTurns, saveAnswer, saveProfileVersion, sessionBrand, setStatus } from './store.ts';
import { newPillarId, text, type Presence, type ProfileContent } from './model.ts';
import { surveyAnswerText, type SurveyAnswers } from './survey.ts';
import type { ProfileDraft, VerifiedPillar } from './profile.ts';
import type { DroppedPillar } from './model.ts';

export class FlowError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = 'FlowError';
    this.hint = hint;
  }
}

export type AskResult =
  | { kind: 'asked'; turnNo: number; readyForProfile: boolean }
  | { kind: 'limit' }
  | { kind: 'failed'; errors: Issue[] };

export async function askNext(ai: AiService, sessionId: number, job?: JobContext): Promise<AskResult> {
  const state = getSessionState(ai.db, sessionId);
  if (!state) throw new FlowError('정체성 세션을 찾지 못했습니다.', '설문부터 다시 시작하세요.');
  const last = state.turns.at(-1);
  if (last && last.answer === null) throw new FlowError('아직 답하지 않은 질문이 있습니다.', '지금 질문에 먼저 답하세요.');
  const answered = state.turns.length;
  const min = getSetting(ai.db, 'identity.minTurns');
  const max = getSetting(ai.db, 'identity.maxTurns');
  if (answered >= max) {
    setStatus(ai.db, sessionId, 'ready', state.note);
    return { kind: 'limit' };
  }
  const r = await runFollowup(ai, state.survey, state.turns, job);
  if (!r.ok) return { kind: 'failed', errors: r.errors };
  const turnNo = addTurn(ai.db, sessionId, r.data, r.jobId);
  // AI 가 "충분하다"고 해도 최소 턴 전에는 무시한다
  const ready = r.data.ready_for_profile && answered >= min;
  setStatus(ai.db, sessionId, ready ? 'ready' : 'interview', state.note);
  return { kind: 'asked', turnNo, readyForProfile: ready };
}

/**
 * 답 저장. 방식마다 무엇이 「사용자가 직접 쓴 글」인지 서버가 정한다(화면이 보낸 표시를 믿지 않는다):
 *  - 둘 중 고르기: 고른 쪽은 AI 가 쓴 선택지라 보조 근거(choice). 이유를 쓰면 답 글 = 이유만(직접 입력) — 선택지 글이 주 근거로 섞이지 않게
 *  - 말투 척도: 고른 칸은 보조 근거(choice), 덧붙인 말을 쓰면 그 말이 답 글
 *  - 고쳐 쓰기: 보인 예시 문장과 정규화 뒤 같으면 「예시를 그대로 보냄」(근거 아님), 조금이라도 고쳤으면 직접 입력
 */
export function answerTurn(ai: AiService, sessionId: number, turnNo: number, answer: string, unknown: boolean, pick: string | null = null, scale: number | null = null): void {
  const turns = listTurns(ai.db, sessionId);
  const turn = turns.find((t) => t.turnNo === turnNo);
  if (!turn) throw new FlowError(`${turnNo}번 질문이 없습니다.`, '화면을 새로고침한 뒤 다시 답하세요.');
  if (turn.answer !== null) throw new FlowError(`${turnNo}번 질문에는 이미 답했습니다.`, '다음 질문으로 넘어가세요.');
  if (unknown) {
    saveAnswer(ai.db, sessionId, turnNo, '잘 모르겠어요', 'unknown');
    return;
  }
  const typed = answer.trim();
  if (turn.format === 'this_or_that') {
    if (!pick || !turn.options.includes(pick)) throw new FlowError('둘 중 하나를 고르지 않았습니다.', '두 선택지 중 하나를 누른 뒤 보내세요.');
    if (typed) saveAnswer(ai.db, sessionId, turnNo, typed, classifyAnswer(typed, turn.examples, turn.options, false), pick);
    else saveAnswer(ai.db, sessionId, turnNo, pick, 'choice', pick);
    return;
  }
  if (turn.format === 'scale' && turn.scale) {
    if (scale === null || !Number.isInteger(scale) || scale < 1 || scale > 5) throw new FlowError('척도에서 칸을 고르지 않았습니다.', '1~5 중 하나를 누른 뒤 보내세요.');
    const side = scale <= 2 ? `${turn.scale.left} 쪽` : scale >= 4 ? `${turn.scale.right} 쪽` : '가운데';
    if (typed) saveAnswer(ai.db, sessionId, turnNo, typed, classifyAnswer(typed, turn.examples, [], false), String(scale));
    else saveAnswer(ai.db, sessionId, turnNo, `${turn.scale.left} ↔ ${turn.scale.right}: 5칸 중 ${scale}(${side})`, 'choice', String(scale));
    return;
  }
  if (!typed) throw new FlowError('답이 비어 있습니다.', '답을 쓰거나 [잘 모르겠어요]를 누르세요.');
  const examples = turn.format === 'rewrite' && turn.sample ? [turn.sample, ...turn.examples] : turn.examples;
  saveAnswer(ai.db, sessionId, turnNo, typed, classifyAnswer(typed, examples, turn.options, false));
}

export interface ProfileStepResult {
  outcome: ProfileOutcome['kind'];
  profileId: number | null;
  calls: number;
  rewrites: number;
  salvaged: boolean;
}

export async function makeProfile(ai: AiService, sessionId: number, job?: JobContext): Promise<ProfileStepResult> {
  const state = getSessionState(ai.db, sessionId);
  const brandId = sessionBrand(ai.db, sessionId);
  if (!state || brandId === null) throw new FlowError('정체성 세션을 찾지 못했습니다.', '설문부터 다시 시작하세요.');
  const answered = state.turns.filter((t) => t.answer !== null).length;
  const min = getSetting(ai.db, 'identity.minTurns');
  const max = getSetting(ai.db, 'identity.maxTurns');
  if (answered < min) throw new FlowError(`인터뷰 답이 ${answered}개라 아직 프로필을 만들 수 없습니다.`, `최소 ${min}개 질문에 답한 뒤 다시 시도하세요.`);

  const r = await runProfile(ai, buildSources(state.survey, state.turns), job);
  const o = r.outcome;
  const meta = { calls: r.calls, rewrites: r.rewrites };
  if (o.kind === 'saved') {
    // 인터뷰로 처음 만든 초안은 「확정」을 눌러야 활성이 된다 (수정·다른 방향·되돌리기는 바로 활성)
    const profileId = saveProfileVersion(ai.db, brandId, contentFromDraft(o.draft, o.dropped, state.survey, 'interview'), {
      reason: 'interview',
      sessionId,
      basedOn: null,
      jobId: r.jobId,
      activate: false,
    });
    setStatus(ai.db, sessionId, 'profiled');
    return { ...meta, outcome: 'saved', profileId, salvaged: o.salvaged };
  }
  if (o.kind === 'needs_more') {
    // 근거 있는 축이 3개 미만: 인터뷰로 돌아가 더 묻는다. 10턴을 다 썼으면 실패 안내
    const exhausted = answered >= max;
    setStatus(ai.db, sessionId, exhausted ? 'ready' : 'interview', {
      kind: exhausted ? 'failed' : 'needs_more',
      message: exhausted
        ? `질문 ${max}개를 다 썼지만 근거 있는 축이 3개가 되지 않았습니다. 설문을 더 구체적으로 채워 처음부터 다시 하거나, 다음 업데이트의 직접 수정 기능을 써 주세요.`
        : '직접 한 말에서 근거를 찾을 수 있는 축이 3개가 되지 않았습니다. 몇 가지 더 물어볼게요.',
      missing: o.missing,
    });
    return { ...meta, outcome: 'needs_more', profileId: null, salvaged: false };
  }
  setStatus(ai.db, sessionId, 'ready', {
    kind: 'failed',
    message: '프로필 초안이 규칙을 통과하지 못했습니다. 다시 만들어 보거나, 계속되면 처음부터 다시 하세요.',
    missing: o.errors.map((e) => e.message),
  });
  return { ...meta, outcome: 'failed', profileId: null, salvaged: false };
}

/** 설문 S6 → 「보여 주는 방식」. AI 가 만든 것이 아니라 사용자가 고른 답을 그대로 옮긴다 */
export function presenceFromSurvey(survey: SurveyAnswers): Presence | null {
  const t = surveyAnswerText(survey.S6);
  return t ? { text: t, source: 'S6', origin: 'interview' } : null;
}

/** 규칙을 통과한 AI 초안 → 저장 형식. 축마다 새 ID, 항목 출처는 origin(interview 또는 alternative) */
export function contentFromDraft(
  draft: Omit<ProfileDraft, 'pillars'> & { pillars: VerifiedPillar[] },
  dropped: DroppedPillar[],
  survey: SurveyAnswers,
  origin: 'interview' | 'alternative',
  presence: Presence | null = presenceFromSurvey(survey),
): ProfileContent {
  return {
    accountLine: draft.account_line,
    accountLineOrigin: origin,
    audience: draft.audience,
    audienceOrigin: origin,
    pillars: draft.pillars.map((p) => ({ id: newPillarId(), name: p.name, description: p.description, evidence: p.evidence, origin, expiresAt: null })),
    dropped,
    voiceRules: draft.voice_rules.map((t) => text(t, origin)),
    avoid: draft.avoid.map((t) => text(t, origin)),
    unknown: draft.unknown,
    presence,
  };
}
