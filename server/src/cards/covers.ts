// 표지 제목 후보 (FR-MK-1: 표지 제목 후보 6개 → 선택). 넉넉히(8개) 받아 규칙·렌더링에 걸린 것만 빼고 6개를 보인다.
// 렌더링은 고정 템플릿 판으로 실제로 그려서 잰다(lateRules) — "2줄 이내(한 줄 글자 수는 템플릿 기준)" 수용 기준
import { z } from 'zod';
import { env, getSetting } from '../config.ts';
import type { AiService, JobContext } from '../ai/adapter.ts';
import { generateChecked } from '../ai/loop.ts';
import { loadPrompt } from '../ai/prompts.ts';
import { findUngrounded } from '../rules/grounding.ts';
import type { Issue, Rule } from '../rules/types.ts';
import { renderFrame } from '../templates/render-frame.ts';
import type { CoverContent } from '../templates/types.ts';
import { cardContext, estimatedLines, profileBlock, type CardContext } from './context.ts';
import { countClaims, countMismatch } from './count.ts';

export const CoversSchema = z.object({
  titles: z
    .array(z.object({ headline: z.string().min(1).max(80), sub: z.string().max(80).nullable(), pillar_id: z.string(), why: z.string().max(200) }))
    .min(4)
    .max(12),
});
export type CoversOutput = z.infer<typeof CoversSchema>;

const issue = (i: number, code: string, message: string): Issue => ({ level: 'error', code, where: `titles.${i}`, message, from: 'rule' });
const indexOf = (e: Issue) => {
  const m = /^titles\.(\d+)/.exec(e.where ?? '');
  return m ? Number(m[1]) : null;
};

/** 표지 원고: 배지(chip)는 콘텐츠 축 이름 */
export function coverContent(c: CardContext, t: CoversOutput['titles'][number]): CoverContent {
  return { kind: 'cover', headline: t.headline, sub: t.sub, chip: c.profile.pillars.find((p) => p.id === t.pillar_id)?.name ?? null };
}

export function coverRules(c: CardContext, requested: number | null): Rule<CoversOutput>[] {
  const head = c.template.budget.cover?.headline;
  const sub = c.template.budget.cover?.sub;
  const [min, max] = c.bodyRange;
  const pillarIds = new Set(c.profile.pillars.map((p) => p.id));
  return [
    (d) =>
      d.titles.flatMap((t, i): Issue[] => {
        const out: Issue[] = [];
        // 개수 표현("5가지")은 아래 개수 규칙이 카드 수와 맞추므로 근거 대조에서 뺀다. 그 밖의 숫자는 구조 숫자로 봐주지 않는다 —
        // 범위(3~7)를 구조 숫자로 넣으면 지어낸 "3배" 가 통과한다(본문에서 같은 빈틈을 먼저 발견)
        const plain = countClaims(`${t.headline}\n${t.sub ?? ''}`).reduce((txt, cl) => txt.replace(cl.text, ' '), `${t.headline}\n${t.sub ?? ''}`.replace(/\*\*/g, ''));
        for (const u of findUngrounded(plain, c.grounding, c.commonTerms))
          out.push(issue(i, u.kind === 'number' ? 'number_not_in_source' : 'english_not_in_source', `소재·프로필·메모에 없는 ${u.kind === 'number' ? '숫자' : '영문 이름'} "${u.value}" 을(를) 썼습니다.`));
        if (head?.maxLines && estimatedLines(t.headline, head.charsPerLine) > head.maxLines)
          out.push(issue(i, 'too_long_for_template', `제목이 템플릿 기준(한 줄 약 ${head.charsPerLine}자 × ${head.maxLines}줄)보다 깁니다. 줄이세요.`));
        if (t.sub && sub?.maxLines && estimatedLines(t.sub, sub.charsPerLine) > sub.maxLines)
          out.push(issue(i, 'too_long_for_template', `부제가 템플릿 기준(한 줄 약 ${sub.charsPerLine}자 × ${sub.maxLines}줄)보다 깁니다.`));
        if (requested) {
          const m = countMismatch([t.headline, t.sub ?? ''], requested);
          if (m) out.push(issue(i, 'count_mismatch', m));
        } else {
          const values = new Set(countClaims(`${t.headline}\n${t.sub ?? ''}`).map((x) => x.value));
          if (values.size > 1) out.push(issue(i, 'count_mismatch', `개수 표현이 서로 다릅니다(${[...values].join('·')}). 하나로 맞추세요.`));
          else if ([...values].some((v) => v < min || v > max)) out.push(issue(i, 'count_mismatch', `개수 표현은 본문 카드 수가 되므로 ${min}~${max} 사이여야 합니다.`));
        }
        if (!pillarIds.has(t.pillar_id)) out.push(issue(i, 'unknown_pillar', `pillar_id "${t.pillar_id}" 는 프로필의 콘텐츠 축이 아닙니다.`));
        const dup = d.titles.findIndex((x, j) => j < i && x.headline.replace(/\s|\*/g, '') === t.headline.replace(/\s|\*/g, ''));
        if (dup >= 0) out.push(issue(i, 'duplicate_candidate', `titles.${dup} 와 같은 제목입니다.`));
        return out;
      }),
  ];
}

export interface CoverCandidate {
  index: number;
  headline: string;
  sub: string | null;
  pillarId: string;
  chip: string | null;
  why: string;
  /** 고정 틀로 그린 표지 (data: 주소) */
  png: string;
  scale: number;
}

export interface CoversResult {
  sourceId: number;
  requested: number | null;
  templateVersionId: number;
  profileId: number;
  candidates: CoverCandidate[];
  dropped: Array<{ headline: string; sub: string | null; reasons: string[] }>;
  calls: number;
  rewrites: number;
  /** 재작성·뺀 후보의 사유를 갈래별로 (측정 표용) */
  reasons: Record<string, number>;
}

/** 문제 코드 → 측정 갈래 */
export function reasonOf(code: string): string {
  if (code.startsWith('review_')) return '자기 평가';
  if (code === 'count_mismatch') return '개수 불일치';
  if (['text_overflow', 'too_many_lines', 'text_outside_card', 'text_outside_safe', 'text_overlap', 'too_long_for_template', 'font_fallback'].includes(code)) return '렌더링 넘침';
  if (['number_not_in_source', 'english_not_in_source', 'quote_not_in_source', 'quote_too_short'].includes(code)) return '근거 규칙';
  return '기타';
}

export async function generateCovers(
  ai: AiService,
  brandId: number,
  sourceId: number,
  requested: number | null,
  job?: JobContext,
  dataDir = env.dataDir,
): Promise<CoversResult> {
  const c = cardContext(ai.db, brandId, sourceId, dataDir);
  const ask = getSetting(ai.db, 'cards.coverAsk');
  const show = getSetting(ai.db, 'cards.coverShow');
  const head = c.template.budget.cover?.headline;
  const sub = c.template.budget.cover?.sub;
  const [min, max] = c.bodyRange;
  const prompt = loadPrompt(ai.db, 'cover_titles', {
    ask: String(ask),
    chars_per_line: String(head?.charsPerLine ?? 10),
    max_lines: String(head?.maxLines ?? 2),
    sub_chars: String(sub?.charsPerLine ?? 25),
    count_rule: requested
      ? `개수 표현(N가지·N단계·N개)을 쓰려면 반드시 **${requested}** 로 — 본문 카드가 ${requested}장이다`
      : `개수 표현(N가지·N단계·N개)을 쓰면 그 수가 본문 카드 수가 된다. 소재 양에 맞게 ${min}~${max} 사이로`,
    profile: profileBlock(c),
    memo: c.source.memo ?? '(없음)',
    source: c.source.body,
  });
  const criteria = loadPrompt(ai.db, 'cover_titles_review', {}).text;

  // 실제로 그린 표지는 후보를 보여 줄 때 다시 쓴다 (같은 원고를 두 번 그리지 않게)
  const drawn = new Map<string, { png: Buffer; scale: number }>();
  const reasons: Record<string, number> = {};
  const count = (errs: Issue[]) => errs.forEach((e) => (reasons[reasonOf(e.code)] = (reasons[reasonOf(e.code)] ?? 0) + 1));

  const r = await generateChecked(
    ai,
    {
      task: 'cover_titles',
      prompt: prompt.text,
      promptRef: prompt.ref,
      schema: CoversSchema,
      rules: coverRules(c, requested),
      reviewCriteria: criteria,
      signal: job?.signal,
      acceptByDropping: (errors, d) => errors.every((e) => indexOf(e) !== null) && d.titles.length - new Set(errors.map(indexOf)).size >= show,
      lateRules: [
        async (d, earlier) => {
          const bad = new Set(earlier.map(indexOf));
          const out: Issue[] = [];
          for (const [i, t] of d.titles.entries()) {
            if (bad.has(i)) continue;
            const content = coverContent(c, t);
            const fr = await renderFrame(ai.db, c.template.draft, c.template.look, content);
            if (fr.ok && fr.png) drawn.set(JSON.stringify(content), { png: fr.png, scale: fr.scale });
            else out.push(issue(i, fr.problems[0]?.code ?? 'text_overflow', [...fr.shorten.map((s) => s.message), ...fr.problems.map((p) => p.message)].slice(0, 2).join(' ')));
          }
          return out;
        },
      ],
    },
    job,
  );
  const data = r.ok ? r.data : r.rejected;
  const errors = r.ok ? r.dropped : r.errors;
  count(errors);
  const badIdx = new Set(errors.map(indexOf));
  const candidates: CoverCandidate[] = [];
  const dropped: CoversResult['dropped'] = [];
  for (const [i, t] of data.titles.entries()) {
    const content = coverContent(c, t);
    const d = drawn.get(JSON.stringify(content));
    if (badIdx.has(i) || !d || errors.some((e) => indexOf(e) === null)) {
      dropped.push({ headline: t.headline, sub: t.sub, reasons: errors.filter((e) => indexOf(e) === i || indexOf(e) === null).map((e) => `[${e.code}] ${e.message}`) });
      continue;
    }
    if (candidates.length < show)
      candidates.push({ index: i, headline: t.headline, sub: t.sub, pillarId: t.pillar_id, chip: content.chip ?? null, why: t.why, png: `data:image/png;base64,${d.png.toString('base64')}`, scale: d.scale });
  }
  return { sourceId, requested, templateVersionId: c.template.id, profileId: c.profile.profileId, candidates, dropped, calls: r.calls, rewrites: r.rewrites, reasons };
}
