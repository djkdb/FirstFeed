// 렌더링 브라우저 준비 (결정 2026-10-15 · FR-TP).
// 순서: Playwright Chromium(버전이 playwright 패키지에 고정 — 판정 기준 브라우저) → 설치된 Google Chrome → 없으면 설치 명령만 안내.
// 앱은 브라우저를 내려받지 않는다(「브라우저 자동 설치는 F」).
import { chromium, type Browser } from 'playwright';
import { getSetting } from '../config.ts';
import type { Db } from '../db/index.ts';

export type BrowserKind = 'playwright-chromium' | 'chrome';
export interface BrowserInfo {
  kind: BrowserKind;
  version: string;
  /** 넘침 판정의 기준 브라우저인가 — 아니면 결과에 "기준 브라우저 아님"을 표시한다 */
  reference: boolean;
}

export class RenderError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = 'RenderError';
    this.hint = hint;
  }
}

const INSTALL_HINT = '터미널에서 `npx playwright install chromium` 을 실행하거나 Google Chrome 을 설치한 뒤 다시 시도하세요. 앱은 브라우저를 직접 내려받지 않습니다.';

async function tryLaunch(kind: BrowserKind): Promise<Browser | null> {
  try {
    return kind === 'chrome' ? await chromium.launch({ channel: 'chrome' }) : await chromium.launch();
  } catch {
    return null;
  }
}

let cached: { browser: Browser; info: BrowserInfo } | null = null;

/** 브라우저 하나를 열어 두고 돌려 쓴다 (카드 한 장마다 띄우면 장당 1초가 더 든다) */
export async function getBrowser(db: Db | null): Promise<{ browser: Browser; info: BrowserInfo }> {
  if (cached?.browser.isConnected()) return cached;
  const pref = getSetting(db, 'render.browser');
  const order: BrowserKind[] = pref === 'chromium' ? ['playwright-chromium'] : pref === 'chrome' ? ['chrome'] : ['playwright-chromium', 'chrome'];
  for (const kind of order) {
    const browser = await tryLaunch(kind);
    if (browser) {
      cached = { browser, info: { kind, version: browser.version(), reference: kind === 'playwright-chromium' } };
      return cached;
    }
  }
  throw new RenderError(
    pref === 'auto' ? '카드를 그릴 브라우저를 찾지 못했습니다 (Playwright Chromium·Google Chrome 모두 없음).' : `설정한 브라우저(${pref})를 열지 못했습니다.`,
    INSTALL_HINT,
  );
}

export async function closeBrowser(): Promise<void> {
  const b = cached?.browser;
  cached = null;
  await b?.close();
}
