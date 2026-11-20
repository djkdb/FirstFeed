// 리틀리 채우기 (사용자 결정 2026-11-20 — 브라우저 자동 입력, 저장은 사용자). 리틀리 공개 API 를 못 찾았고 편집 화면은 로그인 뒤에만 보여서
// 화면 자리를 미리 알 수 없다 → 그 자리에서 **칸의 이름표(라벨 · 안내 글 · aria-label)** 를 읽어 맞는 칸만 채우고, 못 채운 것은 창 안에 띄운
// 「복사 · 지금 고른 칸에 넣기」 판으로 넘긴다. 앱은 「저장」을 누르지 않는다 — 사용자가 보고 저장한다
import type { BrowserContext, Page } from 'playwright';
import { BlogError, waitUntil } from './session.ts';

export interface LitlyItem {
  key: 'name' | 'bio' | 'link';
  label: string;
  value: string;
}

/** 브랜드 키트 + 발행 기록 → 채울 것. 새 문장을 짓지 않는다(키트 · 기록에 있는 값만) */
export function buildLitly(sel: { displayName: string | null; handle: string | null; bio: string | null }, tistory: string | null, posts: Array<{ title: string; url: string | null }>): LitlyItem[] {
  const out: LitlyItem[] = [];
  if (sel.displayName) out.push({ key: 'name', label: '프로필 이름', value: sel.displayName });
  if (sel.bio) out.push({ key: 'bio', label: '소개', value: sel.bio });
  if (sel.handle) out.push({ key: 'link', label: `인스타그램 @${sel.handle}`, value: `https://www.instagram.com/${sel.handle}/` });
  if (tistory) out.push({ key: 'link', label: '블로그', value: `https://${tistory}.tistory.com` });
  for (const p of posts) if (p.url) out.push({ key: 'link', label: p.title, value: p.url });
  return out;
}

/** 칸 이름표에서 찾을 말 — 리틀리 화면을 볼 수 없어 넓게 잡는다(맞는 칸이 없으면 채우지 않고 판으로) */
const FIELD_HINTS: Record<'name' | 'bio', string> = { name: '이름|닉네임|프로필\\s*명|타이틀|title|name', bio: '소개|설명|자기소개|바이오|bio|description|introduc' };

export async function fillLitly(ctx: BrowserContext, items: LitlyItem[], adminUrl: string, loginWaitMinutes: number, step: (s: string) => void, signal: AbortSignal): Promise<{ filled: string[]; panel: number }> {
  const page: Page = ctx.pages()[0] ?? (await ctx.newPage());
  step('리틀리 편집 화면을 여는 중');
  await page.goto(adminUrl, { waitUntil: 'domcontentloaded' });
  // 편집 화면 = 비밀번호 칸이 없고 글 칸이 하나 이상 보이는 화면(로그인 화면이 아님)
  const onEditor = async () =>
    !/\/login/.test(page.url()) && (await page.locator('input[type=password]').filter({ visible: true }).count()) === 0 && (await page.locator('input[type=text], input:not([type]), textarea, [contenteditable=true]').filter({ visible: true }).count()) > 0;
  if (!(await onEditor())) {
    step('열린 창에서 리틀리에 로그인해 주세요 — 편집 화면이 열리면 이어서 채워요');
    await waitUntil(page, onEditor, loginWaitMinutes, signal, '리틀리 로그인');
    if (!/admin/.test(page.url())) await page.goto(adminUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
  }
  step('이름표가 맞는 칸을 찾아 채우는 중');
  const fields = items.filter((i) => i.key !== 'link').map((i) => ({ key: i.key, value: i.value, hint: FIELD_HINTS[i.key as 'name' | 'bio'] }));
  const filled = await page.evaluate((fs) => {
    const desc = (el: HTMLElement): string => {
      const id = el.id ? (document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent ?? '') : '';
      const wrap = el.closest('label')?.textContent ?? '';
      const before = (el.parentElement?.previousElementSibling?.textContent ?? '') + ' ' + (el.previousElementSibling?.textContent ?? '');
      return [el.getAttribute('placeholder'), el.getAttribute('aria-label'), el.getAttribute('name'), el.id, id, wrap, before].join(' ').toLowerCase();
    };
    const visible = (el: HTMLElement) => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
    const set = (el: HTMLElement, v: string) => {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v);
      } else el.textContent = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const els = [...document.querySelectorAll<HTMLElement>('input[type=text], input:not([type]), textarea, [contenteditable=true]')].filter(visible);
    const used = new Set<HTMLElement>();
    const done: string[] = [];
    for (const f of fs) {
      const re = new RegExp(f.hint, 'i');
      const el = els.find((e) => !used.has(e) && re.test(desc(e)));
      if (el) {
        set(el, f.value);
        used.add(el);
        done.push(f.key);
      }
    }
    return done;
  }, fields);
  step(filled.length ? `채운 칸: ${filled.map((k) => (k === 'name' ? '프로필 이름' : '소개')).join(' · ')}` : '이름표가 맞는 칸을 못 찾았어요 — 오른쪽 아래 판에서 복사해 넣어 주세요');
  const rest = items.filter((i) => !filled.includes(i.key) || i.key === 'link');
  await injectPanel(page, rest);
  step(`나머지 ${rest.length}개는 창 오른쪽 아래 판에 — 칸을 누른 뒤 「지금 고른 칸에 넣기」 또는 「복사」. 다 보고 리틀리에서 직접 저장하세요`);
  return { filled, panel: rest.length };
}

/** 창 안에 떠 있는 판(그림자 DOM — 리틀리 화면 모양과 섞이지 않게). 마지막으로 누른 글 칸을 기억했다가 거기에 넣는다 */
async function injectPanel(page: Page, items: LitlyItem[]): Promise<void> {
  await page.evaluate((list) => {
    document.getElementById('firstfeed-panel')?.remove();
    let last: HTMLElement | null = null;
    document.addEventListener('focusin', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest?.('#firstfeed-panel')) return;
      if (t.matches('input, textarea, [contenteditable=true]')) last = t;
    });
    const host = document.createElement('div');
    host.id = 'firstfeed-panel';
    host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647';
    const root = host.attachShadow({ mode: 'open' });
    const box = document.createElement('div');
    box.setAttribute('style', 'width:320px;max-height:60vh;overflow:auto;background:#fff;color:#111;border:1px solid #ccc;border-radius:12px;padding:12px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 8px 24px rgb(0 0 0/.18)');
    box.innerHTML = '<b>FirstFeed — 넣을 것</b><div style="color:#555;margin:4px 0 8px">칸을 누른 뒤 「넣기」. 저장은 리틀리에서 직접 하세요.</div>';
    for (const it of list) {
      const row = document.createElement('div');
      row.setAttribute('style', 'border-top:1px solid #eee;padding:8px 0');
      const lab = document.createElement('div');
      lab.textContent = it.label;
      lab.setAttribute('style', 'font-weight:600');
      const val = document.createElement('div');
      val.textContent = it.value;
      val.setAttribute('style', 'color:#444;word-break:break-all;margin:2px 0 6px');
      const mk = (text: string, fn: () => void) => {
        const b = document.createElement('button');
        b.textContent = text;
        b.setAttribute('style', 'margin-right:6px;padding:4px 10px;border-radius:6px;border:1px solid #bbb;background:#f5f5f5;cursor:pointer;font:inherit');
        b.addEventListener('mousedown', (e) => e.preventDefault()); // 누르는 순간 칸에서 초점이 빠지지 않게
        b.addEventListener('click', fn);
        return b;
      };
      row.append(
        lab,
        val,
        mk('지금 고른 칸에 넣기', () => {
          const el = last;
          if (!el) return alert('먼저 리틀리에서 넣을 칸을 누르세요.');
          el.focus();
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
            Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, it.value);
          } else el.textContent = it.value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }),
        mk('복사', () => void navigator.clipboard?.writeText(it.value).catch(() => {})),
      );
      box.append(row);
    }
    root.append(box);
    document.body.append(host);
  }, items);
}

export { BlogError };
