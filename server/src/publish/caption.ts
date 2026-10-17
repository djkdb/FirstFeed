// 중간 발표용 최소 캡션 (FR-PB-1 · 결정 2026-10-18): 첫 줄 + 핵심 몇 줄 + 해시태그. AI 1번 + 자기 평가.
// 근거 규칙(findUngrounded + 영문 약어 허용 목록)·풀이 표시 규칙은 카드와 똑같이. 해시태그 개수는 코드가 자른다(재작성 사유 아님).
// 제대로 된 캡션·고정 댓글·DM 은 FR-MK-7(F)
import { z } from 'zod';
import { env, getSetting } from '../config.ts';
import type { AiService, JobContext } from '../ai/adapter.ts';
import { generateChecked } from '../ai/loop.ts';
import { loadPrompt } from '../ai/prompts.ts';
import { cardContext, profileBlock } from '../cards/context.ts';
import { getSet, type GlossMark } from '../cards/store.ts';
import { findUngrounded, normalizeForQuote } from '../rules/grounding.ts';
import type { Issue, Rule } from '../rules/types.ts';
import { getCaption, saveCaption, updateCaptionGlosses } from './store.ts';

const Gloss = z.object({ sentence: z.string().min(1).max(200), term: z.string().min(1).max(40) });
export const CaptionSchema = z.object({
  hook: z.string().min(1).max(80),
  lines: z.array(z.string().min(1).max(160)).min(1).max(5),
  hashtags: z.array(z.string().min(2).max(40)).max(30),
  glosses: z.array(Gloss).max(5),
});
export type CaptionOutput = z.infer<typeof CaptionSchema>;

const issue = (where: string, code: string, message: string): Issue => ({ level: 'error', code, where, message, from: 'rule' });

/** 해시태그 정리: 모양이 맞는 것만, 같은 것은 하나로, 상한까지만 (코드가 자른다) */
export function trimHashtags(tags: string[], max: number): { kept: string[]; cut: string[] } {
  const seen = new Set<string>();
  const ok = tags.map((t) => t.trim()).filter((t) => /^#[^\s#]+$/.test(t) && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
  return { kept: ok.slice(0, max), cut: ok.slice(max) };
}

/**
 * 근거: 소재·프로필·메모 + **이미 검증된 카드 글**(표지의 「5가지」 같은 개수가 여기 있다). 구조 숫자(카드 수)는 따로 허용하지 않는다 —
 * 카드 수를 허용했더니 지어낸 「3배」가 본문 카드 3장과 같아 통과했다(테스트로 발견, 카드 본문 때와 같은 함정)
 */
export function captionRules(c: ReturnType<typeof cardContext>, cardTexts: string[]): Rule<CaptionOutput>[] {
  return [
    (d) => {
      const out: Issue[] = [];
      const ground = (where: string, text: string) => {
        for (const u of findUngrounded(text, { ...c.grounding, source: [...c.grounding.source, ...cardTexts], structural: [] }, c.commonTerms))
          out.push(issue(where, u.kind === 'number' ? 'number_not_in_source' : 'english_not_in_source', `소재·카드·프로필·메모에 없는 ${u.kind === 'number' ? '숫자' : '영문 이름'} "${u.value}" 을(를) 썼습니다.`));
      };
      ground('hook', d.hook);
      d.lines.forEach((l, i) => ground(`lines.${i}`, l));
      // 영문 해시태그도 지어낸 이름이 될 수 있어 같은 대조를 건다 (#claudecode 처럼 원문에 있으면 통과)
      ground('hashtags', d.hashtags.map((t) => t.replace(/^#/, '')).join(' '));
      d.hashtags.forEach((t, i) => {
        if (!/^#[^\s#]+$/.test(t.trim())) out.push(issue(`hashtags.${i}`, 'hashtag_format', `해시태그 "${t}" 는 '#' 으로 시작하고 띄어쓰기 없이 쓰세요.`));
      });
      // 풀이 표시: 카드와 같은 규칙 — 표시한 문장이 캡션에 있는가, 풀이하는 용어가 소재 원문에 있는가
      const text = normalizeForQuote([d.hook, ...d.lines].join('\n'));
      const src = c.grounding.source.map(normalizeForQuote);
      d.glosses.forEach((g, j) => {
        if (!text.includes(normalizeForQuote(g.sentence))) out.push(issue(`glosses.${j}`, 'gloss_not_in_card', `표시한 풀이 문장이 캡션에 없습니다: "${g.sentence.slice(0, 40)}".`));
        if (!src.some((x) => x.includes(normalizeForQuote(g.term)))) out.push(issue(`glosses.${j}`, 'gloss_term_not_in_source', `풀이한 용어 "${g.term}" 이 소재 원문에 없습니다. 소재에 나온 용어만 풀이하세요.`));
      });
      return out;
    },
  ];
}

export type CaptionResult = { status: 'saved'; calls: number; rewrites: number; cutHashtags: string[] } | { status: 'failed'; errors: string[]; calls: number; rewrites: number };

export async function generateCaption(ai: AiService, brandId: number, setId: number, job?: JobContext, dataDir = env.dataDir): Promise<CaptionResult> {
  const set = getSet(ai.db, setId);
  if (!set) return { status: 'failed', errors: ['카드 세트를 찾지 못했습니다.'], calls: 0, rewrites: 0 };
  const c = cardContext(ai.db, brandId, set.sourceId, dataDir);
  const max = getSetting(ai.db, 'publish.maxHashtags');
  const cards = set.cards
    .map((x) => `${x.idx + 1}. [${x.kind}] ${Object.entries(x.content).filter(([k, v]) => typeof v === 'string' && k !== 'kind').map(([, v]) => String(v).replace(/\n/g, ' / ')).join(' | ')}`)
    .join('\n');
  const prompt = loadPrompt(ai.db, 'caption_min', { max_hashtags: String(max), cards, profile: profileBlock(c), memo: c.source.memo ?? '(없음)', source: c.source.body });
  const cardTexts = set.cards.map((x) => Object.values(x.content).filter((v): v is string => typeof v === 'string').join('\n'));
  const r = await generateChecked(
    ai,
    { task: 'caption_min', prompt: prompt.text, promptRef: prompt.ref, schema: CaptionSchema, rules: captionRules(c, cardTexts), reviewCriteria: loadPrompt(ai.db, 'caption_min_review', {}).text, signal: job?.signal },
    job,
  );
  if (!r.ok) return { status: 'failed', errors: r.errors.map((e) => `[${e.code}] ${e.where ?? ''} ${e.message}`), calls: r.calls, rewrites: r.rewrites };
  const { kept, cut } = trimHashtags(r.data.hashtags, max);
  saveCaption(ai.db, { setId, hook: r.data.hook, lines: r.data.lines, hashtags: kept, glosses: r.data.glosses, edited: false }, job?.jobId ?? null);
  return { status: 'saved', calls: r.calls, rewrites: r.rewrites, cutHashtags: cut };
}

/**
 * 캡션을 사용자가 직접 고친다 — 사용자 글(허용 출처 4번)이라 근거 규칙은 걸지 않고, 해시태그 정리(모양·개수)만.
 * 고친 글 전체가 사용자 글이 되므로 풀이 표시는 남기지 않는다
 */
export function editCaption(db: Parameters<typeof saveCaption>[0], setId: number, input: { hook: string; lines: string[]; hashtags: string[] }): { cut: string[] } {
  const { kept, cut } = trimHashtags(input.hashtags, getSetting(db, 'publish.maxHashtags'));
  saveCaption(db, { setId, hook: input.hook.trim(), lines: input.lines.map((l) => l.trim()).filter(Boolean), hashtags: kept, glosses: [], edited: true }, null);
  return { cut };
}

export function checkCaptionGloss(db: Parameters<typeof saveCaption>[0], setId: number, sentence: string, checked: boolean): GlossMark[] | null {
  const cap = getCaption(db, setId);
  if (!cap || !cap.glosses.some((g) => g.sentence === sentence)) return null;
  const next = cap.glosses.map((g) => (g.sentence === sentence ? { ...g, checkedAt: checked ? new Date().toISOString() : null } : g));
  updateCaptionGlosses(db, setId, next);
  return next;
}
