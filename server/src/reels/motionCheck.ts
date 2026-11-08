// 릴스 모션 규칙(결정 2026-11-08) — AI 제안에도, 사람이 속성 칸에서 직접 고른 모션에도 같은 검사를 쓴다.
// 서버 설정 · AI 에 기대지 않는 순수 함수라 편집 화면이 그대로 불러 바로 보여 준다(기준값은 서버 설정 reels.motion 에서 받아 넘긴다)
import type { Issue } from '../rules/types.ts';
import { contrast } from './color.ts';
import { estimateTextBox, inside, type Accent, type Box, type Camera, type Emphasis, type Enter, type Exit, type LoopMotion, type Palette, type PaletteRole, type ReelDoc, type TextClip, type Transition } from './model.ts';
import { holdFrames, motionExtent } from './motion.ts';
import { glyphBehind, inkOnAccent, toneBehind } from './textColor.ts';
import { bgTone } from './themed.ts';

export interface MotionLimits {
  minHoldFrames: number;
  subtitleMaxEnter: number;
  subtitleMaxExit: number;
  maxEnterFrames: number;
  maxExitFrames: number;
  maxTransitionFrames: number;
  maxEmphasis: number;
}

/** AI 가 내는 제안 모양(스키마는 motionPlan.ts — 둘이 어긋나면 그쪽에서 타입 오류) */
export interface MotionPlan {
  texts: Array<{ id: string; enter: Enter; enter_frames: number; exit: Exit; exit_frames: number; emphasis: Array<{ word: string; style: Emphasis }>; accent: Accent; accent_color: PaletteRole; loop: LoopMotion }>;
  scenes: Array<{ id: string; transition: Transition; transition_frames: number; camera: Camera }>;
  progress: PaletteRole | 'none';
  note: string;
}

/** 제안을 편집 내용에 입힌다 — 화면이 「적용」할 때도 같은 함수. 지금 편집 내용에 없는 id 는 건너뛴다(제안 뒤에 지운 글자) */
export function applyMotion(doc: ReelDoc, plan: MotionPlan): ReelDoc {
  const tm = new Map(plan.texts.map((t) => [t.id, t]));
  const sm = new Map(plan.scenes.map((s) => [s.id, s]));
  return {
    ...doc,
    texts: doc.texts.map((t) => {
      const m = tm.get(t.id);
      return m
        ? { ...t, motion: { enter: m.enter, enterFrames: m.enter_frames, exit: m.exit, exitFrames: m.exit_frames, emphasis: m.emphasis.map((e) => ({ ...e })), accent: m.accent, accentColor: m.accent_color, loop: m.loop } }
        : t;
    }),
    scenes: doc.scenes.map((s) => {
      const m = sm.get(s.id);
      return m ? { ...s, transition: m.transition, transitionFrames: m.transition_frames, camera: m.camera } : s;
    }),
    progress: plan.progress === 'none' ? null : plan.progress,
  };
}

export const ruleError = (code: string, message: string, where?: string): Issue => ({ level: 'error', code, message, where, from: 'rule' });
const err = ruleError;
const warn = (code: string, message: string, where?: string): Issue => ({ level: 'warn', code, message, where, from: 'rule' });
const label = (t: TextClip) => `「${[...t.text.replace(/\s+/g, ' ')].slice(0, 14).join('')}」`;

/** 편집 내용(이미 모션을 입힌 것)을 잰다 — 화면에서 사람이 직접 고른 모션에도 같은 검사를 보여 줄 수 있게 doc 만 받는다 */
export function checkMotion(doc: ReelDoc, palette: Palette, guide: Box, L: MotionLimits): Issue[] {
  const out: Issue[] = [];
  doc.texts.forEach((t, i) => {
    const m = t.motion;
    if (!m) return;
    const where = `texts.${i}`;
    const name = label(t);
    const maxIn = t.subtitle ? L.subtitleMaxEnter : L.maxEnterFrames;
    const maxOut = t.subtitle ? L.subtitleMaxExit : L.maxExitFrames;
    if (m.enter !== 'none' && m.enterFrames < 3) out.push(err('enter_too_short', `${name} 등장이 ${m.enterFrames}프레임이라 움직임이 아니라 튐으로 보여요 — 3프레임 이상이나 none`, where));
    if (m.enter !== 'none' && m.enterFrames > maxIn)
      out.push(err('enter_too_long', `${name} 등장 ${m.enterFrames}프레임 — ${t.subtitle ? '자막은 말과 같이 가야 해서 ' : ''}${maxIn}프레임 이하로`, where));
    if (m.exit !== 'none' && m.exitFrames > maxOut) out.push(err('exit_too_long', `${name} 퇴장 ${m.exitFrames}프레임 — ${maxOut}프레임 이하로`, where));
    const hold = holdFrames(t);
    if (hold < L.minHoldFrames)
      out.push(err('hold_too_short', `${name} 다 보이는 시간이 ${hold}프레임(클립 ${t.duration}프레임) — 읽을 틈이 ${L.minHoldFrames}프레임 이상 남게 등장 · 퇴장을 줄이거나 none`, where));
    // 가이드: 가만히 있을 때 이미 밖이면 모션 탓이 아니다(편집 화면이 따로 경고) — 모션 때문에 나가는 것만 잡는다
    const box = estimateTextBox(t);
    if (inside(box, guide)) {
      const ext = motionExtent(box, t);
      if (!inside(ext, guide)) {
        const side = ext.y < guide.y ? '위' : ext.y + ext.h > guide.y + guide.h ? '아래' : ext.x < guide.x ? '왼쪽' : '오른쪽';
        out.push(err('motion_outside_guide', `${name} ${m.enter}/${m.exit}${m.loop !== 'none' ? `/${m.loop}` : ''} 로 움직이는 동안 격자 가이드 ${side}로 나가요 — 그쪽으로 움직이지 않는 프리셋을 고르세요`, where));
      }
    }
    if (m.emphasis.length > L.maxEmphasis) out.push(err('too_many_emphasis', `${name} 강조 ${m.emphasis.length}개 — ${L.maxEmphasis}개 이하(다 강조하면 아무것도 강조되지 않아요)`, where));
    const accent = palette[m.accentColor];
    const behind = glyphBehind(doc, t, palette);
    const scene = toneBehind(doc, t, palette);
    m.emphasis.forEach((e, k) => {
      const w = `${where}.emphasis.${k}`;
      if (!e.word.trim() || !t.text.includes(e.word)) {
        out.push(err('emphasis_not_in_text', `${name} 강조 낱말 「${e.word}」가 글자 안에 없어요 — 글자에 그대로 있는 낱말만`, w));
        return;
      }
      if (e.style === 'highlight') {
        const ink = inkOnAccent(t, accent);
        if (contrast(ink, accent) < 4.5) out.push(err('emphasis_contrast', `${name} 「${e.word}」 칠(${m.accentColor}) 위 글자 명암비 ${contrast(ink, accent).toFixed(1)}:1 — 4.5:1 이상인 팔레트 칸으로`, w));
      } else if (e.style === 'color') {
        if (!behind) out.push(err('emphasis_unknown_bg', `${name} 「${e.word}」 — 영상 · 사진 위라 색만 바꾼 글자가 읽히는지 잴 수 없어요. highlight 로`, w));
        else if (contrast(accent, behind) < 4.5) out.push(err('emphasis_contrast', `${name} 「${e.word}」 ${m.accentColor} 글자가 뒤 색에 ${contrast(accent, behind).toFixed(1)}:1 — 4.5:1 이상인 칸이나 highlight 로`, w));
      } else if (behind && contrast(accent, behind) < 3) {
        out.push(err('emphasis_contrast', `${name} 「${e.word}」 밑줄(${m.accentColor})이 뒤 색에 ${contrast(accent, behind).toFixed(1)}:1 — 3:1 이상인 칸으로`, w));
      }
    });
    if (m.accent === 'sweep') {
      if (t.style.preset === 'softbox' || t.style.preset === 'blackbox') out.push(err('sweep_on_box', `${name} 박스가 있는 글자라 뒤 띠(sweep)가 박스에 가려 안 보여요 — bar · ring · none`, where));
      else {
        const ink = inkOnAccent(t, accent);
        if (contrast(ink, accent) < 4.5) out.push(err('accent_contrast', `${name} 띠(${m.accentColor}) 위 글자 명암비 ${contrast(ink, accent).toFixed(1)}:1 — 4.5:1 이상인 칸으로`, where));
      }
    } else if (m.accent === 'bar' || m.accent === 'ring') {
      if (!scene) out.push(warn('accent_unknown_bg', `${name} 영상 · 사진 위 장식이라 보이는지 코드가 못 재요 — 뽑은 영상에서 확인하세요`, where));
      else if (contrast(accent, scene) < 3) out.push(err('accent_contrast', `${name} 장식(${m.accentColor})이 배경에 ${contrast(accent, scene).toFixed(1)}:1 — 3:1 이상인 칸으로`, where));
    }
  });
  const sorted = [...doc.scenes].sort((a, b) => a.start - b.start);
  doc.scenes.forEach((s, i) => {
    if (!s.transition || s.transition === 'cut') return;
    const n = s.transitionFrames ?? 0;
    const prev = sorted.find((x) => x.start + x.duration === s.start);
    const limit = Math.min(L.maxTransitionFrames, Math.floor(s.duration / 2), prev ? Math.floor(prev.duration / 2) : Infinity);
    if (n < 3) out.push(err('transition_too_short', `장면 「${s.name}」 전환 ${n}프레임 — 3프레임 이상이나 cut`, `scenes.${i}`));
    else if (n > limit) out.push(err('transition_too_long', `장면 「${s.name}」 전환 ${n}프레임 — ${limit}프레임 이하(장면 길이의 절반 · ${L.maxTransitionFrames}프레임 중 작은 쪽)`, `scenes.${i}`));
  });
  if (doc.progress) {
    const tone = bgTone(doc.bg, palette);
    const c = palette[doc.progress];
    if (tone && contrast(c, tone) < 3) out.push(err('progress_contrast', `진행 막대(${doc.progress})가 기본 배경에 ${contrast(c, tone).toFixed(1)}:1 — 3:1 이상인 칸이나 none`, 'progress'));
  }
  // 취향(경고만): 자막끼리 등장이 다르면 산만하다
  const subs = doc.texts.filter((t) => t.subtitle && t.motion);
  if (new Set(subs.map((t) => t.motion!.enter)).size > 1) out.push(warn('subtitle_mixed', '자막마다 등장 방식이 달라요 — 자막은 하나로 맞추면 덜 산만해요', 'texts'));
  return out;
}

