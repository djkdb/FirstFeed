// 다음에 더 할 것 / 줄일 것(FR-IN-5)과 수락 → 프로필 새 판(FR-IN-6) — 결정 2026-11-22.
// AI 에는 **표(결론을 낼 수 있는 묶음만) + 프로필**만 보인다. 게시물 원문 · 날 숫자는 보이지 않는다.
// 코드 규칙(재작성 사유): 표에 없는 묶음 · 표본 부족 묶음 인용 · 표와 다른 값 인용 · 표에 없는 숫자 · 영문 · 규칙 문장에 숫자 · 개수 · 길이.
// 수락해야만 프로필이 바뀐다 — 'more' 는 말투 규칙, 'less' 는 피할 것에 출처 insight · 만료일(insights.acceptDays)로 더한 새 판(바로 적용, 되돌리기 가능)
import { z } from 'zod';
import { commonEnglishTerms, getSetting } from '../config.ts';
import type { AiService, JobContext } from '../ai/adapter.ts';
import { generateChecked } from '../ai/loop.ts';
import { loadPrompt } from '../ai/prompts.ts';
import type { Db } from '../db/index.ts';
import { FlowError } from '../identity/flow.ts';
import { formatProfileForPrompt, isLive, profileForGeneration } from '../identity/for-generation.ts';
import type { ProfileContent, StoredText } from '../identity/model.ts';
import { activeProfile, saveProfileVersion } from '../identity/store.ts';
import { findUngrounded } from '../rules/grounding.ts';
import type { Issue, Rule } from '../rules/types.ts';
import { insightTable, type Group, type TableRow } from './analyze.ts';
import { analysisFor } from './service.ts';
import { decideSuggestion, getSuggestion, recordSuggestionRun, saveSuggestions } from './store.ts';

/** 말투 규칙 · 피할 것 한 줄의 최대 길이 — 프로필 직접 수정(identity/edit.ts EditInput)과 같게 */
/** 프로필 직접 수정 화면이 받는 개수와 같게(identity/edit.ts) — 넘으면 수정 화면에서 저장할 수 없게 되므로 */
const LIST_MAX = { voiceRules: 6, avoid: 8 } as const;

export const SuggestSchema = z.object({
  suggestions: z
    .array(
      z.object({
        kind: z.enum(['more', 'less']),
        groupKey: z.string().min(1).max(80),
        text: z.string().min(1).max(300),
        rule: z.string().min(1).max(200),
        evidence: z
          .array(z.object({ groupKey: z.string().min(1).max(80), metric: z.enum(['saveRate', 'shareRate']), value: z.string().min(1).max(20) }))
          .min(1)
          .max(4),
      }),
    )
    .max(6),
});
export type SuggestOut = z.infer<typeof SuggestSchema>;

const issue = (where: string, code: string, message: string): Issue => ({ level: 'error', code, where, message, from: 'rule' });
const chars = (s: string) => [...s].length;
/** 표의 비율 글(「11.0%」)을 AI 가 「11%」로 줄여 써도 같은 값으로 본다 — 뜻이 같은데 opus 재작성을 쓰지 않게 */
const sameRate = (s: string) => s.trim().replace(/(\d+)\.0%$/, '$1%');
/** 문장 수: 소수점(「4.2」)은 빼고, 끝맺는 「. ! ?」 뒤에 글이 더 이어지면 두 문장 이상 */
export function sentenceCount(t: string): number {
  const body = t.trim().replace(/(\d)\.(\d)/g, '$1$2');
  return body.split(/[.!?。！？]+(?=\s|$)/).filter((x) => x.trim().length > 0).length;
}
/** 배수 비교(「3배」 「세 배」) — 표에는 배수가 없어 늘 AI 가 계산한 숫자다. 문장 속 개수 숫자(「게시물 3개」)와 겹쳐 근거 대조를 빠져나가서 따로 막는다 */
const MULTIPLIER = /(?:[\p{Nd}]+(?:[.,]\p{Nd}+)?|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|몇)\s*배/u;

export interface SuggestContext {
  groups: Group[];
  table: TableRow[];
  /** 숫자 · 영문 대조의 유일한 출처 — 표의 이름 · 개수 · 비율 글 */
  grounding: string;
  max: number;
  maxChars: number;
  ruleMaxChars: number;
  commonTerms: readonly string[];
}

export function suggestRules(c: SuggestContext): Rule<SuggestOut>[] {
  const row = new Map(c.table.map((r) => [r.key, r]));
  const known = new Set(c.groups.map((g) => g.key));
  // 「11.0%」 → 「11%」 로 줄여 쓴 값도 표의 값으로 인정(같은 숫자)
  const grounding = `${c.grounding}\n${c.grounding.replace(/(\d+)\.0%/g, '$1%')}`;
  const keyIssue = (where: string, key: string): Issue | null => {
    if (row.has(key)) return null;
    if (known.has(key)) return issue(where, 'group_too_small', `「${key}」 묶음은 표본이 모자라 결론을 낼 수 없습니다. 표에 있는 묶음만 쓰세요.`);
    return issue(where, 'group_not_in_table', `「${key}」 는 표에 없는 묶음입니다. 표의 [ ] 안 키를 그대로 쓰세요.`);
  };
  return [
    (d) => (d.suggestions.length > c.max ? [issue('suggestions', 'too_many_suggestions', `제안은 ${c.max}개까지입니다(지금 ${d.suggestions.length}개).`)] : []),
    (d) =>
      d.suggestions.flatMap((s, i) => {
        const out: Issue[] = [];
        const w = `suggestions.${i}`;
        const k = keyIssue(`${w}.groupKey`, s.groupKey);
        if (k) out.push(k);
        if (!s.evidence.some((e) => e.groupKey === s.groupKey)) out.push(issue(`${w}.evidence`, 'evidence_missing_group', '근거에 제안한 묶음의 값이 없습니다. 그 묶음의 저장률이나 공유율을 근거로 넣으세요.'));
        s.evidence.forEach((e, j) => {
          const we = `${w}.evidence.${j}`;
          const ki = keyIssue(we, e.groupKey);
          if (ki) return void out.push(ki);
          const v = row.get(e.groupKey)![e.metric];
          if (v === null) out.push(issue(we, 'evidence_metric_too_small', `「${e.groupKey}」 의 ${e.metric === 'saveRate' ? '저장률' : '공유율'}은 표본이 모자라 값이 없습니다. 값이 있는 것만 인용하세요.`));
          else if (sameRate(e.value) !== sameRate(v)) out.push(issue(we, 'evidence_value_mismatch', `「${e.groupKey}」 의 ${e.metric === 'saveRate' ? '저장률' : '공유율'}은 표에서 "${v}" 입니다("${e.value}" 아님). 표의 글을 그대로 쓰세요.`));
        });
        if (sentenceCount(s.text) > 1) out.push(issue(`${w}.text`, 'text_not_one_sentence', '제안 문장은 한 문장으로 쓰세요 — 근거 값과 할 일을 「~로 …보다 높았던 …을 더 올린다」처럼 한 문장 안에 잇고, 마침표는 끝에 하나만.'));
        for (const [where, t] of [[`${w}.text`, s.text], [`${w}.rule`, s.rule]] as const)
          if (MULTIPLIER.test(t)) out.push(issue(where, 'multiplier_not_in_table', '「몇 배」 비교는 표에 없는 계산입니다. 표의 비율 글 두 개를 그대로 나란히 쓰세요.'));
        if (chars(s.text) > c.maxChars) out.push(issue(`${w}.text`, 'text_too_long', `제안 문장은 ${c.maxChars}자 이내로 쓰세요(지금 ${chars(s.text)}자).`));
        if (chars(s.rule) > c.ruleMaxChars) out.push(issue(`${w}.rule`, 'rule_too_long', `프로필 규칙은 ${c.ruleMaxChars}자 이내로 쓰세요(지금 ${chars(s.rule)}자).`));
        // 규칙은 프로필에 들어가 이후 생성의 근거(허용 출처 2번)가 된다 — 숫자가 있으면 그 숫자가 카드 · 제목 생성에서 통과해 버려서 아예 막는다
        if (/\p{Nd}/u.test(s.rule)) out.push(issue(`${w}.rule`, 'rule_has_number', '프로필 규칙에는 숫자를 쓰지 마세요(숫자는 제안 문장과 근거에만).'));
        for (const [where, t] of [[`${w}.text`, s.text], [`${w}.rule`, s.rule]] as const)
          for (const u of findUngrounded(t, { source: [grounding] }, c.commonTerms))
            out.push(issue(where, u.kind === 'number' ? 'number_not_in_table' : 'english_not_in_table', `표에 없는 ${u.kind === 'number' ? '숫자' : '영문'} "${u.value}" 을(를) 썼습니다. 표에 있는 값만 쓰세요.`));
        return out;
      }),
  ];
}

export type SuggestResult =
  | { status: 'saved'; count: number; calls: number; rewrites: number }
  | { status: 'not_enough'; message: string }
  | { status: 'failed'; errors: string[]; calls: number; rewrites: number };

export async function generateSuggestions(ai: AiService, brandId: number, job?: JobContext): Promise<SuggestResult> {
  return suggestFromGroups(ai, brandId, analysisFor(ai.db, brandId).groups, job);
}

/** 묶음 표 → 제안(생성 → 코드 규칙 → 자기 평가 → 재작성). 앱(generateSuggestions)과 측정 스크립트가 같은 길을 쓰도록 묶음만 밖에서 받는다 */
export async function suggestFromGroups(ai: AiService, brandId: number, groups: Group[], job?: JobContext): Promise<SuggestResult> {
  const db = ai.db;
  const min = getSetting(db, 'insights.minSamples');
  const t = insightTable(groups);
  // 결론 낼 묶음이 없거나(옛 표로 만든 제안) 실패한 실행도 옛 제안을 거둔다 — 화면이 「제안 없음」인데 옛 제안을 수락할 수 있으면 안 돼서
  if (t.rows.length === 0) recordSuggestionRun(db, brandId, null);
  if (t.rows.length === 0)
    return { status: 'not_enough', message: `결론을 낼 수 있는 묶음이 아직 없어요. 48시간이 지나고 도달 · 저장(또는 공유) 값이 있는 게시물이 한 묶음에 ${min}개 이상이어야 해요.` };
  const profile = profileForGeneration(db, brandId);
  const max = getSetting(db, 'insights.maxSuggestions');
  const maxChars = getSetting(db, 'insights.suggestionMaxChars');
  const ruleMaxChars = getSetting(db, 'insights.ruleMaxChars');
  const prompt = loadPrompt(db, 'insight_suggest', { table: t.text, profile: formatProfileForPrompt(profile), max: String(max), max_chars: String(maxChars), rule_max: String(ruleMaxChars) });
  const r = await generateChecked(
    ai,
    {
      task: 'insight_suggest',
      prompt: prompt.text,
      promptRef: prompt.ref,
      schema: SuggestSchema,
      rules: suggestRules({ groups, table: t.rows, grounding: t.grounding, max, maxChars, ruleMaxChars, commonTerms: commonEnglishTerms(db) }),
      reviewCriteria: loadPrompt(db, 'insight_suggest_review', {}).text,
      signal: job?.signal,
    },
    job,
  );
  if (!r.ok) recordSuggestionRun(db, brandId, r.jobId);
  if (!r.ok) return { status: 'failed', errors: r.errors.map((e) => `${e.where ?? ''} ${e.message}`.trim()), calls: r.calls, rewrites: r.rewrites };
  saveSuggestions(db, brandId, r.jobId, r.data.suggestions.map((s) => ({ ...s, text: s.text.trim(), rule: s.rule.trim() })), t.rows);
  return { status: 'saved', count: r.data.suggestions.length, calls: r.calls, rewrites: r.rewrites };
}

/** 수락 — 지금 프로필을 복사하고 규칙 한 줄을 더한 새 판(바로 적용). 이미 만료된 성과 항목은 새 판에 옮기지 않는다(이력 판에는 남는다) */
export function acceptSuggestion(db: Db, brandId: number, id: number, now: number = Date.now()): { profileId: number; expiresAt: string } {
  const s = getSuggestion(db, brandId, id);
  if (!s) throw new FlowError('제안을 찾지 못했어요.', '화면을 새로고침한 뒤 다시 시도하세요.');
  if (s.status !== 'pending') throw new FlowError('이미 반영했거나 넘긴 제안이에요.', '새 제안을 받으려면 「다음에 할 것 제안 받기」를 누르세요.');
  const p = activeProfile(db, brandId);
  if (!p) throw new FlowError('적용 중인 브랜드 프로필이 없어요.', '「정체성」에서 프로필을 확정한 뒤 다시 하세요.');
  const field = s.kind === 'more' ? 'voiceRules' : 'avoid';
  const keep = (xs: StoredText[]) => xs.filter((x) => x.origin !== 'insight' || isLive(x, now));
  const list = keep(p[field]);
  if (list.some((x) => x.text === s.rule)) throw new FlowError('프로필에 이미 같은 규칙이 있어요.', '넘기기를 누르세요.');
  if (list.length >= LIST_MAX[field])
    throw new FlowError(`${field === 'voiceRules' ? '말투 규칙' : '피할 것'}이 이미 ${LIST_MAX[field]}개예요.`, '「정체성」에서 하나를 지운 뒤 다시 반영하세요.');
  const expiresAt = new Date(now + getSetting(db, 'insights.acceptDays') * 86_400_000).toISOString();
  const item: StoredText = { text: s.rule, origin: 'insight', expiresAt };
  const content: ProfileContent = {
    accountLine: p.accountLine,
    accountLineOrigin: p.accountLineOrigin,
    audience: p.audience,
    audienceOrigin: p.audienceOrigin,
    pillars: p.pillars,
    dropped: p.dropped,
    voiceRules: field === 'voiceRules' ? [...list, item] : keep(p.voiceRules),
    avoid: field === 'avoid' ? [...list, item] : keep(p.avoid),
    unknown: p.unknown,
    presence: p.presence,
  };
  // job_id 는 비운다 — 제안 작업이 만든 것은 제안이고 판은 사용자의 수락이 만든 것이라(작업 콘솔이 제안 작업을 「프로필 N판」으로 잇지 않게)
  const profileId = saveProfileVersion(db, brandId, content, { reason: 'insight', sessionId: p.sessionId, basedOn: p.id, jobId: null, activate: true });
  decideSuggestion(db, id, { status: 'accepted', profileId, expiresAt });
  return { profileId, expiresAt };
}

export function rejectSuggestion(db: Db, brandId: number, id: number): void {
  const s = getSuggestion(db, brandId, id);
  if (!s) throw new FlowError('제안을 찾지 못했어요.', '화면을 새로고침한 뒤 다시 시도하세요.');
  if (s.status !== 'pending') throw new FlowError('이미 반영했거나 넘긴 제안이에요.', '화면을 새로고침하세요.');
  decideSuggestion(db, id, { status: 'rejected', profileId: null, expiresAt: null });
}
