// 브랜딩 키트 · 시각 (FR-BR-2·3·4): 팔레트 3안·폰트 짝 3안·그림 프롬프트.
// 수용 기준: 명암비 4.5:1 미달 조합은 내지 않는다(코드) / 목록 안의 폰트만, 라이선스 표시 / 프롬프트에 크기·비율·"글자 없음".
// 결정(CLAUDE.md 2026-10-14): 자기 평가 없이 코드 규칙만 — 수용 기준을 모두 코드로 잴 수 있고, 취향 지적은 재작성 사유가 아니다.
import { z } from 'zod';
import { getSetting } from '../config.ts';
import type { AiService, JobContext } from '../ai/adapter.ts';
import { generateChecked } from '../ai/loop.ts';
import { loadPrompt } from '../ai/prompts.ts';
import type { Issue, Rule } from '../rules/types.ts';
import { formatProfileForPrompt, profileForGeneration } from '../identity/for-generation.ts';
import { fontById, formatFontsForPrompt } from './fonts.ts';
import { contrastRatio } from './limits.ts';
import { saveKit } from './store.ts';
import type { DroppedCandidate, FontPair, ImagePrompt, PaletteChecked, VisualCandidates } from './types.ts';

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const VisualSchema = z.object({
  palettes: z
    .array(z.object({ name: z.string().min(1).max(30), colors: z.object({ primary: Hex, secondary: Hex, accent: Hex, background: Hex, text: Hex }), why: z.string().max(200) }))
    .min(3)
    .max(5),
  font_pairs: z.array(z.object({ title: z.string(), body: z.string(), why: z.string().max(200) })).min(3).max(5),
  image_prompts: z
    .array(z.object({ target: z.enum(['profile', 'highlight']), label: z.string().max(30), prompt: z.string().min(10).max(1200), filename: z.string().max(80) }))
    .min(1)
    .max(8),
});
export type VisualOutput = z.infer<typeof VisualSchema>;

const SHOW = 3;
const issue = (where: string, code: string, message: string): Issue => ({ level: 'error', code, where, message, from: 'rule' });

export function checkPalette(p: VisualOutput['palettes'][number]): PaletteChecked {
  const c = p.colors;
  return {
    ...p,
    contrast: {
      textOnBackground: contrastRatio(c.text, c.background),
      // 주색 바탕(예: 카드 표지) 위에 글자로 쓸 수 있는 색이 하나라도 있는가
      bestOnPrimary: Math.max(contrastRatio(c.text, c.primary), contrastRatio(c.background, c.primary)),
    },
  };
}

const PROMPT_NEEDS: Record<ImagePrompt['target'], Array<[RegExp, string]>> = {
  profile: [
    [/\b1:1\b/, '비율 "1:1"'],
    [/1080\s*[x×]\s*1080/i, '크기 "1080x1080"'],
  ],
  highlight: [
    [/\b9:16\b/, '비율 "9:16"'],
    [/1080\s*[x×]\s*1920/i, '크기 "1080x1920"'],
  ],
};

export function visualRules(minContrast: number): Rule<VisualOutput>[] {
  return [
    (d) =>
      d.palettes.flatMap((p, i): Issue[] => {
        const { contrast } = checkPalette(p);
        const out: Issue[] = [];
        if (contrast.textOnBackground < minContrast)
          out.push(issue(`palettes.${i}`, 'low_contrast', `팔레트 "${p.name}" 의 글자/배경 명암비가 ${contrast.textOnBackground.toFixed(2)}:1 로 ${minContrast}:1 미만입니다.`));
        if (contrast.bestOnPrimary < minContrast)
          out.push(issue(`palettes.${i}`, 'low_contrast_on_primary', `팔레트 "${p.name}" 의 주색 위에 올릴 글자색이 없습니다(최고 ${contrast.bestOnPrimary.toFixed(2)}:1).`));
        const same = d.palettes.findIndex((q, j) => j < i && JSON.stringify(q.colors).toLowerCase() === JSON.stringify(p.colors).toLowerCase());
        if (same >= 0) out.push(issue(`palettes.${i}`, 'duplicate_candidate', `palettes.${same} 와 같은 색입니다.`));
        return out;
      }),
    (d) =>
      d.font_pairs.flatMap((f, i): Issue[] => {
        const out: Issue[] = [];
        const t = fontById(f.title);
        const b = fontById(f.body);
        if (!t) out.push(issue(`font_pairs.${i}`, 'font_not_in_list', `제목 폰트 "${f.title}" 는 목록에 없습니다. 목록의 id 로만 고르세요.`));
        else if (!t.roles.includes('title')) out.push(issue(`font_pairs.${i}`, 'font_role', `"${t.name}" 은 제목용이 아닙니다.`));
        if (!b) out.push(issue(`font_pairs.${i}`, 'font_not_in_list', `본문 폰트 "${f.body}" 는 목록에 없습니다. 목록의 id 로만 고르세요.`));
        else if (!b.roles.includes('body')) out.push(issue(`font_pairs.${i}`, 'font_role', `"${b.name}" 은 본문용이 아닙니다.`));
        const same = d.font_pairs.findIndex((q, j) => j < i && q.title === f.title && q.body === f.body);
        if (same >= 0) out.push(issue(`font_pairs.${i}`, 'duplicate_candidate', `font_pairs.${same} 와 같은 짝입니다.`));
        return out;
      }),
    (d) =>
      d.image_prompts.flatMap((p, i): Issue[] => {
        const out: Issue[] = [];
        const where = `image_prompts.${i}`;
        if (/[ㄱ-ㆎ가-힣]/.test(p.prompt)) out.push(issue(where, 'prompt_not_english', '그림 프롬프트에 한글이 있습니다. 영어로 쓰세요.'));
        if (!/\bno text\b/i.test(p.prompt)) out.push(issue(where, 'prompt_missing_no_text', '그림 프롬프트에 "no text" 가 없습니다(FR-BR-4 수용 기준).'));
        for (const [re, label] of PROMPT_NEEDS[p.target]) if (!re.test(p.prompt)) out.push(issue(where, 'prompt_missing_size', `그림 프롬프트에 ${label} 이 없습니다(FR-BR-4 수용 기준).`));
        if (!/^[a-z0-9-]+\.png$/.test(p.filename)) out.push(issue(where, 'bad_filename', `파일 이름 "${p.filename}" 은 영문 소문자·숫자·하이픈과 .png 로 쓰세요.`));
        return out;
      }),
  ];
}

type ListKey = 'palettes' | 'font_pairs' | 'image_prompts';
export function candidateOf(e: Issue): { list: ListKey; index: number } | null {
  const m = /^(palettes|font_pairs|image_prompts)\.(\d+)/.exec(e.where ?? '');
  return m ? { list: m[1] as ListKey, index: Number(m[2]) } : null;
}

const badIndexes = (errors: Issue[], key: ListKey) => new Set(errors.map(candidateOf).filter((a) => a && a.list === key).map((a) => a!.index));

/** 빼도 팔레트 3·폰트 짝 3·프로필 프롬프트 1 이 남으면 다시 쓰지 않는다 */
export function enoughAfterDropping(errors: Issue[], d: VisualOutput): boolean {
  if (errors.some((e) => candidateOf(e) === null)) return false;
  const badP = badIndexes(errors, 'palettes');
  const badF = badIndexes(errors, 'font_pairs');
  const badI = badIndexes(errors, 'image_prompts');
  return (
    d.palettes.length - badP.size >= SHOW && d.font_pairs.length - badF.size >= SHOW && d.image_prompts.some((p, i) => p.target === 'profile' && !badI.has(i))
  );
}

export function pickVisual(d: VisualOutput, errors: Issue[]): { picked: VisualCandidates; dropped: DroppedCandidate[] } {
  const dropped: DroppedCandidate[] = [];
  const reasons = (key: ListKey, i: number) =>
    errors.filter((e) => {
      const a = candidateOf(e);
      return a && a.list === key && a.index === i;
    });
  const keep = <T>(key: ListKey, list: T[], label: (x: T) => string): T[] =>
    list.filter((x, i) => {
      const r = reasons(key, i);
      if (r.length) dropped.push({ kind: key, value: label(x), reasons: r.map((e) => `[${e.code}] ${e.message}`) });
      return r.length === 0;
    });
  const palettes = keep('palettes', d.palettes, (p) => p.name).slice(0, SHOW).map(checkPalette);
  const fontPairs: FontPair[] = keep('font_pairs', d.font_pairs, (f) => `${f.title} + ${f.body}`).slice(0, SHOW);
  const imagePrompts: ImagePrompt[] = keep('image_prompts', d.image_prompts, (p) => p.filename);
  return { picked: { palettes, fontPairs, imagePrompts }, dropped };
}

export interface VisualResult {
  kitId: number;
  profileId: number;
  candidates: VisualCandidates;
  dropped: DroppedCandidate[];
  calls: number;
  rewrites: number;
}

export async function generateVisual(ai: AiService, brandId: number, job?: JobContext): Promise<VisualResult> {
  const profile = profileForGeneration(ai.db, brandId);
  const minContrast = getSetting(ai.db, 'brand.minContrast');
  const prompt = loadPrompt(ai.db, 'brand_visual', {
    profile: formatProfileForPrompt(profile),
    fonts: formatFontsForPrompt(),
    min_contrast: String(minContrast),
  });
  const r = await generateChecked(
    ai,
    {
      task: 'brand_visual',
      prompt: prompt.text,
      promptRef: prompt.ref,
      schema: VisualSchema,
      rules: visualRules(minContrast),
      selfReview: false,
      acceptByDropping: enoughAfterDropping,
      signal: job?.signal,
    },
    job,
  );
  const data = r.ok ? r.data : r.rejected;
  const errors = r.ok ? r.dropped : r.errors;
  const { picked, dropped } = pickVisual(data, errors);
  const kitId = saveKit(ai.db, brandId, profile.profileId, 'visual', picked, dropped, r.jobId);
  return { kitId, profileId: profile.profileId, candidates: picked, dropped, calls: r.calls, rewrites: r.rewrites };
}
