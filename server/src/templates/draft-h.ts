// 시안 H · 점 무늬 큰 제목 — 바탕색에 옅은 점 격자, 제목은 왼쪽 아래에 아주 크고 두껍게, 그 위에 강조색 막대 하나.
// 점은 글자색을 아주 옅게(10%) 찍은 장식이라 글자 · 바탕 대비를 거의 바꾸지 않는다. 본문은 큰 쪽 번호가 머리 역할
// 참고: muv.vv 카드뉴스 템플릿(재배포 금지)의 「점 격자 바탕 + 아래쪽 큰 제목」 구성만 참고, 파일은 옮기지 않았다
import { accentOn, baseCss, esc, markCss, weight, wordmark } from './base.ts';
import { textToHtml } from './text.ts';
import { FRAME_SIZE, type BrandLook, type Draft, type FrameContent } from './types.ts';

function css(look: BrandLook, s: number, w: number, h: number): string {
  const p = look.palette;
  const acc = accentOn(p.background, look) ?? p.text;
  return `${baseCss(look, w, h)}
[data-card]{background:radial-gradient(circle, color-mix(in srgb, ${p.text} 10%, transparent) 2.5px, transparent 3px) 0 0/40px 40px, ${p.background};color:${p.text}}
${markCss(p.background, look)}
.inner{flex:1;display:flex;flex-direction:column;padding:84px 80px}
.mid{flex:1;display:flex;flex-direction:column;justify-content:flex-end}
.top{display:flex;justify-content:space-between;align-items:center;flex:none}
.chip{display:inline-block;white-space:nowrap;padding:0 0 6px;border-bottom:5px solid ${acc};font-size:${Math.round(28 * s)}px;font-weight:${weight(look.bodyFont, 700)};line-height:1.1}
.wm{font-size:28px;font-weight:${weight(look.titleFont, 700)};letter-spacing:.22em;white-space:nowrap;opacity:.6}
.bar{width:120px;height:16px;background:${acc};border-radius:8px;margin-bottom:40px;flex:none}
/* 표지 */
.cover .inner{padding:84px 76px 104px}
.cover h1{font-size:${Math.round(100 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.1;letter-spacing:-.04em}
.cover .sub{margin-top:32px;font-size:${Math.round(34 * s)}px;line-height:1.45;opacity:.75}
/* 본문 — 큰 쪽 번호 */
.body .no{font-size:${Math.round(150 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1;color:${acc};letter-spacing:-.04em;margin-bottom:34px}
.body .mid{justify-content:center}
.body h2{font-size:${Math.round(62 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.22;letter-spacing:-.02em;margin-bottom:34px}
.body .txt{font-size:${Math.round(37 * s)}px;line-height:1.7;opacity:.85}
.body .pg{font-size:26px;font-weight:${weight(look.bodyFont, 700)};opacity:.5;white-space:nowrap}
/* 마무리 */
.closing h2{font-size:${Math.round(84 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.16;letter-spacing:-.03em;margin-bottom:30px}
.closing .sub{font-size:${Math.round(36 * s)}px;line-height:1.6;opacity:.75}
/* 릴스 표지 — 제목은 정가운데(격자 위아래 240px 가림) */
.reel .inner{justify-content:center;align-items:center;text-align:center;padding:0 64px}
.reel .mid{flex:none;align-items:center}
.reel .bar{margin:0 auto 40px}
.reel h1{font-size:${Math.round(128 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.06;letter-spacing:-.05em;margin-top:30px}
.reel .chip{font-size:${Math.round(40 * s)}px}
`;
}

export const draftH: Draft = {
  id: 'H',
  name: '점 무늬 큰 제목',
  description: '옅은 점 격자 바탕에 아주 크고 두꺼운 제목을 왼쪽 아래로, 강조색 막대 하나. 본문은 큰 쪽 번호가 머리',
  html(look: BrandLook, c: FrameContent, s: number): string {
    const { width, height } = FRAME_SIZE[c.kind];
    const chip = (t: string | null | undefined) => (t ? `<span class="chip" data-slot="chip" data-max-lines="1">${esc(t)}</span>` : '<span></span>');
    const m = wordmark(look);
    const wm = m ? `<span class="wm" data-box="wordmark">${esc(m)}</span>` : '<span></span>';
    let card: string;
    if (c.kind === 'cover')
      card = `<div data-card class="cover"><div class="inner">
        <div class="top">${chip(c.chip)}${wm}</div>
        <div class="mid" data-region>
          <div class="bar"></div>
          <h1 class="title" data-slot="headline" data-max-lines="2">${textToHtml(c.headline)}</h1>
          ${c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : ''}
        </div></div></div>`;
    else if (c.kind === 'body')
      card = `<div data-card class="body"><div class="inner">
        <div class="top">${chip(c.chip)}<span class="pg" data-box="page">${c.page} / ${c.total}</span></div>
        <div class="mid" data-region>
          <div class="no title" data-box="number">${String(c.page).padStart(2, '0')}</div>
          <h2 class="title" data-slot="title" data-max-lines="2">${textToHtml(c.title)}</h2>
          <div class="txt" data-slot="text">${textToHtml(c.text)}</div>
        </div></div></div>`;
    else if (c.kind === 'closing')
      card = `<div data-card class="closing"><div class="inner">
        <div class="top"><span></span>${wm}</div>
        <div class="mid" data-region>
          <div class="bar"></div>
          <h2 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h2>
          ${c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : look.handle ? `<div class="sub" data-slot="handle" data-max-lines="1">@${esc(look.handle)}</div>` : ''}
        </div></div></div>`;
    else
      card = `<div data-card class="reel"><div class="inner"><div class="mid" data-region>
        <div class="bar"></div>
        <div>${chip(c.chip)}</div>
        <h1 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h1>
      </div></div></div>`;
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css(look, s, width, height)}</style></head><body>${card}</body></html>`;
  },
};
