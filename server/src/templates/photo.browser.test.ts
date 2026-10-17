// 시안 F · 그림 바탕 표지 (결정 2026-10-18): 글자 뒤 명암비를 그린 PNG 에서 재서 띠 진하기를 고르고, 모자라면 실패. 격자 안전 영역 안
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env, setSetting } from '../config.ts';
import { openDb } from '../db/index.ts';
import { closeBrowser, getBrowser } from '../render/browser.ts';
import { draftF } from './draft-f.ts';
import { renderPhotoFrame } from './render-frame.ts';
import type { BrandLook, FrameContent } from './types.ts';

const look: BrandLook = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/generated/brands/doyun.json'), 'utf8')).look;
const img = (n: string) => `data:image/png;base64,${fs.readFileSync(path.join(env.repoRoot, `tests/fixtures/generated/images/${n}.png`)).toString('base64')}`;
const COVER: FrameContent = { kind: 'cover', headline: '모아 1.2\n**바뀐 것** 5가지', sub: "댓글에 '모아' 쓰면 정리본 보내드려요", chip: 'N시리즈' };
const REEL: FrameContent = { kind: 'reel_cover', headline: '모아 1.2\n**바뀐 것** 5가지', chip: 'N시리즈' };

let ready = false;
beforeAll(async () => {
  try {
    await getBrowser(null);
    ready = true;
  } catch (e) {
    console.warn(`[그림 바탕 표지 테스트 건너뜀] ${(e as Error).message}`);
  }
}, 30_000);
afterAll(() => closeBrowser());

describe('그림 위 글자의 명암비로 띠 진하기를 고른다', () => {
  it('어두운 그림은 가장 옅은 단계, 밝은 그림은 4.5:1 을 넘는 단계까지 진하게 — 모든 그림 위 칸이 4.5:1 이상', async () => {
    if (!ready) return;
    const dark = await renderPhotoFrame(null, draftF, look, COVER, img('dark'));
    const light = await renderPhotoFrame(null, draftF, look, COVER, img('light'));
    expect(dark.ok && light.ok).toBe(true);
    expect(dark.shade).toBe(0.3);
    expect(light.shade).toBeGreaterThan(dark.shade!);
    expect(light.shadeTries.slice(0, -1).every((t) => t.worst < 4.5)).toBe(true); // 앞 단계들은 실제로 모자랐다
    for (const r of [dark, light]) expect(r.contrast!.map((c) => c.slot).sort()).toEqual(['headline', 'sub']);
    for (const r of [dark, light]) expect(Math.min(...r.contrast!.map((c) => c.ratio))).toBeGreaterThanOrEqual(4.5);
  }, 60_000);

  it('가장 진하게 해도 모자라면 PNG 없이 실패(low_contrast_on_photo) — 단계를 옅은 것 하나로 줄여 재현', async () => {
    if (!ready) return;
    const db = openDb(':memory:');
    setSetting(db, 'render.photoShadeSteps', [0.1]);
    const r = await renderPhotoFrame(db, draftF, look, COVER, img('light'));
    expect(r.ok).toBe(false);
    expect(r.png).toBeNull();
    expect(r.problems.map((p) => p.code)).toContain('low_contrast_on_photo');
  }, 60_000);

  it('그림이 없으면 주색 단색 바탕으로 한 번 그린다(명암비 측정 없음 — 팔레트 규칙이 보장)', async () => {
    if (!ready) return;
    const r = await renderPhotoFrame(null, draftF, look, COVER, null);
    expect(r.ok).toBe(true);
    expect(r.shade).toBeNull();
    expect(r.contrast).toBeUndefined();
  }, 60_000);

  it('복잡한 그림(줄무늬·점)도 같은 기준으로 고른다', async () => {
    if (!ready) return;
    const r = await renderPhotoFrame(null, draftF, look, COVER, img('busy'));
    expect(r.ok).toBe(true);
    expect(Math.min(...r.contrast!.map((c) => c.ratio))).toBeGreaterThanOrEqual(4.5);
  }, 60_000);
});

describe('배지·제목·안내문은 격자 안전 영역 안 (확인됨 2026-10-18: 4:5 좌우 34px · 9:16 위아래 240px)', () => {
  it('표지·릴스 표지 모두 글 칸이 안전 영역 밖으로 나가지 않는다 — 릴스는 아래 240px 위에서 끝난다', async () => {
    if (!ready) return;
    for (const c of [COVER, REEL]) {
      const r = await renderPhotoFrame(null, draftF, look, c, img('light'));
      expect(r.problems).toEqual([]);
      expect(r.measure.slots.map((s) => s.slot).sort()).toEqual(c.kind === 'cover' ? ['chip', 'headline', 'sub'] : ['chip', 'headline']);
      for (const s of r.measure.slots) expect(s.outsideSafe).toBe(0);
      if (c.kind === 'reel_cover') expect(Math.max(...r.measure.slots.map((s) => s.text!.y + s.text!.h))).toBeLessThanOrEqual(1920 - 240);
    }
  }, 60_000);
});
