// 틀 하나 그리기 + 넘치면 글자 크기를 단계적으로 줄이기 (FR-TP-4).
// 마지막 단계에서도 넘치면 PNG 없이 문제와 "얼마나 줄일지"를 돌려준다 — 생성 루프가 코드 규칙 위반(text_overflow)으로 원고를 다시 쓰게
import { getSetting } from '../config.ts';
import type { Db } from '../db/index.ts';
import { renderCard, type RenderProblem, type RenderResult } from '../render/render.ts';
import { FRAME_SIZE, type BrandLook, type Draft, type FrameContent, type PhotoOpts } from './types.ts';

export interface FrameResult extends RenderResult {
  /** 통과한(또는 마지막으로 시도한) 글자 크기 비율 */
  scale: number;
  /** 시도한 비율과 그때의 문제 수 — 기록용 */
  tries: Array<{ scale: number; problems: number }>;
  /** 원고를 줄이라는 안내 (통과하면 빈 배열) */
  shorten: Array<{ slot: string; message: string }>;
}

const LAYOUT: ReadonlyArray<RenderProblem['code']> = ['text_overflow', 'too_many_lines', 'text_outside_card', 'text_outside_safe', 'text_overlap'];

/** 원고에서 그 칸의 글 (안내 문구에 글자 수를 넣으려고) */
function slotText(c: FrameContent, slot: string): string | null {
  const v = (c as unknown as Record<string, unknown>)[slot === 'text' ? 'text' : slot];
  return typeof v === 'string' ? v.replace(/\*\*/g, '') : null;
}

function shortenHints(r: RenderResult, c: FrameContent, minScale: number): Array<{ slot: string; message: string }> {
  const out: Array<{ slot: string; message: string }> = [];
  for (const s of r.measure.slots) {
    const bad = r.problems.filter((p) => p.slot === s.slot && LAYOUT.includes(p.code));
    if (bad.length === 0) continue;
    const text = slotText(c, s.slot);
    const len = text ? [...text.replace(/\s/g, '')].length : null;
    // 줄 수가 넘치면 그 비율만큼, 가로로 넘치면(끊을 자리 없는 낱말) 낱말을 나누라고
    const ratio = s.maxLines && s.lines > s.maxLines ? s.maxLines / s.lines : null;
    const cut = len && ratio ? Math.max(1, Math.ceil(len * (1 - ratio))) : null;
    const wide = bad.some((p) => p.code === 'text_outside_card' || p.code === 'text_outside_safe') && s.lines <= (s.maxLines ?? Infinity);
    out.push({
      slot: s.slot,
      message: wide
        ? `"${s.slot}" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요.`
        : `"${s.slot}" 이 글자 크기를 ${Math.round(minScale * 100)}% 까지 줄여도 넘칩니다${s.maxLines ? ` (${s.lines}줄 / 최대 ${s.maxLines}줄)` : ''}.${cut ? ` 약 ${cut}자 줄이세요(지금 ${len}자).` : ' 글을 줄이세요.'}`,
    });
  }
  return out;
}

export async function renderFrame(
  db: Db | null,
  draft: Draft,
  look: BrandLook,
  content: FrameContent,
  /** 측정·테스트 세트용: 마지막 단계에서 넘쳐도 PNG 를 만든다 (앱에서는 쓰지 않는다 — 반쯤 만든 결과) */
  opts: { captureEvenIfBad?: boolean; photo?: PhotoOpts } = {},
): Promise<FrameResult> {
  const { width, height, safe } = FRAME_SIZE[content.kind];
  const safeRect = safe ? getSetting(db, 'render.safeArea')[safe] : null;
  const steps = getSetting(db, 'render.scaleSteps');
  const tries: FrameResult['tries'] = [];
  let last: RenderResult | null = null;
  for (const [i, scale] of steps.entries()) {
    const lastStep = i === steps.length - 1;
    const r = await renderCard(db, {
      html: draft.html(look, content, scale, opts.photo),
      width,
      height,
      safe: safeRect,
      captureEvenIfBad: lastStep && opts.captureEvenIfBad === true,
      measureContrast: !!opts.photo?.background,
    });
    tries.push({ scale, problems: r.problems.length });
    last = r;
    if (r.ok) return { ...r, scale, tries, shorten: [] };
    // 대체 글꼴은 크기를 줄여도 안 고쳐진다 — 더 시도하지 않는다
    if (r.problems.some((p) => p.code === 'font_fallback')) return { ...r, scale, tries, shorten: [] };
  }
  const scale = steps[steps.length - 1]!;
  return { ...last!, scale, tries, shorten: shortenHints(last!, content, scale) };
}

export interface PhotoFrameResult extends FrameResult {
  /** 쓴 띠 진하기 (그림이 없으면 null) */
  shade: number | null;
  /** 진하기 단계마다 가장 나쁜 칸의 명암비 — 기록용 */
  shadeTries: Array<{ shade: number; worst: number }>;
}

/**
 * 그림 바탕 표지 그리기 (결정 2026-10-18): 글자 뒤 어두운 띠를 옅은 단계부터 그려 보고, 그린 PNG 에서 잰 글자 뒤 명암비가
 * 기준(render.photoMinContrast)을 넘는 첫 단계를 쓴다. 가장 진하게 해도 모자라면 PNG 없이 실패(low_contrast_on_photo).
 * 그림이 없으면 단색 바탕으로 한 번만 그린다. 넘침은 띠 진하기로 안 고쳐지므로 바로 돌려준다
 */
export async function renderPhotoFrame(
  db: Db | null,
  draft: Draft,
  look: BrandLook,
  content: FrameContent,
  background: string | null,
  opts: { captureEvenIfBad?: boolean } = {},
): Promise<PhotoFrameResult> {
  if (!background || (content.kind !== 'cover' && content.kind !== 'reel_cover')) return { ...(await renderFrame(db, draft, look, content, opts)), shade: null, shadeTries: [] };
  const min = getSetting(db, 'render.photoMinContrast');
  const steps = getSetting(db, 'render.photoShadeSteps');
  const shadeTries: PhotoFrameResult['shadeTries'] = [];
  let last: FrameResult | null = null;
  for (const shade of steps) {
    // 측정용(captureEvenIfBad)은 단계마다 넘김 — 넘침은 첫 단계에서 바로 돌려주므로, 마지막 단계에만 넘기면 넘친 PNG 가 안 남는다(측정에서 빈 칸으로 발견)
    const r = await renderFrame(db, draft, look, content, { photo: { background, shade }, captureEvenIfBad: opts.captureEvenIfBad === true });
    const worst = Math.min(21, ...(r.contrast ?? []).map((x) => x.ratio));
    shadeTries.push({ shade, worst });
    last = r;
    if (!r.ok) return { ...r, shade, shadeTries };
    if (worst >= min) return { ...r, shade, shadeTries };
  }
  const shade = steps[steps.length - 1]!;
  const bad = (last!.contrast ?? []).filter((x) => x.ratio < min);
  return {
    ...last!,
    ok: false,
    png: opts.captureEvenIfBad ? last!.png : null,
    problems: [
      ...last!.problems,
      ...bad.map((x) => ({
        code: 'low_contrast_on_photo' as const,
        slot: x.slot,
        message: `그림 위 "${x.slot}" 글자의 명암비가 ${x.ratio}:1 로 ${min}:1 보다 낮습니다(글자 뒤 띠를 가장 진하게 해도). 글자 자리가 덜 밝은 그림으로 바꾸거나 다른 그림을 올리세요.`,
      })),
    ],
    shade,
    shadeTries,
  };
}
