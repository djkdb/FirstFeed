// 발행용 브라우저 창 (사용자 결정 2026-11-20). 렌더링 브라우저와 따로, 창을 띄우고(사용자가 직접 로그인해야 해서) 이 앱 전용 프로필 폴더에 로그인을 남긴다 —
// 사용자가 평소 쓰는 브라우저의 로그인 · 쿠키는 읽지 않고, 앱은 비밀번호를 받지 않는다. 브라우저는 렌더링과 같은 순서(Playwright Chromium → Chrome)로 찾고 내려받지 않는다
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { getSetting } from '../../config.ts';
import type { Db } from '../../db/index.ts';

export class BlogError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = 'BlogError';
    this.hint = hint;
  }
}

export async function openContext(db: Db | null, dataDir: string, site: string): Promise<BrowserContext> {
  const dir = path.join(dataDir, 'browser-profile', site);
  fs.mkdirSync(dir, { recursive: true });
  const headless = getSetting(db, 'blog.headless');
  let last = '';
  for (const channel of [undefined, 'chrome'] as const) {
    try {
      return await chromium.launchPersistentContext(dir, { headless, viewport: null, ...(channel ? { channel } : {}) });
    } catch (e) {
      last = String((e as Error).message ?? e);
    }
  }
  // 브라우저는 있는데 창을 띄울 화면이 없는 곳(서버 · 원격 컨테이너) — 설치하라고 하면 틀린 안내라 따로 알린다
  if (/XServer|DISPLAY|headed browser/i.test(last))
    throw new BlogError('이 컴퓨터에는 브라우저 창을 띄울 화면이 없어요.', '티스토리 · 리틀리 로그인은 창에서 직접 해야 해서, 화면이 있는 내 컴퓨터에서 앱을 켜고 다시 하세요.');
  throw new BlogError('브라우저 창을 열지 못했습니다.', '터미널에서 `npx playwright install chromium` 을 실행하거나 Google Chrome 을 설치한 뒤 다시 시도하세요. 앱은 브라우저를 직접 내려받지 않습니다.');
}

/** 사용자가 열린 창에서 로그인할 때까지 기다린다. ready 가 참이 되면 끝, 시간을 넘기거나 취소되면 BlogError */
export async function waitUntil(page: Page, ready: () => Promise<boolean>, minutes: number, signal: AbortSignal, what: string): Promise<void> {
  const until = Date.now() + minutes * 60_000;
  while (Date.now() < until) {
    if (signal.aborted) throw new BlogError('취소했어요.', '');
    if (page.isClosed()) throw new BlogError('브라우저 창이 닫혔어요.', '다시 시작하고, 로그인이 끝날 때까지 창을 열어 두세요.');
    if (await ready().catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new BlogError(`${minutes}분 동안 ${what}를 기다렸지만 끝나지 않았어요.`, '다시 시작한 뒤 열린 창에서 로그인해 주세요. 로그인은 이 앱 전용 창에 남아서 다음부터는 바로 넘어가요.');
}

/** 여러 후보 자리 중 처음 보이는 것 */
export async function firstVisible(page: Page, selectors: readonly string[], timeoutMs: number): Promise<ReturnType<Page['locator']> | null> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    for (const s of selectors) {
      const l = page.locator(s).filter({ visible: true }).first();
      if (await l.count().catch(() => 0)) return l;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}
