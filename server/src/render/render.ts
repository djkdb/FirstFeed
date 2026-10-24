// HTML → PNG 렌더링과 넘침 측정 (FR-TP-4). 결정: CLAUDE.md 2026-10-15 · FR-TP 템플릿 계획
// - 측정은 그 PNG 를 찍는 브라우저 안에서 한다(다른 브라우저의 측정을 빌려 오지 않는다). 결과마다 브라우저·버전을 남긴다
// - 캡처 직전에 실제로 쓰인 글꼴을 확인한다(Chromium DevTools 의 CSS.getPlatformFontsForNode). 대체 글꼴이면 PNG 를 만들지 않는다
//   document.fonts.check() 는 쓰지 않는다 — 없는 글꼴에도 true 를 돌려줘서 대체 글꼴을 못 잡는다
// - 템플릿 약속: 카드 루트 [data-card], 글 칸 [data-slot="이름"](data-max-lines), 겹치면 안 되는 상자 [data-box="이름"]
//   글 칸이 들어가야 할 구역 [data-region] (높이가 정해지지 않은 칸은 구역 밖으로 나가면 넘침)
import fs from 'node:fs';
import { getSetting } from '../config.ts';
import type { Db } from '../db/index.ts';
import type { BrowserContext, Page } from 'playwright';
import { getBrowser, RenderError, type BrowserInfo } from './browser.ts';
import { FONT_ORIGIN, fontFileFor } from './fonts-css.ts';
import { measureInPage, type Measure, type Rect } from './measure.page.ts';
import { collectPhotoSlots, contrastInPage, type SlotContrast } from './contrast.page.ts';

export type { Measure, Rect, SlotMeasure } from './measure.page.ts';
export type { SlotContrast } from './contrast.page.ts';

export interface RenderProblem {
  code: 'font_fallback' | 'text_overflow' | 'too_many_lines' | 'text_outside_card' | 'text_outside_safe' | 'text_overlap' | 'low_contrast_on_photo';
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
  /** 그림 위 글 칸([data-on-photo])의 글자 뒤 명암비를 잰다(그림 바탕 시안). 판정은 부르는 쪽이 한다 */
  measureContrast?: boolean;
  /**
   * true 면 대체 글꼴이 있어도 찍는다(문제 목록에는 그대로 남는다). 카드는 쓰지 않는다 — 공유 이미지(preview/share-image.ts)처럼
   * 사용자가 쓴 기호를 앱 글꼴에 없어도 그대로 보여야 하는 그림만
   */
  allowFontFallback?: boolean;
}

export interface RenderResult {
  ok: boolean;
  png: Buffer | null;
  problems: RenderProblem[];
  measure: Measure;
  browser: BrowserInfo;
  /** 실제로 쓰인 글꼴 (DevTools 가 알려 준 것) */
  fontsUsed: Array<{ family: string; custom: boolean; glyphs: number }>;
  /** measureContrast 일 때만: 그림 위 글 칸마다 글자 뒤 명암비 */
  contrast?: SlotContrast[];
  /** 막은 요청 주소 — 카드 HTML 과 폰트 파일 말고는 네트워크로 내보내지 않는다(오프라인 동작 FR-AC-1 을 테스트로 확인하려고 남김) */
  blockedRequests: string[];
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

/** 카드 HTML 을 연 페이지에서 일을 한다 (렌더링·글자 수 측정이 같이 쓴다). 폰트가 다 불러와진 뒤에 fn 을 부른다 */
export async function withCardPage<T>(
  db: Db | null,
  input: { html: string; width: number; height: number },
  fn: (page: Page, context: BrowserContext, info: BrowserInfo, blockedRequests: string[]) => Promise<T>,
): Promise<T> {
  const { browser, info } = await getBrowser(db);
  const context = await browser.newContext({ viewport: { width: input.width, height: input.height }, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    // tsx(esbuild keepNames)로 돌 때는 함수 안에 __name(...) 도우미가 끼어 들어가는데, page.evaluate 로 브라우저에 넘긴
    // 함수에는 그 도우미가 없어 ReferenceError 가 난다 — 개발 서버(npm run dev)에서만 실제로 겪음(테스트·node 실행은 안 끼움)
    await page.addInitScript('globalThis.__name = globalThis.__name || ((f) => f);');
    // 네트워크로 나가지 않는다: 카드 HTML 과 폰트 파일만 디스크에서 채우고 나머지 요청은 막는다
    const blockedRequests: string[] = [];
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url === `${FONT_ORIGIN}/card`) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: input.html });
      const file = fontFileFor(url);
      if (file) return route.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(file) });
      if (url.startsWith('data:')) return route.continue();
      blockedRequests.push(url);
      return route.abort();
    });
    // 멈춘 채로 기다리지 않게 단계마다 시간 제한 — 어디서 멈췄는지가 오류 문구에 남는다
    const step = async <T>(what: string, ms: number, p: Promise<T>): Promise<T> => {
      let timer: NodeJS.Timeout | undefined;
      try {
        return await Promise.race([
          p,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new RenderError(`카드를 그리다 「${what}」에서 ${ms / 1000}초 넘게 멈췄습니다.`, '다시 시도하세요. 반복되면 렌더링 기록과 함께 알려 주세요.')), ms);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    };
    await step('페이지 열기', 15_000, page.goto(`${FONT_ORIGIN}/card`, { waitUntil: 'load', timeout: 15_000 }));
    await step('폰트 불러오기', 15_000, page.evaluate(() => document.fonts.ready.then(() => undefined)));
    return await step('측정·캡처', 20_000, fn(page, context, info, blockedRequests));
  } finally {
    await context.close();
  }
}

export async function renderCard(db: Db | null, input: RenderInput): Promise<RenderResult> {
  return withCardPage(db, input, async (page, context, info, blockedRequests) => {

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
    let contrast: SlotContrast[] | undefined;
    if (input.measureContrast) {
      // 글자만 투명하게 하고(배치는 그대로) 찍은 화면에서 글자 뒤 화소를 잰 뒤, 되돌리고 진짜 화면을 찍는다
      const slots = await page.evaluate(collectPhotoSlots);
      const hide = await page.addStyleTag({ content: '[data-on-photo],[data-on-photo] *{color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important}' });
      const bare = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: input.width, height: input.height } });
      await hide.evaluate((el) => (el as Element).remove());
      contrast = await page.evaluate(contrastInPage, { png: bare.toString('base64'), slots, q: getSetting(db, 'render.photoContrastQuantile') });
    }
    const fontBad = problems.some((p) => p.code === 'font_fallback');
    // 반쯤 만든 결과는 저장하지 않는다: 대체 글꼴이면 측정용으로도 찍지 않는다(줄바꿈 자체가 다른 글꼴 기준이라 의미가 없다)
    const capture = (!fontBad || input.allowFontFallback === true) && (problems.length === 0 || input.captureEvenIfBad === true);
    const png = capture ? await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: input.width, height: input.height } }) : null;
    return { ok: problems.length === 0, png, problems, measure, browser: info, fontsUsed, blockedRequests, ...(contrast ? { contrast } : {}) };
  });
}
