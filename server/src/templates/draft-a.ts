// 시안 A · 한 색 강조 — 레퍼런스(@zun_it_ 카드)의 뼈대를 일반화한 것.
// 세 종류가 같은 뼈대: [배지 + 쪽수] / [내용, 세로 가운데] / [워드마크]. 색은 배지·강조 글자·워드마크 첫 글자 세 곳에만 —
// 색을 카드 전체에 퍼뜨리면 프로필 격자에서 계정이 여러 개로 쪼개져 보인다(레퍼런스 주석)
import { accentOn, baseCss, esc, inkOn, markCss, weight, wordmark } from './base.ts';
import { textToHtml } from './text.ts';
import { FRAME_SIZE, type BrandLook, type Draft, type FrameContent } from './types.ts';

function css(look: BrandLook, s: number, w: number, h: number): string {
  const p = look.palette;
  const acc = accentOn(p.background, look) ?? p.text;
  return `${baseCss(look, w, h)}
[data-card]{background:${p.background};color:${p.text}}
.inner{flex:1;display:flex;flex-direction:column;padding:80px}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center}
.hdr{display:flex;justify-content:space-between;align-items:center;flex:none}
.chip{display:inline-block;white-space:nowrap;border-radius:999px;padding:14px 28px;font-size:${Math.round(26 * s)}px;font-weight:${weight(look.bodyFont, 700)};
  line-height:1;background:${p.primary};color:${inkOn(p.primary, look)}}
.pg{font-size:26px;font-weight:${weight(look.bodyFont, 700)};opacity:.55;white-space:nowrap}
${markCss(p.background, look)}
.wm{font-weight:${weight(look.titleFont, 700)};letter-spacing:.3em;line-height:1;opacity:1;color:${p.text}}
.wm span{opacity:.32}.wm span.on{opacity:1;color:${acc}}
/* 표지 */
.cover .inner{justify-content:flex-end;padding:0 76px 110px}
.cover .wm{position:absolute;top:66px;left:0;right:0;text-align:center;font-size:38px}
.cover h1{font-size:${Math.round(96 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.18;letter-spacing:-.03em;margin-top:34px}
.cover .sub{margin-top:26px;font-size:${Math.round(34 * s)}px;line-height:1.45;opacity:.85}
/* 본문 */
.body h2{font-size:${Math.round(64 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.24;letter-spacing:-.02em;margin-bottom:40px}
.body .txt{font-size:${Math.round(38 * s)}px;line-height:1.7;opacity:.82}
.body .wm{font-size:26px;text-align:right;flex:none}
/* 마무리 */
.closing .inner{align-items:center;justify-content:center;text-align:center;padding:0 80px}
.closing h2{font-size:${Math.round(76 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.22;letter-spacing:-.03em;margin-bottom:34px}
.closing .sub{font-size:${Math.round(38 * s)}px;line-height:1.6;opacity:.7}
.closing .wm{position:absolute;bottom:96px;left:0;right:0;text-align:center;font-size:38px}
/* 릴스 표지 — 제목이 정가운데: 격자가 9:16 의 위아래를 잘라 3:4 로 보여 줄 때 어느 쪽에서 잘려도 남는 자리 */
.reel .inner{align-items:center;justify-content:center;text-align:center;padding:0 60px}
.reel .chip{font-size:${Math.round(40 * s)}px;padding:20px 40px}
.reel h1{font-size:${Math.round(124 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.06;letter-spacing:-.05em;margin-top:30px}
`;
}

function wm(look: BrandLook): string {
  const m = wordmark(look);
  if (!m) return '';
  return `<div class="wm" data-box="wordmark">${[...m].map((c, i) => `<span${i === 0 ? ' class="on"' : ''}>${esc(c)}</span>`).join('')}</div>`;
}

export const draftA: Draft = {
  id: 'A',
  name: '한 색 강조',
  description: '단색 바탕에 강조색은 배지·강조 글자·워드마크 세 곳만. 표지 제목은 아래 3분의 1, 릴스 표지는 정가운데',
  html(look: BrandLook, c: FrameContent, s: number): string {
    const { width, height } = FRAME_SIZE[c.kind];
    const chip = (t: string | null | undefined) => (t ? `<span class="chip" data-slot="chip" data-max-lines="1">${esc(t)}</span>` : '');
    let card: string;
    if (c.kind === 'cover')
      card = `<div data-card class="cover">${wm(look)}<div class="inner">
        <div>${chip(c.chip)}</div>
        <h1 class="title" data-slot="headline" data-max-lines="2">${textToHtml(c.headline)}</h1>
        ${c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : ''}
      </div></div>`;
    else if (c.kind === 'body')
      card = `<div data-card class="body"><div class="inner">
        <div class="hdr"><div>${chip(c.chip)}</div><div class="pg" data-box="page">${String(c.page).padStart(2, '0')} / ${String(c.total).padStart(2, '0')}</div></div>
        <div class="mid" data-region>
          <h2 class="title" data-slot="title" data-max-lines="2">${textToHtml(c.title)}</h2>
          <div class="txt" data-slot="text">${textToHtml(c.text)}</div>
        </div>
        ${wm(look)}
      </div></div>`;
    else if (c.kind === 'closing')
      card = `<div data-card class="closing"><div class="inner">
        <h2 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h2>
        ${c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : look.handle ? `<div class="sub" data-slot="handle" data-max-lines="1">@${esc(look.handle)}</div>` : ''}
      </div>${wm(look)}</div>`;
    else
      card = `<div data-card class="reel"><div class="inner">
        <div>${chip(c.chip)}</div>
        <h1 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h1>
      </div></div>`;
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css(look, s, width, height)}</style></head><body>${card}</body></html>`;
  },
};
