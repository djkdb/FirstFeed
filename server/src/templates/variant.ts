// 축 색 변형 (사용자 지시 2026-10-25 · 화면 다듬기 B): 고정한 템플릿 판은 그대로 두고, **표지의 바탕색만 축마다 브랜드 팔레트의 다른 색으로**
// 돌린다 — 격자에서 같은 축끼리 같은 색이 되어 리듬이 생기게. 팔레트 밖의 색은 만들지 않는다(역할만 서로 바꾼다).
// - 시안마다 표지 바탕으로 쓰는 역할이 다르다: A · C = background, B · D · F = primary, E = text(뒤집은 색)
// - 바탕 역할을 다른 역할과 맞바꾸고, 그 바탕 위 글자색이 명암비 4.5:1 이상이 되게 글자 역할도 팔레트 안에서 고른다. 안 되는 짝은 버린다
// - 0번 축(첫 축)은 원래 모양. 축이 변형 수보다 많으면 처음부터 다시 돈다
// - 표지(cover) · 릴스 표지(reel_cover)에만. 본문 · 마무리는 그대로
// 미리보기 계획 칸 · 실제 카드 표지가 같은 함수(renderFrame 의 pillarIndex)를 지나 달라지지 않는다
import { contrastRatio } from '../brand/limits.ts';
import type { BrandLook, Draft } from './types.ts';

type Palette = BrandLook['palette'];
type Role = 'background' | 'text' | 'primary' | 'secondary' | 'accent';
const ROLES: Role[] = ['primary', 'secondary', 'accent', 'background', 'text'];

/** 시안의 표지 바탕 역할 */
export const COVER_SURFACE: Record<Draft['id'], Role> = { A: 'background', B: 'primary', C: 'background', D: 'primary', E: 'text', F: 'primary' };

const MIN = 4.5;

function swap(p: Palette, a: Role, b: Role): Palette {
  const q = { ...p };
  [q[a], q[b]] = [p[b], p[a]];
  return q;
}

/**
 * 바탕을 바꾼 팔레트가 쓸 만한가. 늘 지키는 것: 글자(text) · 바탕(background) 짝 4.5:1 — 모든 시안이 이 짝으로 글을 쓴다
 * (A · C 표지, D 의 안쪽 판, E 는 뒤집어서). 주색이 표지 바탕이면(B · D · F) 그 위 글자(text · background 중 나은 쪽, base.ts inkOn)도 4.5:1.
 * 글자 · 바탕 짝이 모자라면 글자 역할을 팔레트의 다른 색과 바꿔 본다(가장 잘 읽히는 색)
 */
function usable(surface: Role, q: Palette): Palette | null {
  let r = q;
  if (contrastRatio(r.text, r.background) < MIN) {
    const fixed: Role = surface === 'text' ? 'background' : 'text'; // 표지 바탕이 된 역할은 그대로 두고 글자 쪽을 고른다
    const keep: Role = fixed === 'text' ? 'background' : 'text';
    const best = ROLES.filter((x) => x !== fixed && x !== keep && x !== surface)
      .map((x) => ({ x, c: contrastRatio(r[x], r[keep]) }))
      .sort((a, b) => b.c - a.c)[0];
    if (!best || best.c < MIN) return null;
    r = swap(r, fixed, best.x);
  }
  if (contrastRatio(r.text, r.background) < MIN) return null;
  if (surface === 'primary' && Math.max(contrastRatio(r.text, r.primary), contrastRatio(r.background, r.primary)) < MIN) return null;
  return r;
}

/** 쓸 수 있는 변형들 — 0번은 원래 팔레트, 그 뒤는 바탕색이 서로 다른 것만 */
export function coverVariants(draftId: Draft['id'], p: Palette): Palette[] {
  const surface = COVER_SURFACE[draftId];
  const out: Palette[] = [p];
  for (const r of ROLES) {
    if (r === surface) continue;
    const q = usable(surface, swap(p, surface, r));
    if (q && !out.some((o) => o[surface].toLowerCase() === q[surface].toLowerCase())) out.push(q);
  }
  return out;
}

/** 축 번호에 맞는 표지 모양. 번호가 없으면 원래대로 */
export function pillarCoverLook(draftId: Draft['id'], look: BrandLook, pillarIndex: number | null | undefined): BrandLook {
  if (pillarIndex === null || pillarIndex === undefined || pillarIndex < 0) return look;
  const vs = coverVariants(draftId, look.palette);
  const v = vs[pillarIndex % vs.length]!;
  return v === look.palette ? look : { ...look, palette: { ...v, name: look.palette.name } };
}

/** 축 ID → 프로필 안 순서(없으면 null) */
export const pillarIndexOf = (pillars: Array<{ id: string }>, id: string | null | undefined): number | null => {
  const i = id ? pillars.findIndex((p) => p.id === id) : -1;
  return i >= 0 ? i : null;
};
