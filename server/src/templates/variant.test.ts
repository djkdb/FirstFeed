// 축 색 변형 (2026-10-25) — 모든 시안 × 테스트 브랜드 팔레트에서 명암비 규칙을 지키는지
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../brand/limits.ts';
import { env } from '../config.ts';
import type { BrandLook, Draft } from './types.ts';
import { COVER_SURFACE, coverVariants, pillarCoverLook, pillarIndexOf } from './variant.ts';

const brands = ['real', 'generated']
  .flatMap((set) => {
    const dir = path.join(env.repoRoot, 'tests/fixtures', set, 'brands');
    return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ name: `${set}/${f}`, look: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).look as BrandLook })) : [];
  });
const DRAFTS = Object.keys(COVER_SURFACE) as Draft['id'][];

describe('축 색 변형 — 팔레트 역할만 바꾸고 명암비 4.5:1 을 지킨다', () => {
  it('테스트 브랜드가 있다', () => expect(brands.length).toBeGreaterThan(0));

  for (const b of brands)
    it(`${b.name}: 모든 시안의 모든 변형에서 글자 · 바탕 4.5:1, 주색 바탕이면 그 위 글자도 4.5:1, 색은 팔레트 안의 것만`, () => {
      const colors = new Set(Object.entries(b.look.palette).filter(([k]) => k !== 'name').map(([, v]) => String(v).toLowerCase()));
      for (const d of DRAFTS) {
        const vs = coverVariants(d, b.look.palette);
        expect(vs[0]).toBe(b.look.palette);
        for (const v of vs) {
          expect(contrastRatio(v.text, v.background)).toBeGreaterThanOrEqual(4.5);
          if (COVER_SURFACE[d] === 'primary') expect(Math.max(contrastRatio(v.text, v.primary), contrastRatio(v.background, v.primary))).toBeGreaterThanOrEqual(4.5);
          for (const role of ['primary', 'secondary', 'accent', 'background', 'text'] as const) expect(colors.has(v[role].toLowerCase())).toBe(true);
        }
        const surfaces = vs.map((v) => v[COVER_SURFACE[d]].toLowerCase());
        expect(new Set(surfaces).size).toBe(surfaces.length);
      }
    });

  it('0번 축은 원래 모양, 번호가 없으면 원래 모양, 변형 수보다 큰 번호는 처음부터 다시', () => {
    const look = brands[0]!.look;
    expect(pillarCoverLook('A', look, 0)).toBe(look);
    expect(pillarCoverLook('A', look, null)).toBe(look);
    const n = coverVariants('A', look.palette).length;
    expect(pillarCoverLook('A', look, n).palette.background).toBe(look.palette.background);
    if (n > 1) expect(pillarCoverLook('A', look, 1).palette.background).not.toBe(look.palette.background);
  });

  it('축 ID → 프로필 안 순서', () => {
    expect(pillarIndexOf([{ id: 'a' }, { id: 'b' }], 'b')).toBe(1);
    expect(pillarIndexOf([{ id: 'a' }], 'z')).toBeNull();
    expect(pillarIndexOf([{ id: 'a' }], null)).toBeNull();
  });
});
