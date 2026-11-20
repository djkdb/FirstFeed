// 티스토리 · 리틀리 브라우저 흐름 — 진짜 사이트 대신, selectors.ts 에 적은 자리를 흉내 낸 가짜 페이지로(로컬 http).
// 이 테스트가 확인하는 것은 **우리 흐름**(로그인 기다리기 · 그림 차례 · 글 · 태그 · 공개 범위 · 발행 뒤 주소 찾기 · 이름표로 칸 찾기)이지 실제 티스토리 · 리틀리 화면이 아니다
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setSetting } from '../../config.ts';
import { openDb } from '../../db/index.ts';
import { fillLitly } from './litly.ts';
import { openContext } from './session.ts';
import { publishTistory } from './tistory.ts';

const TISTORY_PAGE = `<!doctype html><meta charset="utf-8"><body>
<textarea id="post-title-inp"></textarea>
<div class="mce-edit-area"><div id="ed" contenteditable="true"></div></div>
<button id="mceu_0-open">첨부</button><div id="menu" hidden><span id="attach-image-text">사진</span></div>
<input id="file" type="file" hidden>
<input id="tagText"><div id="tags"></div>
<button id="publish-layer-btn">완료</button>
<div id="layer" hidden><input type="radio" name="v" id="open20"><input type="radio" name="v" id="open0"><button id="publish-btn">발행</button></div>
<script>
const ed = document.getElementById('ed');
window.tinymce = { activeEditor: { initialized: true, getBody: () => ed, selection: { select() {}, collapse() {} }, insertContent: (h) => ed.insertAdjacentHTML('beforeend', h), fire() {} } };
document.getElementById('mceu_0-open').onclick = () => (document.getElementById('menu').hidden = false);
document.getElementById('attach-image-text').onclick = () => document.getElementById('file').click();
document.getElementById('file').onchange = (e) => { const f = e.target.files[0]; setTimeout(() => { ed.insertAdjacentHTML('beforeend', '<img alt="' + f.name + '">'); document.getElementById('menu').hidden = true; }, 50); };
document.getElementById('tagText').onkeydown = (e) => { if (e.key === 'Enter') { document.getElementById('tags').insertAdjacentHTML('beforeend', '<i>' + e.target.value + '</i>'); e.target.value = ''; } };
document.getElementById('publish-layer-btn').onclick = () => (document.getElementById('layer').hidden = false);
document.getElementById('publish-btn').onclick = () => {
  window.__published = { title: document.getElementById('post-title-inp').value, imgs: [...ed.querySelectorAll('img')].map((i) => i.alt), html: ed.innerHTML, tags: [...document.querySelectorAll('#tags i')].map((i) => i.textContent), pub: document.getElementById('open20').checked, priv: document.getElementById('open0').checked };
  fetch('/record', { method: 'POST', body: JSON.stringify(window.__published) }).then(() => (location.href = '/manage/posts/'));
};
</script>`;
const LITLY_PAGE = `<!doctype html><meta charset="utf-8"><body>
<label>프로필 이름 <input id="n"></label>
<textarea aria-label="소개글" id="b"></textarea>
<div><span>링크 주소</span></div><input id="u">
<button id="save">저장</button><script>document.getElementById('save').onclick = () => (window.__saved = true);</script>`;

let server: http.Server;
let base = '';
let loggedIn = false;
let recorded: Record<string, unknown> | null = null;
beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/record') {
      let b = '';
      req.on('data', (d) => (b += d));
      req.on('end', () => ((recorded = JSON.parse(b)), res.end('ok')));
      return;
    }
    if (req.url?.startsWith('/manage/newpost')) {
      if (!loggedIn) return res.writeHead(302, { location: '/login' }).end();
      return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(TISTORY_PAGE);
    }
    if (req.url?.startsWith('/login')) return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end('<input type="password"><button>로그인</button>');
    if (req.url?.startsWith('/admin')) return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(LITLY_PAGE);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end('<p>목록</p>');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

function testDb() {
  const db = openDb(':memory:');
  setSetting(db, 'blog.headless', true);
  return db;
}

describe('티스토리 자동 발행 흐름(가짜 페이지)', () => {
  it('로그인을 기다렸다가 제목 · 그림 차례 · 글 · 태그 · 공개 범위를 넣고 발행, RSS 에서 주소를 찾는다', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-blog-'));
    const imgs = ['01-cover.png', '02-body.png', '03-closing.png'].map((n) => (fs.writeFileSync(path.join(dir, n), 'x'), path.join(dir, n)));
    const ctx = await openContext(testDb(), dir, 'tistory');
    const steps: string[] = [];
    // 사용자가 2초 뒤 로그인한 것처럼
    setTimeout(() => (loggedIn = true), 2000);
    const r = await publishTistory(
      ctx,
      { title: '암벽화 사기 전 5가지만 보세요', html: '<p>첫 줄</p><h3>사이즈</h3>', tags: ['암벽화', '클라이밍'], images: imgs },
      {
        blog: 'test',
        visibility: 'public',
        loginWaitMinutes: 1,
        newPostUrl: `${base}/manage/newpost/`,
        isPostsUrl: (u) => u.pathname === '/manage/posts/',
        fetchRss: async () => '<item><title>암벽화 사기 전 5가지만 보세요</title><link>https://test.tistory.com/7</link></item>',
      },
      (s) => steps.push(s),
      new AbortController().signal,
    );
    await ctx.close();
    expect(r.url).toBe('https://test.tistory.com/7');
    expect(recorded).toMatchObject({ title: '암벽화 사기 전 5가지만 보세요', imgs: ['01-cover.png', '02-body.png', '03-closing.png'], tags: ['암벽화', '클라이밍'], pub: true, priv: false });
    expect(String(recorded!.html)).toMatch(/<img[^>]*>.*<img[^>]*>.*<img[^>]*>.*<p>첫 줄<\/p>/s);
    expect(steps.some((s) => s.includes('로그인해 주세요'))).toBe(true);
    expect(steps).toContain('카드 그림 올리는 중 (3/3)');
  }, 60_000);

  it('화면에 자리가 없으면 어디서 멈췄는지 알린다', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-blog-'));
    const ctx = await openContext(testDb(), dir, 'tistory');
    const p = publishTistory(ctx, { title: 't', html: '', tags: [], images: [] }, { blog: 'test', visibility: 'private', loginWaitMinutes: 0.05, newPostUrl: `${base}/nothing` }, () => {}, new AbortController().signal);
    await expect(p).rejects.toThrow(/분 동안 로그인/);
    await ctx.close();
  }, 30_000);
});

describe('리틀리 채우기 흐름(가짜 페이지)', () => {
  it('이름표가 맞는 칸만 채우고, 나머지는 판에 — 저장은 누르지 않는다', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-litly-'));
    const ctx = await openContext(testDb(), dir, 'litly');
    const items = [
      { key: 'name' as const, label: '프로필 이름', value: '일단 발!' },
      { key: 'bio' as const, label: '소개', value: '바이오 글' },
      { key: 'link' as const, label: '인스타그램 @x', value: 'https://www.instagram.com/x/' },
    ];
    const r = await fillLitly(ctx, items, `${base}/admin`, 1, () => {}, new AbortController().signal);
    const page = ctx.pages()[0]!;
    expect(r.filled.sort()).toEqual(['bio', 'name']);
    expect(await page.inputValue('#n')).toBe('일단 발!');
    expect(await page.inputValue('#b')).toBe('바이오 글');
    expect(await page.inputValue('#u')).toBe('');
    // 판의 「지금 고른 칸에 넣기」: 주소 칸을 누른 뒤
    await page.click('#u');
    await page.locator('#firstfeed-panel').locator('button', { hasText: '지금 고른 칸에 넣기' }).first().click();
    expect(await page.inputValue('#u')).toBe('https://www.instagram.com/x/');
    expect(await page.evaluate(() => (window as unknown as { __saved?: boolean }).__saved ?? false)).toBe(false);
    await ctx.close();
  }, 60_000);
});
