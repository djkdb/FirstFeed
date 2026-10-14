// 시안 C · 에디토리얼 — 바탕색 위에 가는 선과 큰 쪽 번호, 왼쪽 정렬, 넓은 여백. 색은 쪽 번호·강조 글자에만.
// 제목 폰트(명조·장식·고딕 어느 것이 와도)를 크게 보이는 쪽에 무게를 둔다
import { accentOn, baseCss, esc, markCss, weight } from './base.ts';
import { textToHtml } from './text.ts';
import { FRAME_SIZE, type BrandLook, type Draft, type FrameContent } from './types.ts';

function css(look: BrandLook, s: number, w: number, h: number): string {
  const p = look.palette;
  const acc = accentOn(p.background, look) ?? p.text;
  return `${baseCss(look, w, h)}
[data-card]{background:${p.background};color:${p.text}}
${markCss(p.background, look)}
.inner{flex:1;display:flex;flex-direction:column;padding:96px}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center}
.rule{height:2px;background:${p.text};opacity:.25;flex:none}
.meta{display:flex;justify-content:space-between;align-items:baseline;font-size:28px;letter-spacing:.08em;flex:none;padding-bottom:22px}
.meta .k{opacity:.6;white-space:nowrap}
.num{font-size:120px;line-height:1;color:${acc};font-weight:${weight(look.titleFont, 700)};flex:none}
/* 표지 */
.cover .mid{justify-content:flex-start;padding-top:120px}
.cover h1{font-size:${Math.round(98 * s)}px;font-weight:${weight(look.titleFont, 700)};line-height:1.2;letter-spacing:-.02em}
.cover .sub{margin-top:40px;font-size:${Math.round(36 * s)}px;line-height:1.5;opacity:.75;max-width:760px}
.cover .foot{flex:none;padding-top:22px;font-size:28px;opacity:.6;display:flex;justify-content:space-between}
/* 본문 */
.body .head{display:flex;justify-content:space-between;align-items:flex-end;flex:none;padding-bottom:30px}
.body .chip{font-size:${Math.round(28 * s)}px;letter-spacing:.06em;opacity:.7;white-space:nowrap}
.body h2{font-size:${Math.round(62 * s)}px;font-weight:${weight(look.titleFont, 700)};line-height:1.26;letter-spacing:-.01em;margin:56px 0 36px}
.body .mid{justify-content:flex-start}
.body .txt{font-size:${Math.round(38 * s)}px;line-height:1.75;opacity:.85}
/* 마무리 */
.closing .mid{justify-content:center}
.closing h2{font-size:${Math.round(80 * s)}px;font-weight:${weight(look.titleFont, 700)};line-height:1.24;margin:48px 0}
.closing .sub{font-size:${Math.round(36 * s)}px;opacity:.7}
/* 릴스 표지 — 제목은 정가운데, 위아래 선 */
.reel .mid{align-items:center;text-align:center}
.reel .inner{padding:0 70px}
.reel .chip{font-size:${Math.round(38 * s)}px;letter-spacing:.08em;opacity:.75;margin-bottom:34px}
.reel .rule{width:220px}
.reel h1{font-size:${Math.round(118 * s)}px;font-weight:${weight(look.titleFont, 700)};line-height:1.1;letter-spacing:-.03em;margin:44px 0}
`;
}

export const draftC: Draft = {
  id: 'C',
  name: '에디토리얼',
  description: '바탕색에 가는 선·큰 쪽 번호·왼쪽 정렬. 표지 제목은 위쪽, 릴스 표지는 정가운데에 위아래 선',
  html(look: BrandLook, c: FrameContent, s: number): string {
    const { width, height } = FRAME_SIZE[c.kind];
    const handle = look.handle ? `@${esc(look.handle)}` : '';
    let card: string;
    if (c.kind === 'cover')
      card = `<div data-card class="cover"><div class="inner">
        <div class="meta"><span class="k" data-box="handle">${handle}</span>${c.chip ? `<span class="k" data-slot="chip" data-max-lines="1">${esc(c.chip)}</span>` : ''}</div>
        <div class="rule"></div>
        <div class="mid" data-region>
          <h1 class="title" data-slot="headline" data-max-lines="2">${textToHtml(c.headline)}</h1>
          ${c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : ''}
        </div>
        <div class="rule"></div><div class="foot"><span>01</span><span>→</span></div>
      </div></div>`;
    else if (c.kind === 'body')
      card = `<div data-card class="body"><div class="inner">
        <div class="head"><span class="num title" data-box="page">${String(c.page).padStart(2, '0')}</span>${c.chip ? `<span class="chip" data-slot="chip" data-max-lines="1">${esc(c.chip)}</span>` : ''}</div>
        <div class="rule"></div>
        <div class="mid" data-region>
          <h2 class="title" data-slot="title" data-max-lines="2">${textToHtml(c.title)}</h2>
          <div class="txt" data-slot="text">${textToHtml(c.text)}</div>
        </div>
      </div></div>`;
    else if (c.kind === 'closing')
      card = `<div data-card class="closing"><div class="inner"><div class="mid" data-region>
        <div class="rule"></div>
        <h2 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h2>
        <div class="rule"></div>
        ${c.sub ? `<div class="sub" style="margin-top:32px" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : handle ? `<div class="sub" style="margin-top:32px" data-slot="handle" data-max-lines="1">${handle}</div>` : ''}
      </div></div></div>`;
    else
      card = `<div data-card class="reel"><div class="inner"><div class="mid" data-region>
        ${c.chip ? `<div class="chip" data-slot="chip" data-max-lines="1">${esc(c.chip)}</div>` : ''}
        <div class="rule"></div>
        <h1 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h1>
        <div class="rule"></div>
      </div></div></div>`;
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css(look, s, width, height)}</style></head><body>${card}</body></html>`;
  },
};
