import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../brand/limits.ts';
import { env } from '../config.ts';
import type { BrandLook } from '../templates/types.ts';
import { COVER_SURFACE, coverVariants } from '../templates/variant.ts';
import { avatarSwatch, highlightSwatches } from './swatches.ts';

const look: BrandLook = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/generated/brands/doyun.json'), 'utf8')).look;

describe('글자 원 (2026-10-25, 소개 페이지와 같은 방식)', () => {
  it('프로필: 주색 원 + 이름 첫 글자(앞의 기호는 건너뜀), 이름이 없으면 없음', () => {
    expect(avatarSwatch('비전공자 코딩 기록', look.palette)).toMatchObject({ bg: look.palette.primary, mark: '비' });
    expect(avatarSwatch('▸코딩', look.palette)?.mark).toBe('코');
    expect(avatarSwatch(null, look.palette)).toBeNull();
  });

  it('하이라이트: 축 색 변형을 켜면 그 축 표지 바탕색과 같은 색, 끄면 팔레트 색을 차례로 — 글자색은 더 잘 읽히는 쪽', () => {
    const on = highlightSwatches(['가 축', '나 축', '다 축'], look.palette, 'B', true);
    const surfaces = coverVariants('B', look.palette).map((v) => v[COVER_SURFACE.B]);
    expect(on.map((h) => h.bg)).toEqual(surfaces.slice(0, 3));
    expect(on.map((h) => h.mark)).toEqual(['가', '나', '다']);
    for (const h of on) expect(contrastRatio(h.fg, h.bg)).toBeGreaterThanOrEqual(3);
    expect(highlightSwatches(['가'], look.palette, 'B', false)[0]!.bg).toBe(look.palette.primary);
    // 하이라이트 순서가 축 순서와 달라도 이름이 같으면 그 축의 색
    const byName = highlightSwatches(['다 축', '가 축'], look.palette, 'B', true, ['가 축', '나 축', '다 축']);
    expect(byName.map((h) => h.bg)).toEqual([surfaces[2], surfaces[0]]);
  });
});
