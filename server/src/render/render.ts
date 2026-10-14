// HTML → PNG 렌더링과 넘침 측정 (FR-TP-4). 결정: CLAUDE.md 2026-10-15 · FR-TP 템플릿 계획
// - 측정은 그 PNG 를 찍는 브라우저 안에서 한다(다른 브라우저의 측정을 빌려 오지 않는다). 결과마다 브라우저·버전을 남긴다
// - 캡처 직전에 실제로 쓰인 글꼴을 확인한다(Chromium DevTools 의 CSS.getPlatformFontsForNode). 대체 글꼴이면 PNG 를 만들지 않는다
//   document.fonts.check() 는 쓰지 않는다 — 없는 글꼴에도 true 를 돌려줘서 대체 글꼴을 못 잡는다
// - 템플릿 약속: 카드 루트 [data-card], 글 칸 [data-slot="이름"](data-max-lines), 겹치면 안 되는 상자 [data-box="이름"]
//   글 칸이 들어가야 할 구역 [data-region] (높이가 정해지지 않은 칸은 구역 밖으로 나가면 넘침)
import fs from 'node:fs';
import { getSetting } from '../config.ts';
import type { Db } from '../db/index.ts';
import { getBrowser, type BrowserInfo } from './browser.ts';
import { FONT_ORIGIN, fontFileFor } from './fonts-css.ts';
import { measureInPage, type Measure, type Rect } from './measure.page.ts';

export type { Measure, Rect, SlotMeasure } from './measure.page.ts';

export interface RenderProblem {
  code: 'font_fallback' | 'text_overflow' | 'too_many_lines' | 'text_outside_card' | 'text_outside_safe' | 'text_overlap';
  slot?: string;
  message: string;
}

export interface RenderInput {
  html: string;
  width: number;
  height: number;
  /** 글이 이 사각형 밖으로 나가면 안 된다 (인스타 격자 자르기 등). 없으면 검사하지 않는다 */
  safe?: Rect | null;
  /** true 면 문제가 있어도 PNG 를 만든다 — 측정·테스트 세트 비교용. 앱에서는 쓰지 않는다 */
  captureEvenIfBad?: boolean;
}

export interface RenderResult {
  ok: boolean;
  png: Buffer | null;
  problems: RenderProblem[];
  measure: Measure;
  browser: BrowserInfo;
  /** 실제로 쓰인 글꼴 (DevTools 가 알려 준 것) */
  fontsUsed: Array<{ family: string; custom: boolean; glyphs: number }>;
}

const TOL = 1; // px — 반올림 오차

export function problemsOf(m: Measure): RenderProblem[] {
  const out: RenderProblem[] = [];
  for (const s of m.slots) {
    if (s.overflowX || s.overflowY || s.outsideSlot > TOL)
      out.push({ code: 'text_overflow', slot: s.slot, message: `칸 "${s.slot}" 의 글이 칸을 넘칩니다${s.outsideSlot > TOL ? ` (${Math.round(s.outsideSlot)}px)` : ''}.` });
    if (s.maxLines !== null && s.lines > s.maxLines)
      out.push({ code: 'too_many_lines', slot: s.slot, message: `칸 "${s.slot}" 이 ${s.lines}줄입니다 (최대 ${s.maxLines}줄).` });
    if (s.outsideCard > TOL) out.push({ code: 'text_outside_card', slot: s.slot, message: `칸 "${s.slot}" 의 글이 카드 밖으로 ${Math.round(s.outsideCard)}px 나갑니다.` });
    else if (s.outsideSafe > TOL)
      out.push({ code: 'text_outside_safe', slot: s.slot, message: `칸 "${s.slot}" 의 글이 안전 영역(인스타 격자에서 잘리는 자리) 밖으로 ${Math.round(s.outsideSafe)}px 나갑니다.` });
  }
  for (const o of m.overlaps) out.push({ code: 'text_overlap', slot: o.a, message: `"${o.a}" 와 "${o.b}" 가 겹칩니다 (${o.area}px²).` });
  return out;
}

export async function renderCard(db: Db | null, input: RenderInput): Promise<RenderResult> {
  const { browser, info } = await getBrowser(db);
  const context = await browser.newContext({ viewport: { width: input.width, height: input.height }, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    // 네트워크로 나가지 않는다: 카드 HTML 과 폰트 파일만 디스크에서 채우고 나머지 요청은 막는다
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url === `${FONT_ORIGIN}/card`) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: input.html });
      const file = fontFileFor(url);
      if (file) return route.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(file) });
      if (url.startsWith('data:')) return route.continue();
      return route.abort();
    });
    await page.goto(`${FONT_ORIGIN}/card`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    // 캡처 직전 글꼴 확인: 화면의 모든 글자가 웹폰트(앱에 넣은 OFL 폰트)로 그려졌는가
    const cdp = await context.newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'body, body *' });
    const used = new Map<string, { family: string; custom: boolean; glyphs: number }>();
    for (const nodeId of nodeIds) {
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      for (const f of fonts) {
        const prev = used.get(f.familyName);
        used.set(f.familyName, { family: f.familyName, custom: f.isCustomFont, glyphs: (prev?.glyphs ?? 0) + f.glyphCount });
      }
    }
    const emoji = new Set(getSetting(db, 'render.emojiFonts'));
    const fontsUsed = [...used.values()];
    const problems: RenderProblem[] = fontsUsed
      .filter((f) => !f.custom && f.glyphs > 0 && !emoji.has(f.family))
      .map((f) => ({ code: 'font_fallback' as const, message: `글자 ${f.glyphs}개가 앱에 넣은 폰트가 아니라 대체 글꼴 "${f.family}" 로 그려졌습니다.` }));

    const measure = await page.evaluate(measureInPage, { width: input.width, height: input.height, safe: input.safe ?? null });
    problems.push(...problemsOf(measure));
    const fontBad = problems.some((p) => p.code === 'font_fallback');
    // 반쯤 만든 결과는 저장하지 않는다: 대체 글꼴이면 측정용으로도 찍지 않는다(줄바꿈 자체가 다른 글꼴 기준이라 의미가 없다)
    const capture = !fontBad && (problems.length === 0 || input.captureEvenIfBad === true);
    const png = capture ? await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: input.width, height: input.height } }) : null;
    return { ok: problems.length === 0, png, problems, measure, browser: info, fontsUsed };
  } finally {
    await context.close();
  }
}
