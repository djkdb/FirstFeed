// 브랜딩 키트 · 글 (FR-BR-1): 아이디·표시 이름·바이오 후보 각 5개.
// 수용 기준: "글자 수 초과 없음. 바이오가 계정 정의와 축을 담는다" — 글자 수는 코드, 바이오의 내용은 자기 평가.
// 결정: CLAUDE.md 2026-10-14 · 브랜딩 키트 설계 (엄한 글자 수, URL 금지 + 링크 자리, @아이디)
import { z } from 'zod';
import { getSetting } from '../config.ts';
import type { AiService, JobContext } from '../ai/adapter.ts';
import { generateChecked } from '../ai/loop.ts';
import { loadPrompt } from '../ai/prompts.ts';
import { findUngrounded } from '../rules/grounding.ts';
import type { Issue, Rule } from '../rules/types.ts';
import { formatProfileForPrompt, profileForGeneration, profileGroundingTexts } from '../identity/for-generation.ts';
import { userAuthoredTexts } from '../identity/model.ts';
import { buildSources } from '../identity/sources.ts';
import { activeProfile, getSessionState } from '../identity/store.ts';
import { FlowError } from '../identity/flow.ts';
import { handleProblems, instagramLength, mentionsIn, URL_IN_TEXT } from './limits.ts';
import { saveKit } from './store.ts';
import type { DroppedCandidate, TextCandidate, WordsCandidates } from './types.ts';

const Candidate = z.object({ value: z.string().min(1).max(200), why: z.string().max(200) });
export const WordsSchema = z.object({
  handles: z.array(Candidate).min(5).max(7),
  display_names: z.array(Candidate).min(5).max(7),
  bios: z.array(Candidate).min(5).max(7),
});
export type WordsOutput = z.infer<typeof WordsSchema>;

const SHOW = 5;
type ListKey = 'handles' | 'display_names' | 'bios';
const LISTS: ListKey[] = ['handles', 'display_names', 'bios'];

export interface WordsLimits {
  handleMax: number;
  nameMax: number;
  /** 바이오 상한 = bioMax − 링크 자리 */
  bioMax: number;
}

export function wordsLimits(db: Parameters<typeof getSetting>[0]): WordsLimits {
  return {
    handleMax: getSetting(db, 'brand.handleMax'),
    nameMax: getSetting(db, 'brand.displayNameMax'),
    bioMax: getSetting(db, 'brand.bioMax') - getSetting(db, 'brand.bioLinkReserve'),
  };
}

const issue = (where: string, code: string, message: string): Issue => ({ level: 'error', code, where, message, from: 'rule' });

/** 허용 출처: 프로필 글 + 사용자의 답·직접 쓴 글 */
export function wordsRules(limits: WordsLimits, allowedTexts: string[]): Rule<WordsOutput>[] {
  const allowedMentions = new Set(allowedTexts.flatMap(mentionsIn));
  const dupes = (list: TextCandidate[], key: ListKey): Issue[] => {
    const seen = new Map<string, number>();
    return list.flatMap((c, i) => {
      const k = c.value.trim().toLowerCase();
      if (seen.has(k)) return [issue(`${key}.${i}`, 'duplicate_candidate', `${key}.${seen.get(k)} 과 같은 후보입니다.`)];
      seen.set(k, i);
      return [];
    });
  };
  return [
    (d) => [
      ...d.handles.flatMap((c, i) => handleProblems(c.value, limits.handleMax).map((p) => issue(`handles.${i}`, 'handle_rule', `아이디 "${c.value}": ${p}`))),
      ...dupes(d.handles, 'handles'),
    ],
    (d) => [
      ...d.display_names.flatMap((c, i) => {
        const len = instagramLength(c.value);
        const out: Issue[] = [];
        if (len > limits.nameMax) out.push(issue(`display_names.${i}`, 'too_long', `표시 이름 "${c.value}" 이 ${len}자로 ${limits.nameMax}자를 넘습니다.`));
        // 표시 이름의 영문은 지어낸 이름(브랜드 느낌의 단어)일 수 있어 숫자만 대조한다
        for (const u of findUngrounded(c.value, { source: allowedTexts })) {
          if (u.kind === 'number') out.push(issue(`display_names.${i}`, 'number_not_in_source', `표시 이름의 숫자 "${u.value}" 가 프로필·답에 없습니다.`));
        }
        return out;
      }),
      ...dupes(d.display_names, 'display_names'),
    ],
    (d) => [
      ...d.bios.flatMap((c, i) => {
        const out: Issue[] = [];
        const where = `bios.${i}`;
        const len = instagramLength(c.value);
        if (len > limits.bioMax) out.push(issue(where, 'too_long', `바이오가 ${len}자로 ${limits.bioMax}자(링크 안내 자리를 뺀 상한)를 넘습니다.`));
        if (URL_IN_TEXT.test(c.value)) out.push(issue(where, 'url_in_bio', '바이오에 주소가 있습니다. 링크는 따로 있는 링크 칸에 넣으므로 바이오에서 빼세요.'));
        const mentions = mentionsIn(c.value);
        for (const m of mentions) {
          if (!allowedMentions.has(m)) out.push(issue(where, 'mention_not_in_source', `@${m} 은 프로필·답에 없는 아이디입니다. 없는 계정이나 다른 사람의 계정을 가리킬 수 있어 빼세요.`));
        }
        // @아이디·주소는 위에서 따로 알렸으므로 영문 대조에서는 뺀다 (같은 문제를 두 번 알리지 않게)
        const rest = c.value.replace(/@[a-z0-9._]+/gi, ' ').replace(new RegExp(`(?:${URL_IN_TEXT.source})\\S*`, 'gi'), ' ');
        for (const u of findUngrounded(rest, { source: allowedTexts })) {
          out.push(issue(where, u.kind === 'number' ? 'number_not_in_source' : 'english_not_in_source', `바이오의 ${u.kind === 'number' ? '숫자' : '영문 이름'} "${u.value}" 가 프로필·답에 없습니다.`));
        }
        return out;
      }),
      ...dupes(d.bios, 'bios'),
    ],
  ];
}

/** 문제가 어느 후보의 것인지 (where = "bios.2" …). 알 수 없으면 null — 모든 후보의 문제로 본다 */
export function candidateOf(issue: Issue): { list: ListKey; index: number } | null {
  const m = /^(handles|display_names|bios)\.(\d+)/.exec(issue.where ?? '');
  return m ? { list: m[1] as ListKey, index: Number(m[2]) } : null;
}

/** 걸린 후보만 빼고 각 목록에서 앞의 5개. 5개가 안 되면 있는 만큼 (화면이 알린다) */
export function pickCandidates(data: WordsOutput, errors: Issue[]): { picked: WordsCandidates; dropped: DroppedCandidate[] } {
  const dropped: DroppedCandidate[] = [];
  const keep = (key: ListKey): TextCandidate[] =>
    data[key]
      .filter((c, i) => {
        const mine = errors.filter((e) => {
          const at = candidateOf(e);
          return at && at.list === key && at.index === i;
        });
        if (mine.length) dropped.push({ kind: key, value: c.value, reasons: mine.map((e) => `[${e.code}] ${e.message}`) });
        return mine.length === 0;
      })
      .slice(0, SHOW);
  return { picked: { handles: keep('handles'), displayNames: keep('display_names'), bios: keep('bios') }, dropped };
}

/** 걸린 후보를 빼도 목록마다 5개가 남고, 어느 후보의 것인지 모를 문제가 없으면 다시 쓰지 않는다 */
export function enoughAfterDropping(errors: Issue[], data: WordsOutput): boolean {
  if (errors.some((e) => candidateOf(e) === null)) return false;
  return LISTS.every((key) => {
    const bad = new Set(errors.map(candidateOf).filter((a) => a && a.list === key).map((a) => a!.index));
    return data[key].length - bad.size >= SHOW;
  });
}

export interface WordsResult {
  kitId: number;
  profileId: number;
  candidates: WordsCandidates;
  dropped: DroppedCandidate[];
  calls: number;
  rewrites: number;
}

export async function generateWords(ai: AiService, brandId: number, job?: JobContext): Promise<WordsResult> {
  const profile = profileForGeneration(ai.db, brandId);
  const active = activeProfile(ai.db, brandId);
  if (!active) throw new FlowError('적용 중인 브랜드 프로필이 없습니다.', '「정체성」에서 프로필을 확정하세요.');
  const session = active.sessionId === null ? null : getSessionState(ai.db, active.sessionId);
  const answers = session ? buildSources(session.survey, session.turns).filter((s) => s.countsAsUserInput).map((s) => s.text) : [];
  const facts = [...answers, ...userAuthoredTexts(active)];
  const allowed = [...profileGroundingTexts(profile), ...facts];
  const limits = wordsLimits(ai.db);

  const prompt = loadPrompt(ai.db, 'brand_words', {
    profile: formatProfileForPrompt(profile),
    facts: facts.map((t) => `- ${t}`).join('\n') || '(없음)',
    handle_max: String(limits.handleMax),
    name_max: String(limits.nameMax),
    bio_max: String(limits.bioMax),
  });
  const criteria = loadPrompt(ai.db, 'brand_words_review', {}).text;
  const r = await generateChecked(
    ai,
    {
      task: 'brand_words',
      prompt: prompt.text,
      promptRef: prompt.ref,
      schema: WordsSchema,
      rules: wordsRules(limits, allowed),
      reviewCriteria: criteria,
      acceptByDropping: enoughAfterDropping,
      signal: job?.signal,
    },
    job,
  );
  const data = r.ok ? r.data : r.rejected;
  const errors = r.ok ? r.dropped : r.errors;
  // 끝까지 실패해도 걸리지 않은 후보는 살린다 (모든 후보의 문제가 있으면 아무것도 살리지 않는다)
  const { picked, dropped } = errors.some((e) => candidateOf(e) === null)
    ? { picked: { handles: [], displayNames: [], bios: [] }, dropped: errors.map((e) => ({ kind: 'all', value: '', reasons: [`[${e.code}] ${e.message}`] })) }
    : pickCandidates(data, errors);
  const kitId = saveKit(ai.db, brandId, profile.profileId, 'words', picked, dropped, r.jobId);
  return { kitId, profileId: profile.profileId, candidates: picked, dropped, calls: r.calls, rewrites: r.rewrites };
}
