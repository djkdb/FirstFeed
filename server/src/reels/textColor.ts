// 글자 「자동」 색 — 화면 · 영상 · 테스트가 같이 쓴다(영상 컴포지션은 글꼴 CSS 를 불러와 테스트에서 못 읽어서 따로)
import { contrast, shade, themeColors } from './color.ts';
import type { Palette, ReelDoc, TextClip } from './model.ts';
import { bgTone } from './themed.ts';

/** 글자가 나올 때 그 뒤 배경의 대표 색 — 그 시각의 장면(영상 · 사진이 있으면 모름) */
export function toneBehind(r: Pick<ReelDoc, 'scenes' | 'bg'>, t: TextClip, palette: Palette): string | null {
  const s = r.scenes.find((x) => t.start >= x.start && t.start < x.start + x.duration);
  if (s?.media) return null;
  return bgTone(s?.bg ?? r.bg, palette);
}

/**
 * 'auto' 글자색: 박스가 있는 스타일은 박스에 맞추고(연한 박스 → 주색을 어둡게, 검정 박스 → 흰색),
 * 나머지는 뒤 배경이 밝으면 주색을 진하게, 어둡거나 모르면(사진 · 영상) 흰색. 어느 쪽이든 4.5:1 을 넘게 고른다
 */
export function textColor(t: TextClip, palette: Palette, behind: string | null = null): string {
  if (t.style.color !== 'auto') return t.style.color;
  const theme = palette.primary;
  if (t.style.preset === 'softbox') return themeColors(theme).softInk;
  if (t.style.preset === 'blackbox' || !behind || contrast('#ffffff', behind) >= 3) return '#ffffff';
  return [0.55, 0.7, 0.82].map((x) => shade(theme, x)).find((c) => contrast(c, behind) >= 4.5) ?? '#141418';
}
