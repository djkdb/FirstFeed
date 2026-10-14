// 시안 3개 × 브랜드 3개(me·doyun·seoyeon 고정 키트) × 네 틀 — 예시 원고로 그려서 넘침·겹침·대체 글꼴이 없는지 (FR-TP-1 의 핵심)
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../config.ts';
import { closeBrowser, getBrowser } from '../render/browser.ts';
import { renderCard } from '../render/render.ts';
import { accentOn, markCss } from './base.ts';
import { DRAFTS } from './index.ts';
import { textToHtml } from './text.ts';
import { FRAME_SIZE, type BrandLook, type FrameContent } from './types.ts';

const brand = (set: string, id: string): BrandLook => JSON.parse(fs.readFileSync(path.join(env.repoRoot, `tests/fixtures/${set}/brands/${id}.json`), 'utf8')).look;
const BRANDS: Record<string, BrandLook> = { me: brand('real', 'me'), doyun: brand('generated', 'doyun'), seoyeon: brand('generated', 'seoyeon') };

describe('원고 → HTML', () => {
  it('HTML 은 글자로 이스케이프하고 **강조** 와 줄바꿈만 바꾼다', () => {
    expect(textToHtml('<b>굵게</b> **설정** 5가지\n둘째 줄\n\n새 단락')).toBe('&lt;b&gt;굵게&lt;/b&gt; <span class="mk">설정</span> 5가지<br>둘째 줄<span class="br"></span>새 단락');
  });
});

describe('강조색 고르기', () => {
  it('주색이 글자색과 거의 같으면(doyun) 강조색이 없고 형광펜 띠로 — PNG 를 열어 보고 발견', () => {
    expect(accentOn(BRANDS.doyun!.palette.background, BRANDS.doyun!)).toBeNull();
    expect(markCss(BRANDS.doyun!.palette.background, BRANDS.doyun!)).toContain('linear-gradient');
    expect(accentOn(BRANDS.me!.palette.background, BRANDS.me!)).toBe('#10B981');
  });
});

let ready = false;
beforeAll(async () => {
  try {
    await getBrowser(null);
    ready = true;
  } catch (e) {
    console.warn(`[시안 렌더링 테스트 건너뜀] ${(e as Error).message}`);
  }
}, 30_000);
afterAll(() => closeBrowser());

const SAMPLE: FrameContent[] = [
  { kind: 'cover', headline: '처음 쓰는 사람을 위한\n**설정 5가지**', chip: '입문 가이드', sub: '저장해 두고 하나씩 따라 해 보세요' },
  { kind: 'body', title: '권한부터 정하세요', text: '처음엔 **읽기만** 허락하세요.\n\n쓰기는 확인한 뒤에 켜도 늦지 않아요.', page: 2, total: 7, chip: '기초' },
  { kind: 'closing', headline: '저장해 두고\n하나씩 따라 하세요' },
  { kind: 'reel_cover', headline: '설정\n**5가지**\n3분이면 끝', chip: '입문' },
];

describe('시안 × 브랜드 × 틀 — 예시 원고는 깨지지 않는다', () => {
  for (const d of DRAFTS)
    for (const [id, look] of Object.entries(BRANDS))
      it(`시안 ${d.id} · ${id}`, async () => {
        if (!ready) return;
        for (const c of SAMPLE) {
          const { width, height } = FRAME_SIZE[c.kind];
          const r = await renderCard(null, { html: d.html(look, c, 1), width, height });
          expect(r.problems.map((p) => `${c.kind}: ${p.message}`)).toEqual([]);
        }
      }, 30_000);
});

describe('넘치면 글자 크기를 단계적으로 줄이고, 그래도 넘치면 원고를 줄이라고 되돌린다 (FR-TP-4)', () => {
  it('조금 긴 제목은 줄인 크기로 통과', async () => {
    if (!ready) return;
    const { renderFrame } = await import('./render-frame.ts');
    const r = await renderFrame(null, DRAFTS[0]!, BRANDS.me!, { kind: 'cover', headline: '처음 쓰는 사람을 위한 설정을 하나씩 정리해 봤어요' });
    expect(r.ok).toBe(true);
    expect(r.scale).toBe(0.88); // 1·0.94 에서 3줄, 0.88 에서 2줄 (기준 브라우저 실측)
    expect(r.tries.at(-1)).toEqual({ scale: r.scale, problems: 0 });
  }, 30_000);

  it('많이 긴 제목은 PNG 없이 "약 N자 줄이세요"', async () => {
    if (!ready) return;
    const { renderFrame } = await import('./render-frame.ts');
    const r = await renderFrame(null, DRAFTS[0]!, BRANDS.me!, { kind: 'cover', headline: '처음 인스타그램을 시작하는 사람이 꼭 알아야 하는 계정 설정과 첫 게시물 준비 순서 완전 정리' });
    expect(r.ok).toBe(false);
    expect(r.png).toBeNull();
    expect(r.tries.map((t) => t.scale)).toEqual([1, 0.94, 0.88, 0.82]);
    expect(r.shorten[0]?.message).toMatch(/headline.*82% 까지 줄여도 넘칩니다.*약 \d+자 줄이세요/);
  }, 30_000);
});
