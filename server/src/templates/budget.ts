// 칸별 "한 줄 글자 수" 재기 (FR-MK-1: 표지 제목 2줄 이내, 한 줄 글자 수는 템플릿 기준).
// 고정할 때 그 브랜드의 실제 폰트로 잰다 — 같은 틀도 폰트가 다르면 한 줄에 들어가는 글자 수가 다르다.
// 이 숫자는 생성 프롬프트에 넘기는 안내일 뿐이고, 넘침 판정은 늘 렌더링 측정이 한다(실제 너비는 글자마다 달라서)
import type { Db } from '../db/index.ts';
import type { BrowserInfo } from '../render/browser.ts';
import { withCardPage } from '../render/render.ts';
import { FRAME_SIZE, type BrandLook, type Draft, type FrameContent, type FrameKind } from './types.ts';

export interface SlotBudget {
  charsPerLine: number;
  maxLines: number | null;
  /** 줄 수 제한이 없는 칸(본문)은 구역에 들어가는 글자 수 — 제목이 한 줄일 때 기준 */
  maxChars: number | null;
}
export type Budget = Partial<Record<FrameKind, Record<string, SlotBudget>>>;

/** 잴 때 쓰는 보통 문장 — 띄어쓰기가 있어야 keep-all 에서 줄이 바뀐다 */
const SAMPLE = '처음 쓰는 사람을 위한 설정 다섯 가지를 하나씩 정리해 봤어요 저장해 두고 따라 하면 오늘 안에 끝낼 수 있어요 '.repeat(12);

/** 모든 칸이 보이게 채운 원고 (칸 글은 측정 때 바꿔 끼운다) */
const FILLED: Record<FrameKind, FrameContent> = {
  cover: { kind: 'cover', headline: '가', sub: '가', chip: '가' },
  body: { kind: 'body', title: '가', text: '가', page: 1, total: 9, chip: '가' },
  closing: { kind: 'closing', headline: '가', sub: '가' },
  reel_cover: { kind: 'reel_cover', headline: '가', chip: '가' },
};
/** 글자 수를 잴 칸 — 배지·아이디처럼 한 낱말짜리는 빼고 원고가 들어가는 칸만 */
const MEASURED = new Set(['headline', 'sub', 'title', 'text']);

export async function measureBudget(db: Db | null, draft: Draft, look: BrandLook): Promise<{ budget: Budget; browser: BrowserInfo }> {
  const budget: Budget = {};
  let browser: BrowserInfo | null = null;
  for (const kind of Object.keys(FRAME_SIZE) as FrameKind[]) {
    const { width, height } = FRAME_SIZE[kind];
    const html = draft.html(look, FILLED[kind], 1);
    const slots = await withCardPage(db, { html, width, height }, async (page, _ctx, info) => {
      browser = info;
      return page.evaluate(
        ({ sample, measured }) => {
          const lines = (el: Element) => {
            const r = document.createRange();
            r.selectNodeContents(el);
            const tops: number[] = [];
            for (const x of r.getClientRects()) if (x.width > 0.5 && !tops.some((t) => Math.abs(t - x.top) < x.height / 2)) tops.push(x.top);
            return tops.length;
          };
          const out: Record<string, { charsPerLine: number; maxLines: number | null; maxChars: number | null }> = {};
          for (const el of document.querySelectorAll<HTMLElement>('[data-slot]')) {
            const slot = el.dataset.slot!;
            if (!measured.includes(slot)) continue;
            // 글자를 하나씩 늘려 두 번째 줄이 생기기 직전까지 (띄어쓰기는 세지 않는다)
            let fit = 0;
            for (let n = 1; n <= sample.length; n++) {
              el.textContent = sample.slice(0, n);
              if (lines(el) > 1) break;
              fit = n;
            }
            const maxLines = el.dataset.maxLines ? Number(el.dataset.maxLines) : null;
            const perLine = sample.slice(0, fit).replace(/\s/g, '').length;
            // 줄 수 제한이 없는 칸: 구역([data-region]) 아래쪽을 넘기 직전까지 (다섯 글자씩)
            let maxChars: number | null = null;
            const region = el.parentElement?.closest('[data-region]');
            if (maxLines === null && region) {
              const bottom = region.getBoundingClientRect().bottom;
              let ok = 0;
              for (let n = 5; n <= sample.length; n += 5) {
                el.textContent = sample.slice(0, n);
                const r = document.createRange();
                r.selectNodeContents(el);
                const rects = [...r.getClientRects()];
                if (rects.length && Math.max(...rects.map((x) => x.bottom)) > bottom) break;
                ok = n;
              }
              maxChars = sample.slice(0, ok).replace(/\s/g, '').length;
            }
            out[slot] = { charsPerLine: perLine, maxLines, maxChars };
          }
          return out;
        },
        { sample: SAMPLE, measured: [...MEASURED] },
      );
    });
    budget[kind] = slots;
  }
  return { budget, browser: browser! };
}
