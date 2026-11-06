// 개성색(브랜드 팔레트)을 따라가는 배경 · 무늬 — 저장은 이름(look · 무늬 id · 팔레트 칸)만, 칠할 때 지금 팔레트로 계산한다.
// 무늬는 이 코드가 그린 SVG — 남의 그림을 넣지 않는다(AI 이미지 생성 비목표와도 무관)
import { hueShift, mix, shade, themeColors, tint } from './color.ts';
import type { Bg, Palette, ThemedLook } from './model.ts';

type Concrete = { kind: 'solid'; color: string } | { kind: 'gradient'; from: string; to: string; angle: number; aurora?: boolean } | { kind: 'image'; src: string; blur: number; dim: number };

export const THEMED_LOOKS: Array<{ look: ThemedLook; label: string }> = [
  { look: 'pastel', label: '' },
  { look: 'mist', label: '' },
  { look: 'deep', label: '' },
  { look: 'cream', label: '' },
  { look: 'sky', label: '' },
  { look: 'night', label: '' },
  { look: 'aurora', label: '오로라' },
  { look: 'aurora2', label: '오로라' },
  { look: 'aurora3', label: '오로라' },
];

export function themedGradient(look: ThemedLook, theme: string): Concrete {
  const c = themeColors(theme);
  switch (look) {
    case 'pastel':
      return { kind: 'gradient', from: tint(theme, 0.86), to: tint(theme, 0.6), angle: 160 };
    case 'mist':
      return { kind: 'gradient', from: tint(theme, 0.9), to: tint(c.partner, 0.65), angle: 160 };
    case 'deep':
      return { kind: 'gradient', from: shade(theme, 0.78), to: shade(theme, 0.35), angle: 180 };
    case 'cream':
      return { kind: 'gradient', from: '#fffaf0', to: mix(tint(theme, 0.75), '#fff3d6', 0.5), angle: 180 };
    case 'sky':
      return { kind: 'gradient', from: tint(theme, 0.55), to: tint(theme, 0.94), angle: 180 };
    case 'night':
      return { kind: 'gradient', from: '#141418', to: shade(theme, 0.65), angle: 180 };
    case 'aurora':
      return { kind: 'gradient', from: theme, to: c.partner, angle: 0, aurora: true };
    case 'aurora2':
      return { kind: 'gradient', from: tint(theme, 0.25), to: c.partner2, angle: 0, aurora: true };
    case 'aurora3':
      return { kind: 'gradient', from: hueShift(theme, 25), to: hueShift(theme, -25), angle: 0, aurora: true };
  }
}

const svg = (body: string, bg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="${bg}"/>${body}</svg>`)}`;
const grid = (step: number, draw: (x: number, y: number, i: number) => string) => {
  let out = '';
  let i = 0;
  for (let y = 0; y < 1920 + step; y += step) for (let x = 0; x < 1080 + step; x += step) out += draw(x, y, i++);
  return out;
};
const heart = (x: number, y: number, s: number, c: string) =>
  `<path transform="translate(${x} ${y}) scale(${s})" fill="${c}" d="M0 -6 C-3 -12 -12 -10 -12 -3 C-12 4 -4 9 0 13 C4 9 12 4 12 -3 C12 -10 3 -12 0 -6Z"/>`;
const star = (x: number, y: number, r: number, c: string) => {
  const pts = Array.from({ length: 10 }, (_, k) => {
    const a = (Math.PI / 5) * k - Math.PI / 2;
    const rr = k % 2 ? r * 0.45 : r;
    return `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return `<polygon points="${pts}" fill="${c}"/>`;
};
const blobs = (list: Array<[number, number, string]>, blur: number, bg: string, op = 1) =>
  svg([`<defs><filter id="b"><feGaussianBlur stdDeviation="${blur}"/></filter></defs>`, ...list.map(([x, y, c]) => `<ellipse cx="${x}" cy="${y}" rx="440" ry="280" fill="${c}" opacity="${op}" filter="url(#b)"/>`)].join(''), bg);

export interface PatternDef {
  id: string;
  name: string;
  set: 'carousel' | 'cover';
  draw: (theme: string) => string;
}

/** 무늬의 바탕 밝기 쪽 — 캐러셀은 밝은 바탕, 커버는 어두운 바탕(글자 자동 색에 씀) */
const PATTERN_TONE: Record<'carousel' | 'cover', (t: string) => string> = { carousel: (t) => tint(t, 0.93), cover: (t) => shade(t, 0.87) };

export const PATTERNS: PatternDef[] = [
  { id: 'check', name: '체크', set: 'carousel', draw: (t) => svg(grid(120, (x, y) => `<rect x="${x}" y="${y}" width="60" height="120" fill="${tint(t, 0.8)}" opacity=".7"/><rect x="${x}" y="${y}" width="120" height="60" fill="${tint(t, 0.8)}" opacity=".7"/>`), tint(t, 0.96)) },
  { id: 'dots', name: '물방울', set: 'carousel', draw: (t) => svg(grid(90, (x, y, i) => `<circle cx="${x + (Math.floor(y / 90) % 2) * 45}" cy="${y}" r="${i % 3 ? 9 : 14}" fill="${tint(t, 0.55)}"/>`), tint(t, 0.94)) },
  { id: 'stripe', name: '줄무늬', set: 'carousel', draw: (t) => svg(grid(80, (x, y) => (x === 0 ? `<rect x="0" y="${y}" width="1080" height="34" fill="${tint(t, 0.82)}"/>` : '')), '#ffffff') },
  { id: 'hearts', name: '하트', set: 'carousel', draw: (t) => svg(grid(150, (x, y) => heart(x + (Math.floor(y / 150) % 2) * 75, y, 2.2, tint(t, 0.6))), tint(t, 0.95)) },
  { id: 'stars', name: '별', set: 'carousel', draw: (t) => svg(grid(160, (x, y, i) => star(x + (i % 2) * 50, y + (i % 3) * 20, i % 4 ? 14 : 22, tint(hueShift(t, 30), 0.35))), tint(t, 0.95)) },
  { id: 'clouds', name: '구름', set: 'carousel', draw: (t) => blobs([[200, 300, tint(t, 0.7)], [800, 500, tint(hueShift(t, 40), 0.7)], [400, 1000, tint(t, 0.8)], [850, 1400, tint(hueShift(t, -40), 0.7)], [250, 1700, tint(t, 0.7)]], 60, tint(t, 0.95)) },
  { id: 'nightsky', name: '밤하늘', set: 'cover', draw: (t) => svg(grid(140, (x, y, i) => star(x + ((i * 37) % 90), y + ((i * 53) % 70), i % 5 ? 4 : 9, tint(t, 0.85))), shade(t, 0.85)) },
  { id: 'darkdots', name: '어두운 물방울', set: 'cover', draw: (t) => svg(grid(100, (x, y) => `<circle cx="${x + (Math.floor(y / 100) % 2) * 50}" cy="${y}" r="10" fill="${t}" opacity=".55"/>`), shade(t, 0.88)) },
  { id: 'darkcheck', name: '어두운 체크', set: 'cover', draw: (t) => svg(grid(120, (x, y) => `<rect x="${x}" y="${y}" width="60" height="60" fill="${shade(t, 0.75)}"/><rect x="${x + 60}" y="${y + 60}" width="60" height="60" fill="${shade(t, 0.75)}"/>`), shade(t, 0.88)) },
  { id: 'glowclouds', name: '빛 구름', set: 'cover', draw: (t) => blobs([[250, 400, t], [850, 800, hueShift(t, 50)], [300, 1400, hueShift(t, -40)]], 70, shade(t, 0.9), 0.8) },
];

/**
 * 배경의 대표 색(글자 자동 색을 고르려고). 단색 · 그라데이션 · 무늬는 계산하고, 올린 사진 · 영상은 모르니 null
 * (그때는 흰 글자 + 그림자 — 사진 위 글자의 흔한 모양)
 */
export function bgTone(bg: Bg, palette: Palette): string | null {
  const theme = palette.primary;
  if (bg.kind === 'brand') return palette[bg.role];
  if (bg.kind === 'pattern') {
    const def = PATTERNS.find((x) => x.id === bg.id);
    return def && bg.dim < 0.3 ? PATTERN_TONE[def.set](theme) : null;
  }
  const r = resolveBg(bg, palette);
  if (r.kind === 'solid') return r.color;
  if (r.kind === 'gradient') return r.aurora ? '#141418' : mix(r.from, r.to, 0.5);
  return null;
}

/** 저장된 배경 → 지금 개성색으로 칠할 실제 배경 */
export function resolveBg(bg: Bg, palette: Palette): Concrete {
  const theme = palette.primary;
  if (bg.kind === 'brand') return { kind: 'solid', color: palette[bg.role] };
  if (bg.kind === 'themed') return themedGradient(bg.look, theme);
  if (bg.kind === 'pattern') {
    const def = PATTERNS.find((x) => x.id === bg.id) ?? PATTERNS[0]!;
    return { kind: 'image', src: def.draw(theme), blur: bg.blur, dim: bg.dim };
  }
  return bg;
}
