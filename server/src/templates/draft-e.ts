// 시안 E · 뒤집은 색·큰 타이포 — 팔레트의 글자색을 바탕으로, 바탕색을 글자로 뒤집는다(명암비는 팔레트 규칙이 보장, 대칭).
// 밝은 팔레트는 어두운 카드, 어두운 팔레트는 밝은 카드가 된다. 큰 쪽 번호를 옅게 깔고 왼쪽 세로 강조선 하나
import { accentOn, baseCss, esc, markCss, weight } from './base.ts';
import { textToHtml } from './text.ts';
import { FRAME_SIZE, type BrandLook, type Draft, type FrameContent } from './types.ts';

function css(look: BrandLook, s: number, w: number, h: number): string {
  const p = look.palette;
  const bg = p.text;
  const fg = p.background;
  const acc = accentOn(bg, look, fg) ?? fg;
  return `${baseCss(look, w, h)}
[data-card]{background:${bg};color:${fg}}
${markCss(bg, look, fg)}
.inner{flex:1;display:flex;flex-direction:column;padding:90px 88px}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center;border-left:10px solid ${acc};padding-left:44px}
.ghost{position:absolute;right:40px;bottom:-60px;font-size:520px;line-height:1;font-weight:${weight(look.titleFont, 800)};color:${fg};opacity:.06;letter-spacing:-.06em;pointer-events:none}
.meta{display:flex;justify-content:space-between;font-size:28px;font-weight:${weight(look.bodyFont, 700)};letter-spacing:.06em;flex:none;opacity:.7;margin-bottom:40px}
.meta span{white-space:nowrap}
.chip{color:${acc};opacity:1}
/* 표지 */
.cover h1{font-size:${Math.round(96 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.12;letter-spacing:-.04em}
.cover .sub{margin-top:34px;font-size:${Math.round(34 * s)}px;line-height:1.45;opacity:.75}
/* 본문 */
.body h2{font-size:${Math.round(62 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.22;letter-spacing:-.02em;margin-bottom:36px}
.body .txt{font-size:${Math.round(37 * s)}px;line-height:1.72;opacity:.85}
/* 마무리 */
.closing h2{font-size:${Math.round(80 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.18;letter-spacing:-.03em;margin-bottom:30px}
.closing .sub{font-size:${Math.round(36 * s)}px;opacity:.7}
/* 릴스 표지 — 제목 덩어리를 정가운데에 */
.reel .inner{padding:0 80px;justify-content:center}
.reel .mid{flex:none}
.reel .chip{font-size:${Math.round(38 * s)}px;font-weight:${weight(look.bodyFont, 700)};margin-bottom:24px}
.reel h1{font-size:${Math.round(120 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.06;letter-spacing:-.05em}
`;
}

export const draftE: Draft = {
  id: 'E',
  name: '뒤집은 색 · 큰 타이포',
  description: '팔레트의 글자색을 바탕으로 뒤집고, 큰 제목과 왼쪽 세로 강조선 하나. 옅은 큰 쪽 번호를 깐다',
  html(look: BrandLook, c: FrameContent, s: number): string {
    const { width, height } = FRAME_SIZE[c.kind];
    const handle = look.handle ? `<span data-box="handle">@${esc(look.handle)}</span>` : '<span></span>';
    const chip = (t: string | null | undefined) => (t ? `<span class="chip" data-slot="chip" data-max-lines="1">${esc(t)}</span>` : '<span></span>');
    let card: string;
    if (c.kind === 'cover')
      card = `<div data-card class="cover"><div class="ghost title">01</div><div class="inner">
        <div class="meta">${handle}${chip(c.chip)}</div>
        <div class="mid" data-region>
          <h1 class="title" data-slot="headline" data-max-lines="2">${textToHtml(c.headline)}</h1>
          ${c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : ''}
        </div></div></div>`;
    else if (c.kind === 'body')
      card = `<div data-card class="body"><div class="ghost title">${String(c.page).padStart(2, '0')}</div><div class="inner">
        <div class="meta">${chip(c.chip)}<span data-box="page">${c.page} / ${c.total}</span></div>
        <div class="mid" data-region>
          <h2 class="title" data-slot="title" data-max-lines="2">${textToHtml(c.title)}</h2>
          <div class="txt" data-slot="text">${textToHtml(c.text)}</div>
        </div></div></div>`;
    else if (c.kind === 'closing')
      card = `<div data-card class="closing"><div class="inner">
        <div class="mid" data-region>
          <h2 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h2>
          ${c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : look.handle ? `<div class="sub" data-slot="handle" data-max-lines="1">@${esc(look.handle)}</div>` : ''}
        </div></div></div>`;
    else
      card = `<div data-card class="reel"><div class="inner">
        <div class="mid" data-region>
          ${c.chip ? `<div class="chip" data-slot="chip" data-max-lines="1">${esc(c.chip)}</div>` : ''}
          <h1 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h1>
        </div></div></div>`;
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css(look, s, width, height)}</style></head><body>${card}</body></html>`;
  },
};
