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

/**
 * 프로필 사진 프롬프트의 실사 인물·나이·외모 (결정 2026-10-14 · 브랜딩 키트 다듬기).
 * 프로필 사진의 사람은 본인이어야 한다 — 얼굴 공개 여부와 상관없이 실사 인물을 만들게 하지 않는다.
 * "no people, not a real person" 처럼 부정한 말은 빼고 본다: no/not/without/never 부터 쉼표·마침표까지를 지운 나머지에서 찾는다
 */
const REAL_PERSON =
  /\b(?<!non-)(?:person|people|persons|man|men|woman|women|girl|boy|guy|lady|human|selfie|headshot|portrait|face (?:clearly )?visible|visible face|realistic photo(?:graph|graphy)?|photorealistic|photo-realistic)\b/i;
const AGE_LOOKS =
  /\b(?:in (?:his|her|their) (?:early |mid |late )?\d0s|\d{1,2}[- ]years?[- ]old|teen(?:ager)?s?|twenties|thirties|forties|middle-aged|elderly|hair(?:style)?|skin tone|beard|makeup|ethnicity|asian|korean (?:man|woman|girl|boy|person))\b/i;
/**
 * 신체 일부 (사용자 결정 2026-10-15): 본인이 아닌 사람의 몸이라 얼굴과 같은 이유로 막는다.
 * 흔한 그림 용어는 빼고 — hand-drawn·handwritten·handmade·hand-lettered·hands-on·by hand.
 * 넣기 전 실제 프롬프트 76개에 돌려 profile 19개 중 seoyeon v1 의 "two hands holding" 2개만 걸리는 것을 확인했다
 */
const BODY_PART =
  /(?<!\bby )\b(?:hands?|fingers?|fingertips?|palms?|wrists?|arms?|elbows?|legs?|knees?|feet|foot|toes?|shoulders?|torso|lap)\b(?![- ]?(?:drawn|written|writing|made|lettered|painted|crafted|held|picked|stitched|knit|cut)\b)(?!-on\b)/i;
export function withoutNegations(prompt: string): string {
  return prompt.replace(/\b(?:no|not|without|never|avoid)\b[^,.;:]*/gi, ' ');
}

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
    (d) => d.image_prompts.flatMap((p, i): Issue[] => imagePromptIssues(`image_prompts.${i}`, p, PROMPT_NEEDS[p.target], p.target === 'profile' ? 'forbid' : 'any')),
  ];
}

/**
 * 카드 그림의 사람 규칙 (결정 2026-10-15 · 카드 풀이·그림 사람 규칙): C안(실사 금지 · 그림체 허용) + 캐릭터 대체 · 실존 인물 이름 금지.
 * 사람 낱말은 프로필 규칙보다 넓게(아이·학생 등) 본다 — 그림체면 통과하므로 넓게 잡아도 막히는 것은 사진처럼 보이는 사람뿐이다.
 * 「approachable student vibe」 처럼 꾸미는 말은 사람이 아니다(프롬프트 111개에 돌려 보다 발견)
 */
const CARD_PERSON =
  /\b(?<!non-)(?:person|people|persons|man|men|woman|women|girls?|boys?|guys?|lady|ladies|humans?|child|children|kids?|students?|someone|selfie|headshot|portrait|faces?|face (?:clearly )?visible|visible face)\b(?!\s+(?:vibe|mood|feel|style|energy|look)\b)/i;
/** 그림체 표지 — 사람이 있으면 이 중 하나가 있어야 한다 */
const ILLUSTRATED = /\b(?:illustrat(?:ion|ions|ed)|flat|vector|cartoon|line[- ]art|line drawing|silhouettes?|icons?|pictograms?|doodle|sketch(?:ed|y)?|watercolou?r|gouache|clip[- ]?art|isometric|infographic|2d)\b/i;
/** 사진 표지 — 사람이 있으면 하나도 없어야 한다(그림체라고 써도 사진 말이 같이 있으면 사진처럼 나온다) */
const PHOTO = /\b(?:photos?|photograph(?:s|y|ic)?|photo-?realistic|hyper-?realistic|realistic|lifelike|cinematic|dslr|\d{2}mm|lens|bokeh|depth of field|shot on|film still|candid|3d render(?:ing)?|octane|unreal engine)\b/i;
/** 실존 인물 이름 모양: 대문자로 시작하는 낱말이 둘 이상 이어짐(「Steve Jobs」「Kim Haneul」) · 「style of 이름」. 지금까지의 프롬프트 111개에서 오탐 0 */
const NAME_LIKE = /\b[A-Z][a-z]+(?:[ -][A-Z][a-z]+)+\b/;
const STYLE_OF = /\bstyle of\s+[A-Z]/;

/**
 * 사람 규칙: forbid = 사람·신체·나이·외모 모두 금지(프로필 사진) · illustrated = 그림체 사람만(카드) ·
 * character = 사람 대신 계정 캐릭터(카드, 「보여 주는 방식」에 캐릭터가 있을 때) · any = 검사 안 함(하이라이트 — 보여 주는 방식을 따른다)
 */
export type PeopleRule = 'forbid' | 'illustrated' | 'character' | 'any';

/** 「보여 주는 방식」에 캐릭터가 있으면 카드 그림의 사람은 그 캐릭터로 (설문 S6 의 덧붙일 말·직접 수정에서) */
export const cardPeopleRule = (presence: string | null): PeopleRule => (presence && /캐릭터|마스코트/.test(presence) ? 'character' : 'illustrated');

/**
 * 그림 프롬프트 한 개의 코드 규칙 — 브랜딩(프로필·하이라이트)과 카드 그림(FR-MK-8)이 같이 쓴다.
 */
export function imagePromptIssues(where: string, p: { prompt: string; filename: string }, needs: Array<[RegExp, string]>, people: PeopleRule): Issue[] {
  const out: Issue[] = [];
  if (/[ㄱ-ㆎ가-힣]/.test(p.prompt)) out.push(issue(where, 'prompt_not_english', '그림 프롬프트에 한글이 있습니다. 영어로 쓰세요.'));
  if (!/\bno text\b/i.test(p.prompt)) out.push(issue(where, 'prompt_missing_no_text', '그림 프롬프트에 "no text" 가 없습니다(수용 기준: 글자 없음).'));
  for (const [re, label] of needs) if (!re.test(p.prompt)) out.push(issue(where, 'prompt_missing_size', `그림 프롬프트에 ${label} 이 없습니다(수용 기준: 크기·비율).`));
  if (!/^[a-z0-9-]+\.png$/.test(p.filename)) out.push(issue(where, 'bad_filename', `파일 이름 "${p.filename}" 은 영문 소문자·숫자·하이픈과 .png 로 쓰세요.`));
  if (people === 'any') return out;
  const affirmed = withoutNegations(p.prompt);
  if (people === 'forbid') {
    const person = REAL_PERSON.exec(affirmed) ?? BODY_PART.exec(affirmed);
    if (person) out.push(issue(where, 'prompt_realistic_person', `그림 프롬프트에 실사 인물·신체 표현 "${person[0]}" 이 있습니다. 사람 없는 그림(사물·캐릭터·상징)으로 쓰세요.`));
  } else {
    const person = CARD_PERSON.exec(affirmed) ?? BODY_PART.exec(affirmed);
    const photo = PHOTO.exec(affirmed);
    if (person && people === 'character')
      out.push(issue(where, 'prompt_person_not_character', `그림 프롬프트에 사람 표현 "${person[0]}" 이 있습니다. 이 계정은 사람 대신 캐릭터로 보여 줍니다 — 캐릭터 이름으로 쓰고 생김새는 지어내지 마세요.`));
    else if (person && (photo || !ILLUSTRATED.test(affirmed)))
      out.push(
        issue(
          where,
          'prompt_realistic_person',
          photo
            ? `그림 프롬프트에 사람 "${person[0]}" 과 사진 표현 "${photo[0]}" 이 같이 있습니다. 사람은 그림체(일러스트·실루엣·아이콘)로만, 사진 표현 없이 쓰세요.`
            : `그림 프롬프트에 사람 "${person[0]}" 이 있는데 그림체 표현이 없어 사진처럼 나올 수 있습니다. illustration·flat·silhouette 처럼 그림체를 밝히세요.`,
        ),
      );
    const name = NAME_LIKE.exec(p.prompt) ?? STYLE_OF.exec(p.prompt);
    if (name) out.push(issue(where, 'prompt_named_person', `그림 프롬프트에 실존 인물 이름으로 보이는 "${name[0]}" 이 있습니다. 실존 인물을 그리게 하지 마세요.`));
  }
  const looks = AGE_LOOKS.exec(affirmed);
  if (looks) out.push(issue(where, 'prompt_age_appearance', `그림 프롬프트에 나이·외모 묘사 "${looks[0]}" 가 있습니다. 원문에 없는 사람 묘사는 빼세요.`));
  return out;
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
