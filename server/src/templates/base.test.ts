// 무늬 · 그라데이션 색 섞기 (시안 G · J, 2026-11-19): 팔레트 두 색 사이만 쓰고, 글자 뒤 색은 4.5:1 을 지킨다
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../brand/limits.ts';
import { mix, photoBox, tintFor } from './base.ts';

describe('mix · tintFor', () => {
  it('두 색 사이를 섞는다', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
  it('글자 뒤 섞은 색은 글자와 4.5:1 이 남는 데까지만', () => {
    // 흰 바탕 · 검정 글자 · 진한 보조색 — 끝까지 섞으면 글자가 안 읽힌다
    const c = tintFor('#FFFFFF', '#1F2433', '#111111', 0.9);
    expect(contrastRatio('#111111', c)).toBeGreaterThanOrEqual(4.5);
    expect(c).not.toBe('#ffffff');
    // 어떤 비율로도 안 되면 원래 바탕색
    expect(tintFor('#FFFFFF', '#000000', '#777777', 0.6)).toBe('#FFFFFF');
  });
  it('사진 칸: 그림이 없으면 칸을 그리지 않고, 주소의 따옴표 · 괄호는 지운다', () => {
    expect(photoBox(null)).toBe('');
    expect(photoBox("data:image/png;base64,AA')x")).not.toMatch(/AA'\)/);
  });
});
