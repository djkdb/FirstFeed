// 티스토리 완전 자동 발행 (사용자 결정 2026-11-20). 열린 창에서 사용자가 로그인하면 → 제목 · 카드 그림 · 글 · 태그를 넣고 → 공개 범위를 골라 발행 → RSS 에서 글 주소를 찾는다.
// 화면 자리는 selectors.ts 한 곳. 각 단계에서 자리를 못 찾으면 어디서 멈췄는지와 다음 할 일을 알리고 그만둔다(반쯤 채운 글은 티스토리 임시 저장에 남을 수 있다 — 안내에 적는다)
import type { BrowserContext, Page } from 'playwright';
import type { BlogPost } from './post.ts';
import { TISTORY } from './selectors.ts';
import { BlogError, firstVisible, waitUntil } from './session.ts';

export interface TistoryTarget {
  blog: string;
  visibility: 'public' | 'private';
  loginWaitMinutes: number;
  /** 테스트에서 바꾸는 주소 · RSS 읽기 */
  newPostUrl?: string;
  isPostsUrl?: (u: URL) => boolean;
  fetchRss?: () => Promise<string>;
}

const stop = (where: string) =>
  new BlogError(
    `티스토리 글쓰기 화면에서 「${where}」 자리를 찾지 못해 멈췄어요.`,
    '티스토리 화면이 바뀌었을 수 있어요. 열린 창에서 직접 마무리하거나, 앱을 최신으로 받은 뒤 다시 하세요. 채우던 글은 티스토리 임시 저장에 남아 있을 수 있어요.',
  );

export async function publishTistory(ctx: BrowserContext, post: BlogPost, t: TistoryTarget, step: (s: string) => void, signal: AbortSignal): Promise<{ url: string | null }> {
  const page: Page = ctx.pages()[0] ?? (await ctx.newPage());
  // 임시 저장 글을 이어 쓸지 묻는 창은 「아니오」 — 다른 글이 섞이지 않게. 그 밖의 확인 창은 「확인」
  page.on('dialog', (d) => {
    step(`티스토리 확인 창: ${d.message().slice(0, 60)}`);
    void (/이어서|저장된|임시/.test(d.message()) ? d.dismiss() : d.accept()).catch(() => {});
  });
  const newPost = t.newPostUrl ?? TISTORY.newPost(t.blog);
  step('티스토리 글쓰기 화면을 여는 중');
  await page.goto(newPost, { waitUntil: 'domcontentloaded' });
  const onEditor = async () => (await page.locator(TISTORY.title).filter({ visible: true }).count()) > 0;
  if (!(await onEditor())) {
    step('열린 창에서 티스토리(카카오)에 로그인해 주세요 — 로그인하면 이어서 진행해요');
    let lastNav = Date.now();
    await waitUntil(
      page,
      async () => {
        if (await onEditor()) return true;
        // 로그인을 마치고 블로그 주소로 돌아왔는데 글쓰기가 아니면 글쓰기로 다시 보낸다(5초에 한 번까지).
        // 로그인 화면은 다른 주소(티스토리 · 카카오 계정)라 사용자가 입력하는 중에는 건드리지 않는다
        if (new URL(page.url()).host === new URL(newPost).host && Date.now() - lastNav > 5000) {
          lastNav = Date.now();
          await page.goto(newPost, { waitUntil: 'domcontentloaded' });
        }
        return false;
      },
      t.loginWaitMinutes,
      signal,
      '로그인',
    );
  }
  step('제목 넣는 중');
  await page.locator(TISTORY.title).fill(post.title);
  const ready = await page.waitForFunction(() => (window as unknown as { tinymce?: { activeEditor?: { initialized?: boolean } } }).tinymce?.activeEditor?.initialized === true, null, { timeout: 20_000 }).catch(() => null);
  if (!ready) throw stop('본문 편집기');
  const imgCount = () => page.evaluate(() => (window as unknown as { tinymce: { activeEditor: { getBody(): HTMLElement } } }).tinymce.activeEditor.getBody().querySelectorAll('img').length);
  for (const [i, file] of post.images.entries()) {
    if (signal.aborted) throw new BlogError('취소했어요.', '');
    step(`카드 그림 올리는 중 (${i + 1}/${post.images.length})`);
    const before = await imgCount();
    const button = await firstVisible(page, TISTORY.attachButton, 10_000);
    if (!button) throw stop('사진 첨부 단추');
    let chooserP = page.waitForEvent('filechooser', { timeout: 2000 }).catch(() => null);
    await button.click();
    let chooser = await chooserP;
    if (!chooser) {
      const item = await firstVisible(page, TISTORY.attachImageItem, 5000);
      if (!item) throw stop('사진 메뉴');
      chooserP = page.waitForEvent('filechooser', { timeout: 10_000 }).catch(() => null);
      await item.click();
      chooser = await chooserP;
    }
    if (!chooser) throw stop('파일 고르기 창');
    await chooser.setFiles(file);
    const up = await page.waitForFunction((n) => (window as unknown as { tinymce: { activeEditor: { getBody(): HTMLElement } } }).tinymce.activeEditor.getBody().querySelectorAll('img').length > n, before, { timeout: 60_000 }).catch(() => null);
    if (!up) throw new BlogError(`카드 그림 ${i + 1}장째가 올라가지 않았어요.`, '인터넷 연결을 확인하고 다시 하세요. 채우던 글은 티스토리 임시 저장에 남아 있을 수 있어요.');
  }
  step('글 넣는 중');
  await page.evaluate((html) => {
    const ed = (window as unknown as { tinymce: { activeEditor: { getBody(): HTMLElement; selection: { select(n: Node, c?: boolean): void; collapse(start?: boolean): void }; insertContent(h: string): void; fire?(e: string): void } } }).tinymce.activeEditor;
    ed.selection.select(ed.getBody(), true);
    ed.selection.collapse(false);
    ed.insertContent(html);
    ed.fire?.('change');
  }, post.html);
  if (post.tags.length) {
    step(`태그 넣는 중 (${post.tags.length}개)`);
    const tag = page.locator(TISTORY.tag);
    if (!(await tag.count())) throw stop('태그 칸');
    for (const t2 of post.tags) {
      await tag.fill(t2);
      await tag.press('Enter');
    }
  }
  step(`발행 중 (${t.visibility === 'public' ? '공개' : '비공개'})`);
  const done = await firstVisible(page, [TISTORY.done], 10_000);
  if (!done) throw stop('완료 단추');
  await done.click();
  const vis = await firstVisible(page, [TISTORY.visibility[t.visibility]], 10_000);
  if (!vis) throw stop('공개 범위');
  await vis.click();
  const pub = await firstVisible(page, [TISTORY.publish], 10_000);
  if (!pub) throw stop('발행 단추');
  await pub.click();
  const isPosts = t.isPostsUrl ?? ((u: URL) => u.hostname === `${t.blog}.tistory.com` && TISTORY.postsPath.test(u.pathname));
  const moved = await page.waitForURL((u) => isPosts(u), { timeout: 60_000 }).then(() => true).catch(() => false);
  if (!moved) throw new BlogError('발행 단추를 눌렀지만 글 목록으로 넘어가지 않았어요.', '열린 창에서 발행됐는지 확인해 주세요. 안 됐으면 창에서 직접 「발행」을 누르면 돼요.');
  step('발행했어요 — 글 주소 찾는 중');
  // RSS 는 조금 늦게 바뀔 수 있어 몇 번 더 본다(못 찾으면 주소는 모름)
  const fetchRss = t.fetchRss ?? (() => fetch(TISTORY.rss(t.blog)).then((r) => r.text()));
  const { findPostUrl } = await import('./post.ts');
  for (let i = 0; i < 4; i++) {
    const url = await fetchRss().then((x) => findPostUrl(x, post.title)).catch(() => null);
    if (url) return { url };
    if (t.visibility === 'private') break; // 비공개 글은 RSS 에 안 나온다
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { url: null };
}
