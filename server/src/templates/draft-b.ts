// 시안 B · 색 면 — 표지·마무리·릴스 표지는 주색으로 꽉 채우고, 본문은 바탕색 위에 주색 띠(제목) + 글.
// 격자에서 표지가 색 면으로 바로 보여 "이 계정" 이 눈에 띈다. 주색 위 글자는 팔레트 규칙(주색 위 4.5:1)이 보장한 색만 쓴다
import { accentOn, baseCss, esc, inkOn, markCss, weight } from './base.ts';
import { textToHtml } from './text.ts';
import { FRAME_SIZE, type BrandLook, type Draft, type FrameContent } from './types.ts';

function initials(look: BrandLook): string {
  const src = (look.displayName ?? look.handle ?? '').replace(/[^\p{L}\p{N}]/gu, '');
  const g = [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(src)].map((x) => x.segment);
  if (g.length === 0) return '';
  return /\p{Script=Hangul}/u.test(g[0]!) ? g[0]! : g.slice(0, 2).join('').toUpperCase();
}

function css(look: BrandLook, s: number, w: number, h: number): string {
  const p = look.palette;
  const ink = inkOn(p.primary, look);
  return `${baseCss(look, w, h)}
.solid{background:${p.primary};color:${ink}}
.solid .mk{color:inherit;text-decoration:underline;text-decoration-thickness:.08em;text-underline-offset:.14em}
.paper{background:${p.background};color:${p.text}}
.paper ${markCss(p.background, look)}
.inner{flex:1;display:flex;flex-direction:column;padding:88px}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center}
.handle{font-size:30px;font-weight:${weight(look.bodyFont, 700)};opacity:.8;white-space:nowrap}
.chip{display:inline-block;white-space:nowrap;border:3px solid currentColor;border-radius:14px;padding:10px 22px;font-size:${Math.round(28 * s)}px;font-weight:${weight(look.bodyFont, 700)};line-height:1.1}
/* 표지 */
.cover .mid{justify-content:flex-end}
.cover h1{font-size:${Math.round(100 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.14;letter-spacing:-.03em;margin-top:30px}
.cover .sub{margin-top:36px;font-size:${Math.round(36 * s)}px;line-height:1.45;padding-top:30px;border-top:3px solid currentColor}
/* 본문 */
.band{background:${p.primary};color:${ink};padding:72px 88px 56px;flex:none}
.band .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}
.band .pg{font-size:28px;font-weight:${weight(look.bodyFont, 700)};white-space:nowrap}
.band h2{font-size:${Math.round(60 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.22;letter-spacing:-.02em}
.body .inner{padding:64px 88px 88px}
.body .mid{justify-content:flex-start}
.body .txt{font-size:${Math.round(38 * s)}px;line-height:1.7;padding-left:30px;border-left:6px solid ${accentOn(p.background, look) ?? p.primary}}
/* 마무리 */
.closing .mid{align-items:center;text-align:center}
.closing h2{font-size:${Math.round(76 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.2;letter-spacing:-.03em;margin-bottom:60px}
.avatar{width:160px;height:160px;border-radius:50%;background:${p.background};color:${p.primary};display:flex;align-items:center;justify-content:center;
  font-size:64px;font-weight:${weight(look.titleFont, 800)};overflow:hidden;margin-bottom:24px}
.avatar img{width:100%;height:100%;object-fit:cover}
.closing .name{font-size:${Math.round(36 * s)}px;font-weight:${weight(look.bodyFont, 700)};margin-bottom:8px}
/* 릴스 표지 — 제목은 정가운데 */
.reel .mid{align-items:center;text-align:center}
.reel .inner{padding:0 64px}
.reel .chip{font-size:${Math.round(40 * s)}px}
.reel h1{font-size:${Math.round(124 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.06;letter-spacing:-.05em;margin-top:34px}
`;
}

export const draftB: Draft = {
  id: 'B',
  name: '색 면',
  description: '표지·마무리·릴스 표지는 주색 면, 본문은 주색 띠에 제목을 얹고 아래에 글. 마무리에 프로필 사진(없으면 글자형)',
  html(look: BrandLook, c: FrameContent, s: number): string {
    const { width, height } = FRAME_SIZE[c.kind];
    const chip = (t: string | null | undefined) => (t ? `<span class="chip" data-slot="chip" data-max-lines="1">${esc(t)}</span>` : '');
    const handle = look.handle ? `<div class="handle" data-box="handle">@${esc(look.handle)}</div>` : '';
    let card: string;
    if (c.kind === 'cover')
      card = `<div data-card class="cover solid"><div class="inner">${handle}<div class="mid" data-region>
        <div>${chip(c.chip)}</div>
        <h1 class="title" data-slot="headline" data-max-lines="2">${textToHtml(c.headline)}</h1>
        ${c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : ''}
      </div></div></div>`;
    else if (c.kind === 'body')
      card = `<div data-card class="body paper">
        <div class="band"><div class="top"><div>${chip(c.chip)}</div><div class="pg" data-box="page">${c.page} / ${c.total}</div></div>
          <h2 class="title" data-slot="title" data-max-lines="2">${textToHtml(c.title)}</h2></div>
        <div class="inner"><div class="mid" data-region><div class="txt" data-slot="text">${textToHtml(c.text)}</div></div></div>
      </div>`;
    else if (c.kind === 'closing')
      card = `<div data-card class="closing solid"><div class="inner"><div class="mid" data-region>
        <h2 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h2>
        <div class="avatar title" data-box="avatar">${look.profileImage ? `<img src="${esc(look.profileImage)}" alt="">` : esc(initials(look))}</div>
        ${look.displayName ? `<div class="name" data-slot="name" data-max-lines="1">${esc(look.displayName)}</div>` : ''}
        ${look.handle ? `<div class="handle" data-slot="handle" data-max-lines="1">@${esc(look.handle)}</div>` : ''}
        ${c.sub ? `<div class="handle" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : ''}
      </div></div></div>`;
    else
      card = `<div data-card class="reel solid"><div class="inner"><div class="mid" data-region>
        <div>${chip(c.chip)}</div>
        <h1 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h1>
      </div></div></div>`;
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css(look, s, width, height)}</style></head><body>${card}</body></html>`;
  },
};
