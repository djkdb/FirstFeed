// 개성 캐릭터 추천 3안(2026-11-08): AI(opus)가 프로필 · 팔레트에 맞는 캐릭터를 **선택지 표 안의 값으로만** 고른다.
// 자기 평가 없이 코드 규칙만 — 고른 값이 표 안인지 · 이름 규칙 · 세 안이 서로 다른지 · 설명에 근거 없는 숫자 · 영문이 없는지(브랜딩 시각과 같은 이유, 결정 2026-10-14)
import { z } from 'zod';
import { commonEnglishTerms } from '../config.ts';
import type { AiService, JobContext } from '../ai/adapter.ts';
import { generateChecked } from '../ai/loop.ts';
import { loadPrompt } from '../ai/prompts.ts';
import { FlowError } from '../identity/flow.ts';
import { formatProfileForPrompt, profileForGeneration, profileGroundingTexts } from '../identity/for-generation.ts';
import { findUngrounded } from '../rules/grounding.ts';
import type { Issue, Rule } from '../rules/types.ts';
import { CHARACTER_OPTIONS, characterIssues, type CharacterSpec } from './character.ts';
import { currentSelection } from './store.ts';

const C = CHARACTER_OPTIONS;
const ids = <T extends ReadonlyArray<{ id: string }>>(l: T) => l.map((x) => x.id) as [T[number]['id'], ...Array<T[number]['id']>];
const ROLES = ['primary', 'secondary', 'accent', 'background', 'text'] as const;
const SPECIES = [...new Set(Object.values(C.species).flatMap((l) => l.map((x) => x.id)))] as [string, ...string[]];

export const SuggestSchema = z.object({
  candidates: z
    .array(
      z.object({
        name: z.string().max(20),
        /** 한 줄 콘셉트(한국어) */
        concept: z.string().max(80),
        /** 왜 이 계정에 맞는지(한국어) — 프로필의 무엇을 따랐는지 */
        why: z.string().max(120),
        kind: z.enum(ids(C.kind) as ['human', 'animal', 'object', 'creature']),
        species: z.enum(SPECIES),
        style: z.enum(ids(C.style)),
        line: z.enum(ids(C.line)),
        shading: z.enum(ids(C.shading)),
        eyes: z.enum(ids(C.eyes)),
        hair: z.enum(ids(C.hair)),
        marking: z.enum(ids(C.marking)),
        outfit: z.enum(ids(C.outfit)),
        accessories: z.array(z.enum(ids(C.accessory))).max(3),
        personality: z.array(z.enum(ids(C.personality))).max(3),
        expression: z.enum(ids(C.expression)),
        pose: z.enum(ids(C.pose)),
        body_color: z.enum(ROLES),
        accent_color: z.enum(ROLES),
      }),
    )
    .max(4),
});
export type Suggestion = z.infer<typeof SuggestSchema>['candidates'][number];

export const specOf = (x: Suggestion): CharacterSpec => ({
  name: x.name,
  kind: x.kind,
  species: x.species,
  style: x.style,
  line: x.line,
  shading: x.shading,
  eyes: x.eyes,
  hair: x.kind === 'human' ? x.hair : 'none',
  marking: x.kind === 'human' ? 'none' : x.marking,
  outfit: x.outfit,
  accessories: x.accessories,
  personality: x.personality,
  expression: x.expression,
  pose: x.pose,
  background: 'plain',
  aspect: '1:1',
  bodyColor: x.body_color,
  accentColor: x.accent_color,
  extra: '',
});

const err = (code: string, message: string, where?: string): Issue => ({ level: 'error', code, message, where, from: 'rule' });

export function suggestRules(grounding: { brand: string[] }, commonTerms: readonly string[]): Rule<z.infer<typeof SuggestSchema>>[] {
  return [
    (d) => (d.candidates.length !== 3 ? [err('need_three', `후보가 ${d.candidates.length}개 — 정확히 3개`)] : []),
    (d) =>
      d.candidates.flatMap((x, i) => {
        const out: Issue[] = [];
        const where = `candidates.${i}`;
        if (!C.species[x.kind].some((s) => s.id === x.species)) out.push(err('species_kind', `${x.name}: 「${x.species}」는 ${x.kind} 의 선택지가 아니에요 — 그 종류의 목록에서`, where));
        for (const e of characterIssues(specOf(x))) if (e.level === 'error') out.push(err(e.code, `${x.name || `${i + 1}번`}: ${e.message}`, where));
        if (!x.name) out.push(err('no_name', `${i + 1}번: 영문 한 낱말 이름이 필요해요`, where));
        if (x.body_color === x.accent_color) out.push(err('same_colors', `${x.name}: 몸 색과 강조 색이 같은 칸 — 다른 칸으로`, where));
        // 설명 글의 숫자 · 영문 이름은 프로필 · 브랜딩 키트에 있는 것만(이름은 이 캐릭터의 이름이라 뺀다)
        for (const u of findUngrounded(`${x.concept} ${x.why}`.replaceAll(x.name, ''), { source: [], brand: grounding.brand }, commonTerms))
          out.push(err('ungrounded', `${x.name}: 설명의 「${u.value}」는 프로필 · 브랜딩에 없어요 — 빼거나 프로필에 있는 말로`, where));
        return out;
      }),
    (d) => {
      const key = (x: Suggestion) => `${x.kind}/${x.species}/${x.style}`;
      const seen = new Set<string>();
      for (const [i, x] of d.candidates.entries()) {
        if (seen.has(key(x))) return [err('same_candidate', `${i + 1}번이 앞 후보와 종류 · 무엇 · 그림체가 같아요 — 서로 다른 방향 셋으로`, `candidates.${i}`)];
        seen.add(key(x));
      }
      return [];
    },
  ];
}

/** 선택지 표를 프롬프트에 보일 글로 — 표가 하나라 프롬프트와 스키마가 어긋나지 않는다 */
export function optionTable(): string {
  const line = (name: string, l: ReadonlyArray<{ id: string; ko: string }>) => `- ${name}: ${l.map((x) => `${x.id}(${x.ko})`).join(' · ')}`;
  return [
    line('kind', C.kind),
    ...Object.entries(C.species).map(([k, l]) => line(`species — kind ${k} 일 때`, l)),
    line('style', C.style),
    line('line', C.line),
    line('shading', C.shading),
    line('eyes', C.eyes),
    line('hair — 사람형만', C.hair),
    line('marking — 사람형 아닐 때', C.marking),
    line('outfit', C.outfit),
    line('accessories — 2개까지', C.accessory),
    line('personality — 2개까지', C.personality),
    line('expression', C.expression),
    line('pose', C.pose),
  ].join('\n');
}

export async function suggestCharacters(ai: AiService, brandId: number, job?: JobContext): Promise<{ candidates: Array<Suggestion & { spec: CharacterSpec }>; calls: number; rewrites: number }> {
  const db = ai.db;
  const sel = currentSelection(db, brandId);
  if (!sel.palette) throw new FlowError('브랜딩 키트에서 팔레트를 아직 고르지 않았어요.', '「브랜드」에서 팔레트를 먼저 고르면 그 색으로 캐릭터를 추천해요.');
  const profile = profileForGeneration(db, brandId);
  const grounding = { brand: [...profileGroundingTexts(profile), ...[sel.handle, sel.displayName, sel.bio].filter((x): x is string => !!x)] };
  const prompt = loadPrompt(db, 'character_suggest', {
    profile: formatProfileForPrompt(profile),
    kit: [`아이디: ${sel.handle ?? '(정하지 않음)'}`, `이름: ${sel.displayName ?? '(정하지 않음)'}`, `바이오: ${sel.bio ?? '(정하지 않음)'}`].join('\n'),
    palette: ROLES.map((r) => `${r}: ${sel.palette!.colors[r]}`).join(' · '),
    options: optionTable(),
  });
  const r = await generateChecked(ai, { task: 'character_suggest', prompt: prompt.text, promptRef: prompt.ref, schema: SuggestSchema, rules: suggestRules(grounding, commonEnglishTerms(db)), selfReview: false, signal: job?.signal }, job);
  if (!r.ok) throw new FlowError(`캐릭터를 추천하지 못했어요(재작성 ${r.rewrites}번 뒤에도 규칙 위반: ${r.errors[0]?.message ?? '알 수 없음'}).`, '다시 시도하거나, 단계마다 직접 고르세요.');
  return { candidates: r.data.candidates.map((x) => ({ ...x, spec: specOf(x) })), calls: r.calls, rewrites: r.rewrites };
}
