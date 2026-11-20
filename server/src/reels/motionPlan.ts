// 릴스 모션 제안(결정 2026-11-08): AI(opus)가 글자 · 장면마다 프리셋을 고르고, 코드 규칙이 프레임마다 재서 걸러 낸다.
// AI 는 코드를 쓰지 않고 이름과 프레임 수만 고른다 — 앱 안에서 AI 가 쓴 코드가 돌지 않고, 결과를 규칙으로 잴 수 있게.
// 글자 내용은 바꾸지 않는다(모션만) → 근거 규칙을 다시 걸 일이 없고, 자기 평가도 하지 않는다(취향은 재작성 사유가 아니라서 — 브랜딩 시각과 같은 이유, 결정 2026-10-14)
import { z } from 'zod';
import { getSetting } from '../config.ts';
import type { AiService, JobContext } from '../ai/adapter.ts';
import { generateChecked } from '../ai/loop.ts';
import { loadPrompt } from '../ai/prompts.ts';
import { FlowError } from '../identity/flow.ts';
import type { Issue, Rule } from '../rules/types.ts';
import { estimateTextBox, FPS, type Accent, type Box, type Camera, type Emphasis, type Enter, type Exit, type LoopMotion, type Palette, type PaletteRole, type ReelBrand, type ReelDoc, type Transition } from './model.ts';
import { CAMERAS, ENTERS, EXITS, TRANSITIONS } from './motion.ts';
import { applyMotion, checkMotion, ruleError, type MotionLimits, type MotionPlan } from './motionCheck.ts';
export { applyMotion, type MotionPlan };
import { getReel, reelBrand } from './store.ts';
import { glyphBehind } from './textColor.ts';
import { bgTone } from './themed.ts';

const ROLES = ['primary', 'secondary', 'accent', 'background', 'text'] as const satisfies readonly PaletteRole[];
const EMPHASES = ['highlight', 'underline', 'color'] as const satisfies readonly Emphasis[];
const ACCENTS = ['none', 'bar', 'ring', 'sweep'] as const satisfies readonly Accent[];
const LOOPS = ['none', 'float', 'pulse'] as const satisfies readonly LoopMotion[];

// 스키마는 넉넉하게(범위 밖 값도 받는다) — 범위는 규칙이 「왜 · 어떻게 고칠지」를 붙여 알려 준다. 스키마에서 막으면 이유 없이 다시 요청만 한다
export const MotionPlanSchema = z.object({
  texts: z
    .array(
      z.object({
        id: z.string(),
        enter: z.enum(ENTERS as [Enter, ...Enter[]]),
        enter_frames: z.number().int().min(0).max(120),
        exit: z.enum(EXITS as [Exit, ...Exit[]]),
        exit_frames: z.number().int().min(0).max(120),
        emphasis: z.array(z.object({ word: z.string().max(40), style: z.enum(EMPHASES) })).max(6),
        accent: z.enum(ACCENTS),
        accent_color: z.enum(ROLES),
        loop: z.enum(LOOPS),
      }),
    )
    .max(400),
  scenes: z
    .array(
      z.object({
        id: z.string(),
        transition: z.enum(TRANSITIONS as [Transition, ...Transition[]]),
        transition_frames: z.number().int().min(0).max(120),
        camera: z.enum(CAMERAS as [Camera, ...Camera[]]),
      }),
    )
    .max(200),
  progress: z.enum([...ROLES, 'none']),
  /** 어떤 리듬으로 골랐는지 한 줄 — 화면에 보인다(영상에는 들어가지 않는다) */
  note: z.string().max(300),
});
// 화면도 「적용」에 같은 함수를 써야 해서 모양 · applyMotion 은 서버 설정 없는 motionCheck.ts 에 둔다. 스키마와 어긋나면 여기서 타입 오류
type _Same = z.infer<typeof MotionPlanSchema> extends MotionPlan ? (MotionPlan extends z.infer<typeof MotionPlanSchema> ? true : never) : never;
const _same: _Same = true;
void _same;

export interface MotionContext {
  doc: ReelDoc;
  palette: Palette;
  guide: Box;
  limits: MotionLimits;
}

export function motionRules(c: MotionContext): Rule<MotionPlan>[] {
  return [
    (d) => {
      const out: Issue[] = [];
      const textIds = new Set(c.doc.texts.map((t) => t.id));
      const sceneIds = new Set(c.doc.scenes.map((s) => s.id));
      const seen = new Set<string>();
      d.texts.forEach((t, i) => {
        if (!textIds.has(t.id)) out.push(ruleError('unknown_id', `없는 글자 id ${t.id} — 아래 목록의 id 만`, `texts.${i}`));
        if (seen.has(t.id)) out.push(ruleError('duplicate_id', `글자 ${t.id} 가 두 번 — 한 번씩`, `texts.${i}`));
        seen.add(t.id);
      });
      d.scenes.forEach((s, i) => {
        if (!sceneIds.has(s.id)) out.push(ruleError('unknown_id', `없는 장면 id ${s.id} — 아래 목록의 id 만`, `scenes.${i}`));
        if (seen.has(s.id)) out.push(ruleError('duplicate_id', `장면 ${s.id} 가 두 번 — 한 번씩`, `scenes.${i}`));
        seen.add(s.id);
      });
      const missing = [...c.doc.texts.map((t) => t.id), ...c.doc.scenes.map((s) => s.id)].filter((x) => !seen.has(x));
      if (missing.length) out.push({ level: 'error', from: 'rule', code: 'missing_id', message: `빠진 글자 · 장면 ${missing.length}개(${missing.slice(0, 5).join(', ')}) — 모두 하나씩(움직이지 않을 것은 none · cut)` });
      return out;
    },
    (d) => checkMotion(applyMotion(c.doc, d), c.palette, c.guide, c.limits),
  ];
}

const sec = (f: number) => `${(f / FPS).toFixed(2)}초`;

/** 프롬프트에 보일 글자 · 장면 목록 — 위치는 가이드까지 남은 여유(px)로 보여 rise · drop 이 나갈지 AI 가 알 수 있게 */
export function describeForPrompt(c: MotionContext): { texts: string; scenes: string } {
  const g = c.guide;
  const texts = [...c.doc.texts]
    .sort((a, b) => a.start - b.start)
    .map((t) => {
      const b = estimateTextBox(t);
      const behind = glyphBehind(c.doc, t, c.palette);
      return [
        `- id=${t.id} · ${t.subtitle ? '자막' : t.style.preset === 'title' ? '큰 제목' : '글자'} · ${sec(t.start)}부터 ${t.duration}프레임 · 스타일 ${t.style.preset}`,
        `  글: ${t.text.replace(/\n/g, ' / ')}`,
        `  가이드까지 여유: 위 ${Math.round(b.y - g.y)}px · 아래 ${Math.round(g.y + g.h - b.y - b.h)}px · 왼쪽 ${Math.round(b.x - g.x)}px · 오른쪽 ${Math.round(g.x + g.w - b.x - b.w)}px · 글자 뒤 ${behind ?? '영상/사진(색 모름)'}`,
      ].join('\n');
    })
    .join('\n');
  const scenes = [...c.doc.scenes]
    .sort((a, b) => a.start - b.start)
    .map((s) => `- id=${s.id} · 「${s.name}」 ${sec(s.start)}부터 ${s.duration}프레임 · ${s.media ? (s.media.kind === 'video' ? '영상' : '사진') : '배경만'}`)
    .join('\n');
  return { texts: texts || '(없음)', scenes: scenes || '(없음)' };
}

export interface MotionProposal {
  plan: MotionPlan;
  /** 제안을 만든 편집 내용의 저장 시각 — 화면이 「제안 뒤에 고쳤는지」 알리려고 */
  baseUpdatedAt: string;
  warnings: Issue[];
  calls: number;
  rewrites: number;
}

export async function proposeMotion(ai: AiService, brandId: number, reelId: number, job?: JobContext): Promise<MotionProposal> {
  const db = ai.db;
  const reel = getReel(db, brandId, reelId);
  if (!reel) throw new FlowError('릴스를 찾지 못했어요.', '목록에서 릴스를 다시 고르세요.');
  if (!reel.doc.texts.length && !reel.doc.scenes.length) throw new FlowError('움직일 글자 · 장면이 없어요.', '글자나 장면을 먼저 넣으세요.');
  const brand: ReelBrand = reelBrand(db, brandId);
  const c: MotionContext = { doc: reel.doc, palette: brand.palette, guide: getSetting(db, 'render.safeArea').reel, limits: getSetting(db, 'reels.motion') };
  const d = describeForPrompt(c);
  const L = c.limits;
  const prompt = loadPrompt(db, 'reel_motion', {
    fps: String(FPS),
    palette: ROLES.map((r) => `${r}: ${brand.palette[r]}`).join(' · '),
    base_bg: bgTone(reel.doc.bg, brand.palette) ?? '사진(색 모름)',
    limits: [
      `등장 ${L.maxEnterFrames}프레임 이하(자막 ${L.subtitleMaxEnter}) · 퇴장 ${L.maxExitFrames}프레임 이하(자막 ${L.subtitleMaxExit}) · 움직이면 3프레임 이상`,
      `다 보이는 시간 ${L.minHoldFrames}프레임 이상 남기기 · 강조 낱말 ${L.maxEmphasis}개 이하 · 장면 전환 ${L.maxTransitionFrames}프레임 이하이면서 앞뒤 장면 길이의 절반 이하`,
    ].join('\n'),
    texts: d.texts,
    scenes: d.scenes,
  });
  const r = await generateChecked(ai, { task: 'reel_motion', prompt: prompt.text, promptRef: prompt.ref, schema: MotionPlanSchema, rules: motionRules(c), selfReview: false, signal: job?.signal }, job);
  if (!r.ok) {
    throw new FlowError(`모션을 제안하지 못했어요(재작성 ${r.rewrites}번 뒤에도 규칙 위반: ${r.errors[0]?.message ?? '알 수 없음'}).`, '다시 시도하거나, 오른쪽 속성의 「움직임」에서 직접 고르세요.');
  }
  return { plan: r.data, baseUpdatedAt: reel.updatedAt, warnings: r.warnings, calls: r.calls, rewrites: r.rewrites };
}
