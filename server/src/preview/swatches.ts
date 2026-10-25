// 미리보기 · 공유 이미지의 글자 원(결정 2026-10-25, 소개 페이지와 같은 방식): 프로필 사진이 없으면 주색 원 + 이름 첫 글자,
// 하이라이트는 축 색 원 + 축 이름 첫 글자. 축 색은 그 축 표지의 바탕색(축 색 변형, templates/variant.ts)과 같게 — 격자와 하이라이트가 같은 색으로 묶인다
import { contrastRatio } from '../brand/limits.ts';
import type { BrandLook, Draft } from '../templates/types.ts';
import { COVER_SURFACE, coverVariants } from '../templates/variant.ts';

type Palette = BrandLook['palette'];
export interface Swatch {
  bg: string;
  fg: string;
  mark: string;
}

/** 바탕 위 글자색: 팔레트의 글자 · 바탕색 중 더 잘 읽히는 쪽 */
const inkFor = (bg: string, p: Palette) => (contrastRatio(p.text, bg) >= contrastRatio(p.background, bg) ? p.text : p.background);
const first = (s: string | null | undefined) => (s ? ([...s.replace(/^[^\p{L}\p{N}]+/u, '')][0] ?? '') : '');

export function avatarSwatch(name: string | null, p: Palette): Swatch | null {
  const mark = first(name);
  return mark ? { bg: p.primary, fg: inkFor(p.primary, p), mark } : null;
}

/** 하이라이트 i 번째의 원 — 축 색 변형이 꺼져 있으면 팔레트 색을 차례로(주색 · 보조색 · 강조색) */
export function highlightSwatches(labels: string[], p: Palette, draftId: Draft['id'] | null, variantOn: boolean): Array<Swatch & { label: string }> {
  const surface = COVER_SURFACE[draftId ?? 'A'];
  const colors = variantOn ? coverVariants(draftId ?? 'A', p).map((v) => v[surface]) : [p.primary, p.secondary, p.accent];
  return labels.map((label, i) => {
    const bg = colors[i % colors.length]!;
    return { label, bg, fg: inkFor(bg, p), mark: first(label) };
  });
}
