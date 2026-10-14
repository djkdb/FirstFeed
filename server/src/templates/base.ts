// 세 시안이 같이 쓰는 바탕 CSS. 레퍼런스(references/card.html.j2)에 적힌 함정에서 가져온 규칙은 여기 한 곳에 둔다
import { contrastRatio } from '../brand/limits.ts';
import { fontById } from '../brand/fonts.ts';
import { fontFaceCss } from '../render/fonts-css.ts';
import type { BrandLook } from './types.ts';

export const family = (id: string) => `'${fontById(id)?.family ?? id}'`;
/** 그 폰트가 가진 굵기 중 원하는 것에 가장 가까운 값 — 없는 굵기를 쓰면 브라우저가 가짜 굵게를 만든다 */
export function weight(id: string, want: number): number {
  const ws = fontById(id)?.weights ?? [400];
  return ws.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a));
}

/**
 * 바탕 위에 글자로 쓸 강조색: 바탕과 큰 글자 기준(3:1) 이상이면서 글자색과 구별되는 색(둘 사이 1.4:1 이상).
 * 글자색과의 조건이 없으면 주색이 글자색과 거의 같은 팔레트(doyun 「퇴근 후 남색」 #1F2A44 vs #1F2433)에서 강조가 안 보인다 — 실제로 PNG 를 열어 보고 발견
 */
export function accentOn(bg: string, look: BrandLook, fg: string = look.palette.text): string | null {
  const p = look.palette;
  for (const c of [p.primary, p.accent, p.secondary]) if (contrastRatio(c, bg) >= 3 && contrastRatio(c, fg) >= 1.4) return c;
  return null;
}

/**
 * 강조(**…**) 모양: 쓸 강조색이 있으면 글자색, 없으면 글자는 그대로 두고 아래쪽에 형광펜 띠(보조색 또는 강조색).
 * 팔레트 밖의 색을 지어내지 않는다
 */
export function markCss(bg: string, look: BrandLook, fg: string = look.palette.text): string {
  const acc = accentOn(bg, look, fg);
  if (acc) return `.mk{color:${acc}}`;
  const p = look.palette;
  const band = [p.secondary, p.accent].find((c) => contrastRatio(fg, c) >= 4.5) ?? p.secondary;
  return `.mk{background:linear-gradient(transparent 58%, ${band} 58%, ${band} 92%, transparent 92%)}`;
}

/** 주색 바탕 위 글자색: 글자색·배경색 중 더 잘 읽히는 쪽 (팔레트 규칙이 4.5:1 을 보장) */
export function inkOn(bg: string, look: BrandLook): string {
  const p = look.palette;
  return contrastRatio(p.text, bg) >= contrastRatio(p.background, bg) ? p.text : p.background;
}

/** 워드마크: 아이디의 첫 마디(점·밑줄 앞) 대문자, 최대 8자. 아이디가 없으면 null */
export function wordmark(look: BrandLook): string | null {
  const h = look.handle?.split(/[._]/)[0]?.toUpperCase();
  return h ? h.slice(0, 8) : null;
}

export function baseCss(look: BrandLook, w: number, h: number): string {
  return `
${fontFaceCss([look.titleFont, look.bodyFont])}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px}
body{
  font-family:${family(look.bodyFont)};
  /* 한글이 낱말 중간에서 쪼개지지 않게 (레퍼런스: 지우면 "다시" 가 "다 / 시") */
  word-break:keep-all;
  -webkit-font-smoothing:antialiased;
}
[data-card]{position:relative;width:${w}px;height:${h}px;overflow:hidden;display:flex;flex-direction:column}
/* flex 칸의 min-height:auto 는 "내용보다 작아지지 마라" — 글이 길면 칸이 카드 밖으로 자란다(레퍼런스 함정). 두 겹 다 눌러 준다 */
.inner,.mid{min-height:0}
.title{font-family:${family(look.titleFont)}}
.br{display:block;height:.62em}
`;
}

export const esc = (s: string | null | undefined) => (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
