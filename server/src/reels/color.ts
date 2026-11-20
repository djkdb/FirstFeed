// 릴스 색 계산 — 개성색(브랜딩 키트 팔레트의 주색)에서 글자 스타일 · 배경 · 무늬 색을 만든다(결정 2026-11-06).
// 브랜드 팔레트를 바꾸면 이미 만든 릴스도 같이 바뀐다(색 대신 이름을 저장해서)
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

export function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}
export const hex = ([r, g, b]: [number, number, number]) => `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;

/** a 와 b 를 t(0~1) 만큼 섞기 */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
export const tint = (c: string, t: number) => mix(c, '#ffffff', t);
export const shade = (c: string, t: number) => mix(c, '#000000', t);

export function luminance(c: string): number {
  const [r, g, b] = rgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
/** 그 바탕 위에서 읽히는 글자색(흰색 · 거의 검정 중 명암비가 큰 쪽) */
export const readableOn = (bg: string) => (contrast(bg, '#ffffff') >= contrast(bg, '#141418') ? '#ffffff' : '#141418');

/** 색상환에서 deg 만큼 돌린 색 — 그라데이션 짝 색 */
export function hueShift(c: string, deg: number): string {
  const [r, g, b] = rgb(c).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return c;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + deg + 360) % 360;
  const C = (1 - Math.abs(2 * l - 1)) * s;
  const X = C * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - C / 2;
  const [a, bb, cc] = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X];
  return hex([(a + m) * 255, (bb + m) * 255, (cc + m) * 255]);
}

/** 개성색 하나로 만드는 색 묶음 */
export function themeColors(theme: string) {
  const soft = tint(theme, 0.8);
  // 연한 박스 위 글자: 개성색을 어둡게 — 그래도 4.5:1 이 안 되면 거의 검정
  const ink = [0.55, 0.7, 0.8].map((t) => shade(theme, t)).find((c) => contrast(c, soft) >= 4.5) ?? '#141418';
  return {
    accent: theme,
    soft,
    softInk: ink,
    pale: tint(theme, 0.9),
    light: tint(theme, 0.62),
    deep: shade(theme, 0.62),
    night: shade(theme, 0.85),
    partner: hueShift(theme, 40),
    partner2: hueShift(theme, -45),
    onAccent: readableOn(theme),
  };
}

/** 브랜드 팔레트가 아직 없을 때만 쓰는 중립 색 — 개성색 후보를 따로 두지 않는다(팔레트가 개성색) */
export const FALLBACK_THEME = '#3c4150';
