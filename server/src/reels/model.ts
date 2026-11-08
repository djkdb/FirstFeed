// 릴스 편집 데이터 — 화면 · 서버 · 영상(Remotion)이 같이 쓴다. 시간 단위는 프레임(30fps).
// 결정 2026-11-06(편집 화면 녹이기): 색은 브랜딩 키트 팔레트, 글꼴은 브랜딩 키트 + 앱의 OFL 목록, 가이드는 격자 가림(확인값)만.
// 올린 원본은 data 폴더의 복사본만 쓰고 고치지 않는다
import { FONTS } from '../brand/fonts.ts';

export const FPS = 30;
export const W = 1080;
export const H = 1920;

/** 개성색을 따라가는 배경 이름 — 칠할 때 지금 팔레트로 계산(themed.ts) */
export type ThemedLook = 'pastel' | 'mist' | 'deep' | 'cream' | 'sky' | 'night' | 'aurora' | 'aurora2' | 'aurora3';

export type Bg =
  | { kind: 'solid'; color: string }
  /** 팔레트의 한 칸(primary · secondary …) — 팔레트를 바꾸면 따라간다 */
  | { kind: 'brand'; role: PaletteRole }
  | { kind: 'themed'; look: ThemedLook }
  | { kind: 'pattern'; id: string; blur: number; dim: number }
  | { kind: 'image'; src: string; blur: number; dim: number };

export type PaletteRole = 'primary' | 'secondary' | 'accent' | 'background' | 'text';
export interface Palette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

/** 영상이 쓰는 브랜드 — 서버가 브랜딩 키트에서 꺼내 준다 */
export interface ReelBrand {
  palette: Palette;
  titleFont: string;
  bodyFont: string;
  handle: string | null;
}

export interface Media {
  src: string;
  kind: 'video' | 'image';
  /** 원본에서 몇 프레임째부터 쓰는지 */
  trim: number;
}

/** 모션그래픽(결정 2026-11-08) — 프리셋 이름만 저장하고, 그리는 것은 motion.ts 의 순수 함수 하나(화면 = 영상 = 규칙 검사) */
export type Enter = 'none' | 'fade' | 'rise' | 'drop' | 'pop' | 'slide-left' | 'slide-right' | 'wipe' | 'typewriter' | 'blur';
export type Exit = 'none' | 'fade' | 'sink' | 'shrink' | 'slide-left' | 'slide-right';
export type Emphasis = 'highlight' | 'underline' | 'color';
export type Accent = 'none' | 'bar' | 'ring' | 'sweep';
export type LoopMotion = 'none' | 'float' | 'pulse';
export type Transition = 'cut' | 'fade' | 'slide-up' | 'zoom' | 'wipe';
export type Camera = 'none' | 'zoom-in' | 'zoom-out' | 'pan-up' | 'pan-down';

export interface TextMotion {
  enter: Enter;
  enterFrames: number;
  exit: Exit;
  exitFrames: number;
  /** 강조할 낱말 — 글자 안에 실제로 있어야 한다(규칙) */
  emphasis: Array<{ word: string; style: Emphasis }>;
  accent: Accent;
  /** 강조 · 장식 색 — 팔레트 칸 이름(팔레트를 바꾸면 따라간다) */
  accentColor: PaletteRole;
  loop: LoopMotion;
}

export interface Scene {
  id: string;
  name: string;
  start: number;
  duration: number;
  media: Media | null;
  /** null 이면 릴스 기본 배경 */
  bg: Bg | null;
  /** 앞 장면에서 이 장면으로 넘어오는 방식(없으면 컷) */
  transition?: Transition;
  transitionFrames?: number;
  /** 장면 안의 느린 확대 · 이동(없으면 멈춤) */
  camera?: Camera;
}

export type Preset = 'plain' | 'glow' | 'softbox' | 'stroke' | 'blackbox' | 'title';

export interface TextStyle {
  preset: Preset;
  /** 'title' · 'body' 면 브랜딩 키트의 그 글꼴, 그 밖은 앱 글꼴 목록의 id */
  font: string;
  size: number;
  /** 'auto' 면 스타일 · 뒤 배경 · 팔레트로 읽히는 색 */
  color: string;
  bold: boolean;
  align: 'left' | 'center' | 'right';
  /** 글 상자 가운데 기준 좌표(1080×1920 안) */
  x: number;
  y: number;
  width: number;
  rotation: number;
}

export interface TextClip {
  id: string;
  start: number;
  duration: number;
  text: string;
  /** 「자막 전체」 일괄 수정에 들어가는가 */
  subtitle: boolean;
  style: TextStyle;
  /** 없으면 움직임 없음(예전 릴스 그대로) */
  motion?: TextMotion;
}

export interface Overlay {
  id: string;
  start: number;
  duration: number;
  src: string;
  kind: 'video' | 'image';
  trim: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AudioClip {
  id: string;
  start: number;
  duration: number;
  src: string;
  trim: number;
  volume: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Asset {
  file: string;
  kind: 'video' | 'image' | 'audio';
  name: string;
  /** 영상 · 소리 길이(초) — ffprobe 로 잼, 모르면 null */
  seconds: number | null;
}

/** 편집 내용(저장되는 것). id · 시각은 DB 칸 */
export interface ReelDoc {
  version: 1;
  name: string;
  bg: Bg;
  scenes: Scene[];
  texts: TextClip[];
  overlays: Overlay[];
  audio: AudioClip[];
  assets: Asset[];
  memo: string;
  /** 처음 본 글자의 문구 · 색 — 「원본 문구·색」 탭 */
  original: Record<string, { text: string; color: string }>;
  /** 아래 진행 막대 색(팔레트 칸). 없거나 null 이면 막대 없음 */
  progress?: PaletteRole | null;
}

export type Track = 'texts' | 'overlays' | 'scenes' | 'audio';
export type Clip = TextClip | Overlay | Scene | AudioClip;

/** 글꼴 이름 → CSS font-family. 'title' · 'body' 는 브랜딩 키트의 글꼴 */
export function fontFamily(id: string, brand: ReelBrand): string {
  const real = id === 'title' ? brand.titleFont : id === 'body' ? brand.bodyFont : id;
  const f = FONTS.find((x) => x.id === real) ?? FONTS[0]!;
  return `'${f.family}', sans-serif`;
}
export const fontIdOf = (id: string, brand: ReelBrand) => (id === 'title' ? brand.titleFont : id === 'body' ? brand.bodyFont : id);

export const STYLE_PRESETS: Record<Preset, { label: string; style: Partial<TextStyle> }> = {
  glow: { label: '네온 빛', style: { preset: 'glow', font: 'title', color: 'auto', size: 76 } },
  softbox: { label: '연한 박스', style: { preset: 'softbox', font: 'body', color: 'auto', size: 64, bold: true } },
  stroke: { label: '흰 글씨 검정 테두리', style: { preset: 'stroke', font: 'title', color: 'auto', size: 72, bold: true } },
  blackbox: { label: '검정 박스', style: { preset: 'blackbox', font: 'body', color: 'auto', size: 60, bold: true } },
  plain: { label: '그림자만', style: { preset: 'plain', font: 'body', color: 'auto', size: 72 } },
  title: { label: '큰 제목', style: { preset: 'title', font: 'title', color: 'auto', size: 120, bold: true, y: 520 } },
};

export const SUBTITLE_Y = 1125;

export const defaultTextStyle = (): TextStyle => ({
  preset: 'softbox',
  font: 'body',
  size: 64,
  color: 'auto',
  bold: true,
  align: 'center',
  x: W / 2,
  y: SUBTITLE_Y,
  // 격자 가림 안쪽에 넉넉히 — 좌우 UI 가림은 아직 모른다(0-9)
  width: 840,
  rotation: 0,
});

export const uid = () => Math.random().toString(36).slice(2, 10);
export const clipEnd = (c: { start: number; duration: number }) => c.start + c.duration;

export function totalFrames(r: Pick<ReelDoc, 'scenes' | 'texts' | 'overlays' | 'audio'>): number {
  const all: Array<{ start: number; duration: number }> = [...r.scenes, ...r.texts, ...r.overlays, ...r.audio];
  return Math.max(FPS, ...all.map(clipEnd));
}

export const sceneAt = (r: Pick<ReelDoc, 'scenes'>, frame: number) => r.scenes.find((s) => frame >= s.start && frame < clipEnd(s)) ?? null;

export const fmtTime = (frame: number) => {
  const s = frame / FPS;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
};

/** 대본 → 자막: 줄마다 하나, 글자 수에 비례해 [from, to) 를 빈틈없이 나눈다(최소 0.6초) */
export function scriptToSubtitles(script: string, from: number, to: number, style: TextStyle): TextClip[] {
  const lines = script
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length || to <= from) return [];
  const minF = Math.round(FPS * 0.6);
  const span = to - from;
  const weights = lines.map((l) => Math.max(1, [...l.replace(/\s/g, '')].length));
  const sum = weights.reduce((a, b) => a + b, 0);
  let lens = weights.map((w) => Math.max(minF, Math.floor((span * w) / sum)));
  const over = lens.reduce((a, b) => a + b, 0) - span;
  if (over > 0) lens = lens.map((l) => Math.max(1, l - Math.ceil((over * l) / (span + over))));
  const out: TextClip[] = [];
  let t = from;
  lines.forEach((text, i) => {
    const d = i === lines.length - 1 ? Math.max(1, to - t) : Math.max(1, lens[i]!);
    out.push({ id: uid(), start: t, duration: d, text, subtitle: true, style: { ...style } });
    t += d;
  });
  return out;
}

/** 자석: thr 프레임 안에서 가장 가까운 대상에 붙인다 */
export function snap(value: number, targets: number[], thr: number): number {
  let best = value;
  let dist = thr + 1;
  for (const t of targets) {
    const d = Math.abs(t - value);
    if (d <= thr && d < dist) {
      best = t;
      dist = d;
    }
  }
  return best;
}

/** 자르기: at 에서 둘로. 영상 · 소리는 뒤 조각의 시작 지점(trim)을 늘린다 */
export function splitClip<T extends { id: string; start: number; duration: number }>(c: T, at: number): [T, T] | null {
  if (at <= c.start || at >= clipEnd(c)) return null;
  const a = { ...c, duration: at - c.start };
  const b = { ...structuredClone(c), id: uid(), start: at, duration: clipEnd(c) - at } as T;
  const bx = b as unknown as { trim?: number; media?: Media | null };
  if (typeof bx.trim === 'number') bx.trim += at - c.start;
  if (bx.media) bx.media.trim += at - c.start;
  return [a, b];
}

/** 새 릴스 — 장면 셋(훅 · 본론 · 마무리)과 자리 잡는 글자. 대본 단계(FR-MK-4)가 생기면 그 결과로 채운다 */
export function newReelDoc(name: string): ReelDoc {
  const s = defaultTextStyle();
  const doc: ReelDoc = {
    version: 1,
    name,
    bg: { kind: 'themed', look: 'pastel' },
    scenes: [
      { id: uid(), name: '훅', start: 0, duration: 90, media: null, bg: null },
      { id: uid(), name: '본론', start: 90, duration: 150, media: null, bg: null },
      { id: uid(), name: '마무리', start: 240, duration: 90, media: null, bg: null },
    ],
    texts: [
      { id: uid(), start: 0, duration: 90, text: '첫 1초에 결과부터', subtitle: false, style: { ...s, ...STYLE_PRESETS.title.style } as TextStyle },
      ...scriptToSubtitles('여기에 대본을 붙여 넣으세요\n줄마다 자막 하나가 돼요\n끌어서 옮길 수 있어요', 0, 330, s),
    ],
    overlays: [],
    audio: [],
    assets: [],
    memo: '',
    original: {},
  };
  return withOriginals(doc);
}

/** 처음 본 글자의 문구 · 색을 기억(이미 기억한 것은 그대로) */
export function withOriginals(r: ReelDoc): ReelDoc {
  const o = { ...r.original };
  let changed = false;
  for (const t of r.texts)
    if (!o[t.id]) {
      o[t.id] = { text: t.text, color: t.style.color };
      changed = true;
    }
  return changed ? { ...r, original: o } : r;
}

/** 글 상자 크기 어림 — 화면에 안 보이는 글자의 가림 경고용(보이는 글자는 화면이 실제로 잰다) */
export function estimateTextBox(t: TextClip): Box {
  const perLine = Math.max(1, Math.floor(t.style.width / (t.style.size * 0.95)));
  const lines = t.text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil([...l].length / perLine)), 0);
  const pad = t.style.preset === 'softbox' || t.style.preset === 'blackbox' ? t.style.size * 0.5 : 0;
  const longest = Math.max(...t.text.split('\n').map((l) => [...l].length));
  const w = Math.min(t.style.width, longest * t.style.size * 0.95) + pad * 2;
  const h = lines * t.style.size * 1.25 + pad;
  return { x: t.style.x - w / 2, y: t.style.y - h / 2, w, h };
}

export const inside = (b: Box, g: Box) => b.x >= g.x - 0.5 && b.y >= g.y - 0.5 && b.x + b.w <= g.x + g.w + 0.5 && b.y + b.h <= g.y + g.h + 0.5;
