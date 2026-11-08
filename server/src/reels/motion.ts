// 릴스 모션그래픽의 계산 — 편집 화면 · 완성 미리보기 · 영상 뽑기 · 규칙 검사가 모두 이 함수들을 쓴다(결정 2026-11-08).
// AI 는 프리셋 이름과 프레임 수만 고르고, 움직임은 여기서 프레임 번호만으로 정해진다 — 같은 입력이면 늘 같은 화면,
// 그래서 「가이드 밖으로 나가는지」를 그리지 않고도 프레임마다 잴 수 있다
import type { Box, Camera, Enter, Exit, Scene, TextClip, TextMotion, Transition } from './model.ts';

/** 프리셋이 움직이는 거리 · 크기 — 규칙 검사도 같은 값을 쓴다 */
export const MOTION = {
  /** rise · drop · sink 가 오르내리는 거리(px) */
  dist: 60,
  /** slide 가 옆에서 들어오는 거리(px) — 화면 밖에서 날아오지 않게 짧게 */
  slide: 120,
  /** pop 이 시작하는 크기 */
  popFrom: 0.6,
  /** blur 가 시작하는 흐림(px) */
  blur: 16,
  /** float · pulse 한 바퀴(프레임) — 2초. 깜빡임 기준(초당 3번)보다 훨씬 느리다 */
  loopPeriod: 60,
  floatAmp: 8,
  pulseAmp: 0.04,
  /** 강조가 등장 뒤 몇 프레임 쉬었다가 몇 프레임 동안 칠해지는지 */
  emphDelay: 2,
  emphFrames: 8,
  accentFrames: 12,
  /** 장면이 들어올 때 zoom 이 시작하는 크기 · 장면 안 카메라가 움직이는 크기 */
  zoomFrom: 1.15,
  camera: 0.08,
} as const;

export const ENTERS: Enter[] = ['none', 'fade', 'rise', 'drop', 'pop', 'slide-left', 'slide-right', 'wipe', 'typewriter', 'blur'];
export const EXITS: Exit[] = ['none', 'fade', 'sink', 'shrink', 'slide-left', 'slide-right'];
export const TRANSITIONS: Transition[] = ['cut', 'fade', 'slide-up', 'zoom', 'wipe'];
export const CAMERAS: Camera[] = ['none', 'zoom-in', 'zoom-out', 'pan-up', 'pan-down'];

export const ENTER_LABEL: Record<Enter, string> = {
  none: '없음',
  fade: '서서히',
  rise: '아래에서 올라오기',
  drop: '위에서 내려오기',
  pop: '톡 튀어나오기',
  'slide-left': '오른쪽에서 밀려오기',
  'slide-right': '왼쪽에서 밀려오기',
  wipe: '왼쪽부터 드러나기',
  typewriter: '한 글자씩',
  blur: '흐림에서 또렷하게',
};
export const EXIT_LABEL: Record<Exit, string> = { none: '없음', fade: '서서히', sink: '가라앉기', shrink: '작아지기', 'slide-left': '왼쪽으로', 'slide-right': '오른쪽으로' };
export const TRANSITION_LABEL: Record<Transition, string> = { cut: '컷', fade: '겹쳐 바뀌기', 'slide-up': '아래에서 밀어 올리기', zoom: '확대하며', wipe: '닦아 내기' };
export const CAMERA_LABEL: Record<Camera, string> = { none: '멈춤', 'zoom-in': '천천히 확대', 'zoom-out': '천천히 축소', 'pan-up': '위로 흐르기', 'pan-down': '아래로 흐르기' };

export const noMotion = (): TextMotion => ({ enter: 'none', enterFrames: 0, exit: 'none', exitFrames: 0, emphasis: [], accent: 'none', accentColor: 'accent', loop: 'none' });

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const easeOut = (p: number) => 1 - (1 - p) ** 3;
export const easeIn = (p: number) => p ** 3;
/** 끝에서 살짝 넘쳤다 돌아오는 곡선 — pop 의 「톡」 */
export function easeOutBack(p: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2;
}

export interface MotionFrame {
  opacity: number;
  tx: number;
  ty: number;
  scale: number;
  blur: number;
  /** wipe: 왼쪽부터 보이는 비율 */
  reveal: number;
  /** typewriter: 보이는 글자 비율(없으면 다 보임) */
  chars: number;
  /** 강조가 칠해진 정도 */
  emph: number;
  /** 장식(막대 · 고리 · 띠)이 자란 정도 */
  accent: number;
}

const still: MotionFrame = { opacity: 1, tx: 0, ty: 0, scale: 1, blur: 0, reveal: 1, chars: 1, emph: 1, accent: 1 };

/** 글자 클립 안에서 f 번째 프레임(0부터)의 모습 */
export function motionAt(f: number, duration: number, m: TextMotion | undefined): MotionFrame {
  if (!m) return still;
  const out: MotionFrame = { ...still };
  const ef = Math.max(0, m.enterFrames);
  const xf = Math.max(0, Math.min(m.exitFrames, duration));
  const p = m.enter === 'none' || ef === 0 ? 1 : clamp01(f / ef);
  const e = easeOut(p);
  switch (m.enter) {
    case 'fade':
      out.opacity = e;
      break;
    case 'rise':
      out.opacity = e;
      out.ty = MOTION.dist * (1 - e);
      break;
    case 'drop':
      out.opacity = e;
      out.ty = -MOTION.dist * (1 - e);
      break;
    case 'pop':
      out.opacity = clamp01(p * 3);
      out.scale = MOTION.popFrom + (1 - MOTION.popFrom) * easeOutBack(p);
      break;
    case 'slide-left':
      out.opacity = e;
      out.tx = MOTION.slide * (1 - e);
      break;
    case 'slide-right':
      out.opacity = e;
      out.tx = -MOTION.slide * (1 - e);
      break;
    case 'wipe':
      out.reveal = e;
      break;
    case 'typewriter':
      out.chars = p;
      break;
    case 'blur':
      out.opacity = e;
      out.blur = MOTION.blur * (1 - e);
      break;
    case 'none':
      break;
  }
  const q = m.exit === 'none' || xf === 0 ? 0 : clamp01((f - (duration - xf)) / xf);
  const x = easeIn(q);
  if (q > 0) {
    switch (m.exit) {
      case 'fade':
        out.opacity *= 1 - x;
        break;
      case 'sink':
        out.opacity *= 1 - x;
        out.ty += (MOTION.dist / 2) * x;
        break;
      case 'shrink':
        out.opacity *= 1 - x;
        out.scale *= 1 - 0.4 * x;
        break;
      case 'slide-left':
        out.opacity *= 1 - x;
        out.tx -= MOTION.slide * x;
        break;
      case 'slide-right':
        out.opacity *= 1 - x;
        out.tx += MOTION.slide * x;
        break;
      case 'none':
        break;
    }
  }
  const after = f - (m.enter === 'none' ? 0 : ef);
  if (after >= 0 && m.loop !== 'none') {
    const ph = (2 * Math.PI * after) / MOTION.loopPeriod;
    if (m.loop === 'float') out.ty += MOTION.floatAmp * Math.sin(ph);
    if (m.loop === 'pulse') out.scale *= 1 + MOTION.pulseAmp * (0.5 - 0.5 * Math.cos(ph));
  }
  out.emph = m.emphasis.length ? easeOut(clamp01((after - MOTION.emphDelay) / MOTION.emphFrames)) : 1;
  out.accent = m.accent === 'none' ? 1 : easeOut(clamp01((f - Math.round(ef / 2)) / MOTION.accentFrames));
  return out;
}

/** 다 보이는(등장이 끝나고 퇴장이 시작되기 전) 프레임 수 */
export function holdFrames(t: Pick<TextClip, 'duration' | 'motion'>): number {
  const m = t.motion;
  if (!m) return t.duration;
  return t.duration - (m.enter === 'none' ? 0 : m.enterFrames) - (m.exit === 'none' ? 0 : m.exitFrames);
}

/** 움직이는 동안 글 상자가 차지하는 가장 넓은 범위 — 보이는(불투명도 > 0.02) 프레임만. 가이드 검사용 */
export function motionExtent(b: Box, t: Pick<TextClip, 'duration' | 'motion'>): Box {
  if (!t.motion) return b;
  let x0 = b.x;
  let y0 = b.y;
  let x1 = b.x + b.w;
  let y1 = b.y + b.h;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  for (let f = 0; f < t.duration; f++) {
    const m = motionAt(f, t.duration, t.motion);
    if (m.opacity <= 0.02) continue;
    const hw = (b.w / 2) * m.scale;
    const hh = (b.h / 2) * m.scale;
    x0 = Math.min(x0, cx + m.tx - hw);
    x1 = Math.max(x1, cx + m.tx + hw);
    y0 = Math.min(y0, cy + m.ty - hh);
    y1 = Math.max(y1, cy + m.ty + hh);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export interface Segment {
  text: string;
  /** 강조 낱말이면 그 순서(motion.emphasis 의 몇 번째) */
  emph: number | null;
}

/** 글자를 강조 낱말 기준으로 나눈다 — 낱말마다 처음 나온 곳 하나만, 겹치면 앞 것 */
export function segmentsFor(text: string, emphasis: TextMotion['emphasis']): Segment[] {
  const spans: Array<{ from: number; to: number; i: number }> = [];
  emphasis.forEach((e, i) => {
    if (!e.word) return;
    const at = text.indexOf(e.word);
    if (at < 0) return;
    const to = at + e.word.length;
    if (spans.some((s) => at < s.to && to > s.from)) return;
    spans.push({ from: at, to, i });
  });
  spans.sort((a, b) => a.from - b.from);
  const out: Segment[] = [];
  let pos = 0;
  for (const s of spans) {
    if (s.from > pos) out.push({ text: text.slice(pos, s.from), emph: null });
    out.push({ text: text.slice(s.from, s.to), emph: s.i });
    pos = s.to;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), emph: null });
  return out;
}

/** typewriter: 앞에서 n 글자(글자 단위 — 한글 · 이모지 하나가 한 글자)만 보이게 나눈다. 보이지 않는 쪽도 자리는 차지해 줄바꿈이 흔들리지 않는다 */
export function splitVisible(segs: Segment[], fraction: number): Array<Segment & { hidden: boolean }> {
  const total = segs.reduce((n, s) => n + [...s.text].length, 0);
  let left = fraction >= 1 ? total : Math.floor(total * fraction);
  const out: Array<Segment & { hidden: boolean }> = [];
  for (const s of segs) {
    const cs = [...s.text];
    const shown = Math.max(0, Math.min(cs.length, left));
    left -= shown;
    if (shown > 0) out.push({ ...s, text: cs.slice(0, shown).join(''), hidden: false });
    if (shown < cs.length) out.push({ ...s, text: cs.slice(shown).join(''), hidden: true });
  }
  return out;
}

export interface SceneFrame {
  opacity: number;
  /** 아래에서 밀어 올릴 때 화면 높이 대비 비율 */
  ty: number;
  scale: number;
  /** wipe: 왼쪽부터 보이는 비율 */
  reveal: number;
}

/** 장면이 들어올 때(장면 안 f 번째 프레임) — 앞 장면은 그 아래에서 transitionFrames 만큼 더 그려진다(sceneSpan) */
export function sceneMotionAt(f: number, s: Pick<Scene, 'transition' | 'transitionFrames'>): SceneFrame {
  const out: SceneFrame = { opacity: 1, ty: 0, scale: 1, reveal: 1 };
  const n = s.transitionFrames ?? 0;
  if (!s.transition || s.transition === 'cut' || n <= 0) return out;
  const e = easeOut(clamp01(f / n));
  if (s.transition === 'fade') out.opacity = e;
  if (s.transition === 'slide-up') out.ty = 1 - e;
  if (s.transition === 'zoom') {
    out.opacity = e;
    out.scale = MOTION.zoomFrom - (MOTION.zoomFrom - 1) * e;
  }
  if (s.transition === 'wipe') out.reveal = e;
  return out;
}

/** 장면 안의 느린 카메라 — 확대 · 이동(배경 · 영상에만, 글자에는 걸지 않는다) */
export function cameraAt(f: number, duration: number, camera: Camera | undefined): { scale: number; ty: number } {
  const p = duration > 1 ? clamp01(f / (duration - 1)) : 1;
  const k = MOTION.camera;
  switch (camera) {
    case 'zoom-in':
      return { scale: 1 + k * p, ty: 0 };
    case 'zoom-out':
      return { scale: 1 + k * (1 - p), ty: 0 };
    // 위아래로 흐를 때 가장자리가 비지 않게 확대해 둔 만큼만 움직인다
    case 'pan-up':
      return { scale: 1 + k, ty: (k / 2) * (1 - 2 * p) };
    case 'pan-down':
      return { scale: 1 + k, ty: (k / 2) * (2 * p - 1) };
    default:
      return { scale: 1, ty: 0 };
  }
}

/** 장면을 그릴 길이 — 바로 뒤 장면이 겹쳐 들어오면(컷이 아니면) 그만큼 더 그린다 */
export function sceneSpan(scenes: Scene[], s: Scene): number {
  const end = s.start + s.duration;
  const next = scenes.find((x) => x.id !== s.id && x.start === end && x.transition && x.transition !== 'cut' && (x.transitionFrames ?? 0) > 0);
  return Math.max(1, s.duration + (next ? (next.transitionFrames ?? 0) : 0));
}
