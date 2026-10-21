// 렌더링·측정 통합 테스트 — 실제 브라우저(기준: Playwright Chromium)로 그린다.
// 브라우저가 없으면 건너뛰고 이유를 남긴다(설치: npx playwright install chromium)
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../config.ts';
import { closeBrowser, getBrowser, type BrowserInfo } from './browser.ts';
import { fontFaceCss } from './fonts-css.ts';
import { renderCard } from './render.ts';

let info: BrowserInfo | null = null;
beforeAll(async () => {
  try {
    info = (await getBrowser(null)).info;
  } catch (e) {
    console.warn(`[렌더링 테스트 건너뜀] ${(e as Error).message}`);
  }
}, 30_000);
afterAll(() => closeBrowser());

const W = 1080;
const H = 1350;
const page = (inner: string, css = '') => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
${fontFaceCss(['pretendard'])}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px}
body{font-family:'Pretendard';word-break:keep-all;background:#111;color:#fff}
[data-card]{position:relative;width:${W}px;height:${H}px;overflow:hidden}
.t{position:absolute;left:80px;width:920px;font-size:80px;line-height:1.2;font-weight:700}
${css}
</style></head><body><div data-card>${inner}</div></body></html>`;
const codes = (r: { problems: Array<{ code: string; slot?: string }> }) => r.problems.map((p) => `${p.slot ?? ''}:${p.code}`);
const pngSize = (b: Buffer) => [b.readUInt32BE(16), b.readUInt32BE(20)];

describe('HTML → PNG 렌더링과 넘침 측정', () => {
  it('맞는 글은 통과하고, PNG 크기와 찍은 브라우저·버전이 남는다', async () => {
    if (!info) return;
    const r = await renderCard(null, { html: page('<h1 class="t" style="top:100px" data-slot="title" data-max-lines="2">짧은 제목</h1>'), width: W, height: H });
    expect(codes(r)).toEqual([]);
    expect(pngSize(r.png!)).toEqual([W, H]);
    expect(r.browser).toMatchObject({ kind: 'playwright-chromium', reference: true });
    expect(r.browser.version).toMatch(/^\d+\./);
    expect(r.fontsUsed.every((f) => f.custom)).toBe(true);
  });

  it('줄 간격을 좁힌 제목(고운바탕 line-height 1.06)은 글자 상자가 줄 상자보다 커도 넘침이 아니다 — 처음 측정에서 7~25px 거짓 넘침', async () => {
    if (!info) return;
    const html = page('<h1 class="t" style="top:300px;font-family:\'Gowun Batang\';line-height:1.06;font-size:124px" data-slot="title" data-max-lines="3">설정<br>5가지<br>3분이면 끝</h1>').replace(
      '</style>',
      `${fontFaceCss(['gowun-batang'])}</style>`,
    );
    const r = await renderCard(null, { html, width: W, height: H });
    expect(codes(r)).toEqual([]);
  });

  it('최대 줄 수를 넘으면 too_many_lines', async () => {
    if (!info) return;
    const r = await renderCard(null, {
      html: page('<h1 class="t" style="top:100px" data-slot="title" data-max-lines="2">처음 시작하는 사람을 위한 인스타 계정 만들기 세 번째 이야기</h1>'),
      width: W,
      height: H,
    });
    expect(codes(r)).toEqual(['title:too_many_lines']);
    expect(r.png).toBeNull(); // 앱 기본: 문제가 있으면 PNG 를 만들지 않는다
  });

  it('높이가 정해진 칸을 넘치면 text_overflow (overflow:hidden 으로 잘려 보이지 않아도)', async () => {
    if (!info) return;
    const r = await renderCard(null, {
      html: page('<p class="t" style="top:100px;height:200px;overflow:hidden;font-size:48px" data-slot="body">' + '본문이 길어서 칸을 넘칩니다. '.repeat(12) + '</p>'),
      width: W,
      height: H,
    });
    expect(codes(r)).toContain('body:text_overflow');
  });

  it('띄어쓰기 없는 긴 한글 낱말·끊을 자리 없는 긴 영문 이름은 keep-all 에서 가로로 넘친다', async () => {
    if (!info) return;
    const r = await renderCard(null, {
      html: page(
        '<h1 class="t" style="top:100px" data-slot="title">초거대언어모델기반자동화워크플로우설계방법론정리</h1><p class="t" style="top:600px;font-size:40px" data-slot="name">ClaudeCodeSubscriptionAuthenticationVerificationReport</p>',
      ),
      width: W,
      height: H,
    });
    expect(codes(r)).toEqual(expect.arrayContaining(['title:text_outside_card', 'name:text_outside_card']));
  });

  it('긴 URL 은 / 에서 줄이 바뀌어 넘치지 않는다 (처음 예상과 다름 — 줄 수로만 잡힌다)', async () => {
    if (!info) return;
    const r = await renderCard(null, {
      html: page('<p class="t" style="top:600px;font-size:40px" data-slot="url" data-max-lines="1">https://github.com/firstfeed/very-long-repository-name-for-testing-overflow</p>'),
      width: W,
      height: H,
    });
    expect(codes(r)).toEqual(['url:too_many_lines']);
  });

  it('앱에 넣지 않은 글꼴로 그려지면 font_fallback — 측정용으로도 PNG 를 만들지 않는다', async () => {
    if (!info) return;
    const r = await renderCard(null, {
      html: page('<h1 class="t" style="top:100px;font-family:NoSuchFont,sans-serif" data-slot="title">대체 글꼴</h1>'),
      width: W,
      height: H,
      captureEvenIfBad: true,
    });
    expect(codes(r)).toContain(':font_fallback');
    expect(r.png).toBeNull();
  });

  it('이모지는 OS 이모지 글꼴로 그려져도 실패가 아니다 (설정 render.emojiFonts)', async () => {
    if (!info) return;
    const r = await renderCard(null, { html: page('<h1 class="t" style="top:100px" data-slot="title">시작 🚀</h1>'), width: W, height: H });
    expect(codes(r)).toEqual([]);
  });

  it('글 칸끼리·로고 상자와 겹치면 text_overlap, 안전 영역 밖이면 text_outside_safe', async () => {
    if (!info) return;
    const r = await renderCard(null, {
      html: page(
        '<h1 class="t" style="top:100px" data-slot="title">제목</h1><p class="t" style="top:130px;font-size:40px" data-slot="sub">겹치는 줄</p><div data-box="logo" style="position:absolute;left:80px;top:1200px;width:200px;height:80px"></div><p class="t" style="top:1210px;font-size:40px" data-slot="foot">로고와 겹침</p>',
      ),
      width: W,
      height: H,
      safe: { x: 120, y: 0, w: 840, h: H },
    });
    expect(codes(r)).toEqual(
      expect.arrayContaining(['title:text_overlap', 'foot:text_overlap', 'title:text_outside_safe', 'sub:text_outside_safe']),
    );
  });

  it('카드 HTML 이 바깥 주소(스타일·그림·폰트)를 불러도 렌더러는 막고 PNG 를 만든다 — 오프라인 동작(FR-AC-1)', async () => {
    if (!info) return;
    const ext = 'https://example.com';
    const r = await renderCard(null, {
      html: page(
        `<link rel="stylesheet" href="${ext}/x.css"><img src="${ext}/x.png" style="width:10px;height:10px"><h1 class="t" style="top:100px" data-slot="title">바깥 주소</h1>`,
        `@font-face{font-family:Remote;src:url(${ext}/x.woff2)} .t{font-family:'Pretendard',Remote}`,
      ),
      width: W,
      height: H,
    });
    expect(codes(r)).toEqual([]);
    expect(r.png).not.toBeNull();
    expect(r.fontsUsed.every((f) => f.custom)).toBe(true);
    // 막은 목록에 바깥 주소가 모두 있고, 막지 않은 것은 카드·폰트 파일(가짜 origin)뿐이다
    expect(r.blockedRequests).toEqual(expect.arrayContaining([`${ext}/x.css`, `${ext}/x.png`]));
    expect(r.blockedRequests.every((u) => u.startsWith(ext))).toBe(true);
  });

  it('개발 서버처럼 tsx 로 돌아도 측정 함수가 브라우저에서 돈다 (esbuild 의 __name 도우미 — 개발 서버에서만 실제로 겪음)', () => {
    if (!info) return;
    const out = execFileSync(path.join(env.repoRoot, 'node_modules/.bin/tsx'), [path.join(env.repoRoot, 'server/src/render/testing/tsx-render.ts')], { encoding: 'utf8' });
    expect(JSON.parse(out.trim().split('\n').at(-1)!)).toEqual({ ok: true, problems: [] });
  });
});
