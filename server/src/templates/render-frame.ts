// 틀 하나 그리기 + 넘치면 글자 크기를 단계적으로 줄이기 (FR-TP-4).
// 마지막 단계에서도 넘치면 PNG 없이 문제와 "얼마나 줄일지"를 돌려준다 — 생성 루프가 코드 규칙 위반(text_overflow)으로 원고를 다시 쓰게
import { getSetting } from '../config.ts';
import type { Db } from '../db/index.ts';
import { renderCard, type RenderProblem, type RenderResult } from '../render/render.ts';
import { FRAME_SIZE, type BrandLook, type Draft, type FrameContent } from './types.ts';

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
  opts: { captureEvenIfBad?: boolean } = {},
): Promise<FrameResult> {
  const { width, height, safe } = FRAME_SIZE[content.kind];
  const safeRect = safe ? getSetting(db, 'render.safeArea')[safe] : null;
  const steps = getSetting(db, 'render.scaleSteps');
  const tries: FrameResult['tries'] = [];
  let last: RenderResult | null = null;
  for (const [i, scale] of steps.entries()) {
    const lastStep = i === steps.length - 1;
    const r = await renderCard(db, { html: draft.html(look, content, scale), width, height, safe: safeRect, captureEvenIfBad: lastStep && opts.captureEvenIfBad === true });
    tries.push({ scale, problems: r.problems.length });
    last = r;
    if (r.ok) return { ...r, scale, tries, shorten: [] };
    // 대체 글꼴은 크기를 줄여도 안 고쳐진다 — 더 시도하지 않는다
    if (r.problems.some((p) => p.code === 'font_fallback')) return { ...r, scale, tries, shorten: [] };
  }
  const scale = steps[steps.length - 1]!;
  return { ...last!, scale, tries, shorten: shortenHints(last!, content, scale) };
}
