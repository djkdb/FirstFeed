// 본문 N장 + 마무리 + 카드 그림 프롬프트 (FR-MK-1·2·8). 결정: CLAUDE.md 2026-10-15 · FR-MK-1
// - 표지의 개수 표현이 있으면 그 수 = 본문 카드 수, 없으면 사용자가 정한 수, 그것도 없으면 범위(3~7) 안에서 AI 가
// - 본문 카드마다 소재 원문 근거 인용 하나(코드 대조)
// - 고정 틀로 실제로 그려서 넘침을 잰다(lateRules) — 같은 재작성 2회 한도. 끝까지 넘치면 세트를 버리지 않고
//   어느 카드의 어느 칸이 얼마나 넘쳤는지 돌려줘서 사용자가 직접 줄이게 한다(저장은 줄인 뒤에)
import { z } from 'zod';
import { env, getSetting } from '../config.ts';
import type { AiService, JobContext } from '../ai/adapter.ts';
import { generateChecked } from '../ai/loop.ts';
import { loadPrompt } from '../ai/prompts.ts';
import { cardPeopleRule, imagePromptIssues } from '../brand/visual.ts';
import { englishTermsIn, findUngrounded, normalizeForQuote, numbersIn, quoteInSources } from '../rules/grounding.ts';
import { datedNumberIssues, datedNumbers } from '../rules/dated.ts';
import type { Issue, Rule } from '../rules/types.ts';
import { renderFrame, type FrameResult } from '../templates/render-frame.ts';
import type { BodyContent, ClosingContent, CoverContent, FrameContent } from '../templates/types.ts';
import { cardContext, estimatedLines, profileBlock, type CardContext } from './context.ts';
import { cardCountClaims, countClaims, countMismatch } from './count.ts';
import { reasonOf } from './covers.ts';
import { saveSet, type CardToSave } from './store.ts';
import { pillarIndexOf } from '../templates/variant.ts';

const CardV1 = z.object({
  title: z.string().min(1).max(60),
  text: z.string().min(1).max(600),
  evidence: z.string().min(1).max(400),
  image: z.object({ prompt: z.string().min(10).max(1200), filename: z.string().max(80) }).nullable(),
});
const Closing = z.object({ headline: z.string().min(1).max(80), sub: z.string().max(80).nullable() });

/**
 * 소재 밖 용어 풀이·비유 표시 (결정 2026-10-15 · 카드 풀이·그림 사람 규칙): 맞는지 코드로 잴 수 없어서 사람에게 보인다.
 * sentence 는 카드 글에 실제로 있는 문장, term 은 그 문장이 풀이하는 소재 원문의 용어 — 둘 다 코드가 대조한다
 */
const Gloss = z.object({ sentence: z.string().min(1).max(200), term: z.string().min(1).max(40) });
export type Gloss = z.infer<typeof Gloss>;

/** card_body v1 의 출력 — 풀이 칸이 없다. v1 을 다시 잴 때 그때와 같은 스키마로 돌리려고 남긴다 */
export const BodySchemaV1 = z.object({ cards: z.array(CardV1).min(1).max(12), closing: Closing });
/** card_body v2~: 카드마다 소재 밖 풀이·비유 문장 표시 */
export const BodySchema = z.object({ cards: z.array(CardV1.extend({ glosses: z.array(Gloss).max(5) })).min(1).max(12), closing: Closing });
export type BodyOutput = { cards: Array<z.infer<typeof CardV1> & { glosses?: Gloss[] }>; closing: z.infer<typeof Closing> };
export const schemaFor = (version: string): z.ZodType<BodyOutput> => (version === 'v1' ? BodySchemaV1 : BodySchema);

const CARD_IMAGE_NEEDS: Array<[RegExp, string]> = [
  [/\b4:5\b/, '비율 "4:5"'],
  [/1080\s*[x×]\s*1350/i, '크기 "1080x1350"'],
];

export interface ChosenCover {
  headline: string;
  sub: string | null;
  pillarId: string | null;
  chip: string | null;
}

const issue = (where: string, code: string, message: string): Issue => ({ level: 'error', code, where, message, from: 'rule' });

/** 본문 카드 수: 표지의 개수 표현 > 사용자가 정한 수 > 없음(범위 안에서 AI) */
export function targetCount(cover: ChosenCover, requested: number | null, sources: string[] = []): number | null {
  const claims = cardCountClaims([cover.headline, cover.sub ?? ''], sources);
  return claims[0]?.value ?? requested;
}

export function frames(c: CardContext, cover: ChosenCover, d: BodyOutput): FrameContent[] {
  const total = d.cards.length + 2;
  const coverFrame: CoverContent = { kind: 'cover', headline: cover.headline, sub: cover.sub, chip: cover.chip };
  const bodies: BodyContent[] = d.cards.map((x, i) => ({ kind: 'body', title: x.title, text: x.text, page: i + 2, total, chip: cover.chip }));
  const closing: ClosingContent = { kind: 'closing', headline: d.closing.headline, sub: d.closing.sub };
  return [coverFrame, ...bodies, closing];
}

/** 프레임 순서(0 표지, 1..N 본문, N+1 마무리) → 문제 위치 */
const whereOf = (idx: number, n: number) => (idx === 0 ? 'cover' : idx === n + 1 ? 'closing' : `cards.${idx - 1}`);

/**
 * 고정 규칙(사용자가 직접 고친 글에도 다시 거는 것): 템플릿 글자 수 미리 거르기·개수 일치.
 * 근거 규칙은 AI 가 쓴 글에만 — 사용자가 직접 고친 글은 허용 출처 4번(결정 2026-10-15)
 */
export function fixedRules(c: CardContext, cover: ChosenCover, count: number | null, estimate = true): Rule<BodyOutput>[] {
  const b = c.template.budget;
  const [min, max] = c.bodyRange;
  return [
    (d) => {
      const out: Issue[] = [];
      if (count !== null && d.cards.length !== count) out.push(issue('cards', 'count_mismatch', `본문 카드가 ${d.cards.length}장입니다. 표지와 맞춰 정확히 ${count}장이어야 합니다.`));
      if (count === null && (d.cards.length < min || d.cards.length > max)) out.push(issue('cards', 'count_mismatch', `본문 카드는 ${min}~${max}장이어야 합니다(지금 ${d.cards.length}장).`));
      const m = countMismatch([cover.headline, cover.sub ?? ''], d.cards.length, c.grounding.source);
      out.push(...coverPromiseIssues(cover, d, c.commonTerms));
      if (m && count === null) out.push(issue('cards', 'count_mismatch', m));
      if (!estimate) return out;
      d.cards.forEach((x, i) => {
        const t = b.body?.title;
        if (t?.maxLines && estimatedLines(x.title, t.charsPerLine) > t.maxLines) out.push(issue(`cards.${i}.title`, 'too_long_for_template', `제목이 템플릿 기준(한 줄 약 ${t.charsPerLine}자 × ${t.maxLines}줄)보다 깁니다.`));
        const len = [...x.text.replace(/\*\*/g, '').replace(/\s/g, '')].length;
        const cap = b.body?.text?.maxChars;
        if (cap && len > cap) out.push(issue(`cards.${i}.text`, 'too_long_for_template', `본문이 ${len}자로 템플릿 기준(약 ${cap}자)보다 깁니다. 약 ${len - cap}자 줄이세요.`));
      });
      const ch = b.closing?.headline;
      if (ch?.maxLines && estimatedLines(d.closing.headline, ch.charsPerLine) > ch.maxLines)
        out.push(issue('closing', 'too_long_for_template', `마무리 제목이 템플릿 기준(한 줄 약 ${ch.charsPerLine}자 × ${ch.maxLines}줄)보다 깁니다.`));
      return out;
    },
  ];
}

/**
 * 표지가 꺼낸 사실은 본문이 지킨다(결정 2026-10-18 · A): 표지 제목·부제의 숫자·영문 이름은 본문 카드 어딘가에 있어야 한다.
 * 개수 표현(「5가지」)은 개수 규칙이 따로 보므로 빼고, 영문 약어 허용 목록(DM 등)은 이름이 아니라 뺀다.
 * 계기: sk-aigen 2회 — 표지 부제의 「50명 안팎 선발」을 본문이 빼서, 자기 평가 지적이 엇갈리다 실패(devlog 2026-10-18-01)
 */
export function coverFacts(cover: ChosenCover, commonTerms: readonly string[]): string[] {
  const raw = `${cover.headline}\n${cover.sub ?? ''}`.replace(/\*\*/g, '');
  const text = countClaims(raw).reduce((t, cl) => t.replace(cl.text, ' '), raw);
  const common = new Set(commonTerms.map((t) => t.toLowerCase()));
  return [...new Set([...numbersIn(text), ...englishTermsIn(text).filter((t) => !common.has(t.toLowerCase()))])];
}

export function coverPromiseIssues(cover: ChosenCover, d: BodyOutput, commonTerms: readonly string[]): Issue[] {
  const body = d.cards.map((x) => `${x.title}\n${x.text}`).join('\n');
  const nums = new Set(numbersIn(body));
  const lower = body.toLowerCase();
  const missing = coverFacts(cover, commonTerms).filter((f) => (/^\d/.test(f) ? !nums.has(f) : !lower.includes(f.toLowerCase())));
  return missing.length ? [issue('cards', 'cover_fact_missing', `표지가 꺼낸 ${missing.map((f) => `"${f}"`).join(', ')} 이(가) 본문 카드에 없습니다. 표지는 약속이라 본문 카드 어딘가에 써야 합니다.`)] : [];
}

/** AI 가 쓴 글에 거는 규칙: 근거(숫자·영문)·근거 인용·그림 프롬프트 */
export function aiRules(c: CardContext, minQuote: number): Rule<BodyOutput>[] {
  return [
    (d) => {
      const out: Issue[] = [];
      // 글 속 구조 숫자는 본문 카드 수 하나뿐 — 쪽 번호는 템플릿이 그리지 AI 가 글에 쓰지 않는다.
      // 처음엔 쪽 번호(1~N+2)까지 넣었다가, 지어낸 "3배" 가 쪽 번호 3 과 같아 통과하는 것을 테스트를 쓰다 발견
      const structural = [d.cards.length];
      const ground = (where: string, text: string) => {
        for (const u of findUngrounded(text, { ...c.grounding, structural }, c.commonTerms))
          out.push(issue(where, u.kind === 'number' ? 'number_not_in_source' : 'english_not_in_source', `소재·프로필·메모에 없는 ${u.kind === 'number' ? '숫자' : '영문 이름'} "${u.value}" 을(를) 썼습니다.`));
      };
      d.cards.forEach((x, i) => {
        ground(`cards.${i}`, `${x.title}\n${x.text}`);
        if (!quoteInSources(x.evidence, c.grounding.source)) out.push(issue(`cards.${i}.evidence`, 'quote_not_in_source', `근거 인용이 소재 원문에 없습니다: "${x.evidence}"`));
        else if (normalizeForQuote(x.evidence).length < minQuote) out.push(issue(`cards.${i}.evidence`, 'quote_too_short', `근거 인용이 너무 짧습니다(${minQuote}자 이상).`));
        if (x.image) out.push(...imagePromptIssues(`cards.${i}.image`, x.image, CARD_IMAGE_NEEDS, cardPeopleRule(c.profile.presence)));
        out.push(...glossIssues(`cards.${i}`, x, c.grounding.source));
      });
      ground('closing', `${d.closing.headline}\n${d.closing.sub ?? ''}`);
      // 기준일 숫자(결정 2026-10-18 · B): 본문 카드에 나온 것은 본문 카드 중 한 곳에 기준일이 같이(표지는 예외)
      for (const p of datedNumberIssues(d.cards.map((x, i) => ({ where: `cards.${i}`, text: `${x.title}\n${x.text}` })), datedNumbers(c.source.body)))
        out.push(issue(p.where, 'dated_number_without_date', `"${p.number}" 은 소재에서 「${p.date.text} 기준」 숫자입니다. 이 숫자가 나오는 카드 중 한 곳에 기준일(${p.date.text})을 같이 쓰세요.`));
      return out;
    },
  ];
}

/**
 * 풀이 표시의 코드 규칙: 표시한 문장이 카드 글에 실제로 있는가, 풀이하는 용어가 소재 원문에 있는가.
 * 소재에 없는 용어를 새로 꺼내 설명하는 것은 안 된다(결정 2026-10-15). 문장 속 숫자·영문은 카드 글 전체의 근거 규칙이 이미 본다
 */
export function glossIssues(where: string, card: BodyOutput['cards'][number], sources: string[]): Issue[] {
  const out: Issue[] = [];
  const cardText = normalizeForQuote(`${card.title}\n${card.text.replace(/\*\*/g, '')}`);
  const src = sources.map(normalizeForQuote);
  (card.glosses ?? []).forEach((g, j) => {
    if (!cardText.includes(normalizeForQuote(g.sentence)))
      out.push(issue(`${where}.glosses.${j}`, 'gloss_not_in_card', `표시한 풀이 문장이 카드 글에 없습니다: "${g.sentence.slice(0, 40)}". 카드 글의 문장을 그대로 옮기세요.`));
    if (!src.some((x) => x.includes(normalizeForQuote(g.term))))
      out.push(issue(`${where}.glosses.${j}`, 'gloss_term_not_in_source', `풀이한 용어 "${g.term}" 이 소재 원문에 없습니다. 소재에 나온 용어만 풀이하세요.`));
  });
  return out;
}

/** 저장할 때: 사용자가 직접 고쳐서 카드 글에서 사라진 풀이 문장은 표시에서 뺀다(고친 글은 사용자 글이라) */
export function glossesStillIn(card: BodyOutput['cards'][number]): Gloss[] {
  const cardText = normalizeForQuote(`${card.title}\n${card.text.replace(/\*\*/g, '')}`);
  return (card.glosses ?? []).filter((g) => cardText.includes(normalizeForQuote(g.sentence)));
}

export interface RenderedCard {
  kind: 'cover' | 'body' | 'closing';
  content: FrameContent;
  result: FrameResult;
}

/** 모든 카드를 고정 틀로 그린다. 넘친 카드는 문제로 */
export async function renderAll(ai: AiService, c: CardContext, cover: ChosenCover, d: BodyOutput): Promise<{ rendered: RenderedCard[]; issues: Issue[] }> {
  const rendered: RenderedCard[] = [];
  const issues: Issue[] = [];
  const fs = frames(c, cover, d);
  for (const [idx, content] of fs.entries()) {
    // 축 색 변형은 표지에만(renderFrame 이 본문 · 마무리는 그대로 둔다) — 표지 후보 때와 같은 축 번호
    const result = await renderFrame(ai.db, c.template.draft, c.template.look, content, { pillarIndex: pillarIndexOf(c.profile.pillars, cover.pillarId) });
    rendered.push({ kind: content.kind as RenderedCard['kind'], content, result });
    if (!result.ok)
      issues.push(issue(whereOf(idx, d.cards.length), result.problems[0]?.code ?? 'text_overflow', [...result.shorten.map((s) => s.message), ...result.problems.map((p) => p.message)].slice(0, 2).join(' ')));
  }
  return { rendered, issues };
}

export interface Overflow {
  /** cover · cards.N · closing */
  where: string;
  slot: string;
  message: string;
}

export type BodyResult =
  | { status: 'saved'; setId: number; calls: number; rewrites: number; edited: false }
  | {
      /** 2회를 다 쓰고도 넘침만 남았다 — 사용자가 직접 줄이면 저장 (저장 전) */
      status: 'needs_edit';
      /** 직접 줄여 저장할 때 다시 쓰는 생성 입력 */
      input: BodyJobInput;
      draft: BodyOutput;
      overflows: Overflow[];
      /** 넘치지 않은 카드는 미리 보기로 */
      previews: Array<{ where: string; png: string | null }>;
      calls: number;
      rewrites: number;
    }
  | { status: 'failed'; errors: string[]; calls: number; rewrites: number };

export interface BodyJobInput {
  sourceId: number;
  cover: ChosenCover;
  requested: number | null;
  coverJobId: string | null;
}

const RENDER_CODES = new Set(['text_overflow', 'too_many_lines', 'text_outside_card', 'text_outside_safe', 'text_overlap', 'too_long_for_template']);

function toSave(rendered: RenderedCard[], d: BodyOutput, editedWheres: Set<string> = new Set()): CardToSave[] {
  return rendered.map((r, idx) => {
    const where = whereOf(idx, d.cards.length);
    const card = r.kind === 'body' ? d.cards[idx - 1]! : null;
    return {
      kind: r.kind,
      content: r.content,
      evidence: card?.evidence ?? null,
      image: card?.image ?? null,
      glosses: card ? glossesStillIn(card) : [],
      edited: editedWheres.has(where),
      png: r.result.png!,
      render: { browser: `${r.result.browser.kind} ${r.result.browser.version}`, reference: r.result.browser.reference, scale: r.result.scale },
    };
  });
}

export async function generateBody(ai: AiService, brandId: number, input: BodyJobInput, job?: JobContext, dataDir = env.dataDir): Promise<BodyResult> {
  const c = cardContext(ai.db, brandId, input.sourceId, dataDir);
  const count = targetCount(input.cover, input.requested, c.grounding.source);
  const b = c.template.budget;
  const [min, max] = c.bodyRange;
  const prompt = loadPrompt(ai.db, 'card_body', {
    count_text: count ? `**정확히 ${count}장**` : `소재 양에 맞게 ${min}~${max}장`,
    cover_headline: input.cover.headline,
    cover_sub: input.cover.sub ?? '(없음)',
    title_chars: String(b.body?.title?.charsPerLine ?? 15),
    title_lines: String(b.body?.title?.maxLines ?? 2),
    text_chars: String(b.body?.text?.maxChars ?? 250),
    closing_chars: String(b.closing?.headline?.charsPerLine ?? 12),
    closing_lines: String(b.closing?.headline?.maxLines ?? 3),
    profile: profileBlock(c),
    memo: c.source.memo ?? '(없음)',
    source: c.source.body,
    cover_facts: coverFacts(input.cover, c.commonTerms).map((f) => `- ${f}`).join('\n') || '(없음)',
    dated_numbers: [...datedNumbers(c.source.body)].map(([n, d]) => `- ${n} → ${d.text} 기준`).join('\n') || '(없음)',
  }, undefined, ['cover_facts', 'dated_numbers']); // v1·v2 에는 없는 칸
  const criteria = loadPrompt(ai.db, 'card_body_review', {}).text;
  let last: { rendered: RenderedCard[]; issues: Issue[]; key: string } | null = null;

  const r = await generateChecked(
    ai,
    {
      task: 'card_body',
      prompt: prompt.text,
      promptRef: prompt.ref,
      schema: schemaFor(prompt.ref.version),
      rules: [...fixedRules(c, input.cover, count), ...aiRules(c, getSetting(ai.db, 'cards.minQuoteChars'))],
      reviewCriteria: criteria,
      signal: job?.signal,
      lateRules: [
        async (d) => {
          const out = await renderAll(ai, c, input.cover, d);
          last = { ...out, key: JSON.stringify(d) };
          return out.issues;
        },
      ],
    },
    job,
  );

  const done = last as { rendered: RenderedCard[]; issues: Issue[]; key: string } | null;
  if (r.ok && done && done.key === JSON.stringify(r.data) && done.issues.length === 0) {
    const setId = saveSet(ai.db, dataDir, {
      brandId,
      sourceId: input.sourceId,
      profileId: c.profile.profileId,
      templateVersionId: c.template.id,
      pillarId: input.cover.pillarId,
      edited: false,
      coverJobId: input.coverJobId,
      bodyJobId: job?.jobId ?? null,
      cards: toSave(done.rendered, r.data),
    });
    return { status: 'saved', setId, calls: r.calls, rewrites: r.rewrites, edited: false };
  }
  if (!r.ok && r.errors.every((e) => RENDER_CODES.has(e.code))) {
    // 넘침만 남았다 — 버리지 않고 사용자가 직접 줄이게 (저장은 줄인 뒤)
    const rendered = done && done.key === JSON.stringify(r.rejected) ? done.rendered : (await renderAll(ai, c, input.cover, r.rejected)).rendered;
    return {
      status: 'needs_edit',
      input,
      draft: r.rejected,
      overflows: r.errors.map((e) => ({ where: e.where ?? '', slot: e.where?.split('.').pop() ?? '', message: e.message })),
      previews: rendered.map((x, idx) => ({ where: whereOf(idx, r.rejected.cards.length), png: x.result.png ? `data:image/png;base64,${x.result.png.toString('base64')}` : null })),
      calls: r.calls,
      rewrites: r.rewrites,
    };
  }
  return { status: 'failed', errors: (r.ok ? [] : r.errors).map((e) => `[${e.code}] ${e.where ?? ''} ${e.message}`), calls: r.calls, rewrites: r.rewrites };
}

export { reasonOf };

export interface CardEdit {
  /** cards.N 또는 closing */
  where: string;
  title?: string;
  text?: string;
  headline?: string;
  sub?: string | null;
}

/**
 * 사용자가 넘친 칸을 직접 줄인 뒤 저장 (결정 2026-10-15 · FR-MK-1).
 * 직접 고친 글은 허용 출처 4번이라 근거 규칙은 다시 걸지 않고 고정 규칙(개수 일치)과 실제 렌더링만 — 바이오 때와 같은 원칙.
 * 글자 수 미리 거르기는 어림이라 사용자 글에는 걸지 않고 렌더링이 판정한다. 통과해야 저장한다
 */
export async function finishWithEdits(
  ai: AiService,
  brandId: number,
  input: BodyJobInput,
  draft: BodyOutput,
  edits: CardEdit[],
  jobId: string | null,
  dataDir = env.dataDir,
): Promise<{ status: 'saved'; setId: number } | { status: 'needs_edit'; overflows: Overflow[]; problems: string[] }> {
  const c = cardContext(ai.db, brandId, input.sourceId, dataDir);
  const d: BodyOutput = structuredClone(draft);
  const edited = new Set<string>();
  for (const e of edits) {
    if (e.where === 'closing') {
      if (e.headline !== undefined) d.closing.headline = e.headline;
      if (e.sub !== undefined) d.closing.sub = e.sub;
    } else {
      const m = /^cards\.(\d+)$/.exec(e.where);
      const card = m ? d.cards[Number(m[1])] : undefined;
      if (!card) continue;
      if (e.title !== undefined) card.title = e.title;
      if (e.text !== undefined) card.text = e.text;
    }
    edited.add(e.where);
  }
  const count = targetCount(input.cover, input.requested, c.grounding.source);
  const ruleProblems = fixedRules(c, input.cover, count, false).flatMap((r) => r(d));
  if (ruleProblems.length) return { status: 'needs_edit', overflows: [], problems: ruleProblems.map((p) => p.message) };
  const { rendered, issues } = await renderAll(ai, c, input.cover, d);
  if (issues.length) return { status: 'needs_edit', overflows: issues.map((e) => ({ where: e.where ?? '', slot: e.where?.split('.').pop() ?? '', message: e.message })), problems: [] };
  const setId = saveSet(ai.db, dataDir, {
    brandId,
    sourceId: input.sourceId,
    profileId: c.profile.profileId,
    templateVersionId: c.template.id,
    pillarId: input.cover.pillarId,
    edited: true,
    coverJobId: input.coverJobId,
    bodyJobId: jobId,
    cards: toSave(rendered, d, edited),
  });
  return { status: 'saved', setId };
}
