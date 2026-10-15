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

describe('렌더링 직전 글 다듬기 — 실제로 그려서 줄바꿈 위치 확인 (측정에서 나온 C·doyun c06)', () => {
  it('「·」 는 앞뒤 글자와 같은 줄, 「3분 20초」 는 한 줄', async () => {
    if (!ready) return;
    const { withCardPage } = await import('../render/render.ts');
    const html = DRAFTS[2]!.html(BRANDS.doyun!, { kind: 'cover', headline: '1,500명 · 87% · 3단계', sub: '2026.10.15 · 24시간 · 10,000원 · v1.64.0 · 3분 20초' }, 1);
    const lines = await withCardPage(null, { html, width: 1080, height: 1350 }, (page) =>
      page.evaluate(() => {
        // 칸마다 글자별 줄(세로 위치)을 모아 줄 단위 글로
        return [...document.querySelectorAll('[data-slot="headline"],[data-slot="sub"]')].map((el) => {
          const out: Array<{ top: number; text: string }> = [];
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode())
            for (let i = 0; i < n.textContent!.length; i++) {
              const r = document.createRange();
              r.setStart(n, i);
              r.setEnd(n, i + 1);
              const rect = r.getBoundingClientRect();
              if (rect.width === 0) continue;
              const line = out.find((l) => Math.abs(l.top - rect.top) < rect.height / 2) ?? (out.push({ top: rect.top, text: '' }), out.at(-1)!);
              line.text += n.textContent![i];
            }
          return out.map((l) => l.text.replace(/\u00A0/g, ' ').trim());
        });
      }),
    );
    for (const slot of lines) for (const l of slot) expect(l.startsWith('·') || l.endsWith('·')).toBe(false);
    expect(lines.flat().some((l) => l.includes('3분 20초'))).toBe(true);
  }, 30_000);

  it('「88%까지」 는 「%」 뒤에서 갈리지 않고, 단어 이음표가 대체 글꼴로 잡히지 않는다 (카드 재측정 C·doyun c05)', async () => {
    if (!ready) return;
    const content: FrameContent = {
      kind: 'body',
      title: '72%에서\n88%까지',
      text: '항목을 맞게 나누는 비율은 처음에 72%였어요.\n\n자주 틀리는 항목 30개를 따로 정리해서 넣었더니 **88%까지** 올랐어요.',
      page: 5,
      total: 8,
      chip: '기능 제작기',
    };
    const r = await renderCard(null, { html: DRAFTS[2]!.html(BRANDS.doyun!, content, 1), width: FRAME_SIZE.body.width, height: FRAME_SIZE.body.height });
    expect(r.problems).toEqual([]);
    const { withCardPage } = await import('../render/render.ts');
    const lines = await withCardPage(null, { html: DRAFTS[2]!.html(BRANDS.doyun!, content, 1), width: FRAME_SIZE.body.width, height: FRAME_SIZE.body.height }, (page) =>
      page.evaluate(() => {
        const out: Array<{ top: number; text: string }> = [];
        const el = document.querySelector('[data-slot="text"]')!;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode())
          for (let i = 0; i < n.textContent!.length; i++) {
            const r = document.createRange();
            r.setStart(n, i);
            r.setEnd(n, i + 1);
            const rect = r.getBoundingClientRect();
            if (rect.width === 0) continue;
            const line = out.find((l) => Math.abs(l.top - rect.top) < rect.height / 2) ?? (out.push({ top: rect.top, text: '' }), out.at(-1)!);
            line.text += n.textContent![i];
          }
        return out.map((l) => l.text.trim());
      }),
    );
    expect(lines.some((l) => l.endsWith('%'))).toBe(false);
  }, 30_000);
});

