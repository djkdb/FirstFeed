// 시안 I · 반짝 표지 + 사진 본문 — 표지는 주색 면에 강조색 반짝이(네 갈래 별) 몇 개와 왼쪽 아래 큰 제목.
// 본문은 [제목] / [사진] / [설명] 세 칸: 사진이 있으면 가운데를 사진이 채우고, 없으면 그 자리에 테두리 상자 안 설명이 온다.
// 반짝이 색은 주색과 대비가 가장 큰 팔레트 색(장식이라 글자 기준은 아님). 참고: muv.vv 카드뉴스 템플릿(재배포 금지)의 「반짝이 바탕」·「제목 + 사진 + 설명」 구성만
import { contrastRatio } from '../brand/limits.ts';
import { accentOn, baseCss, esc, inkOn, markCss, photoBox, weight } from './base.ts';
import { textToHtml } from './text.ts';
import { FRAME_SIZE, type BrandLook, type Draft, type FrameContent, type PhotoOpts } from './types.ts';

const star = (x: number, y: number, r: number, color: string) =>
  `<svg class="star" style="left:${x}px;top:${y}px;width:${r * 2}px;height:${r * 2}px" viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0-10C1 -2 2 -1 10 0C2 1 1 2 0 10C-1 2 -2 1 -10 0C-2 -1 -1 -2 0-10Z" fill="${color}"/></svg>`;

function sparkle(look: BrandLook, bg: string): string {
  const p = look.palette;
  const c = [p.accent, p.secondary, p.background, p.text].sort((a, b) => contrastRatio(b, bg) - contrastRatio(a, bg))[0]!;
  return star(780, 110, 64, c) + star(930, 280, 30, c) + star(690, 330, 22, c) + star(110, 150, 18, c);
}

function css(look: BrandLook, s: number, w: number, h: number): string {
  const p = look.palette;
  const ink = inkOn(p.primary, look);
  const acc = accentOn(p.background, look) ?? p.text;
  return `${baseCss(look, w, h)}
[data-card]{background:${p.background};color:${p.text}}
.star{position:absolute;pointer-events:none}
${markCss(p.background, look)}
.inner{position:relative;flex:1;display:flex;flex-direction:column;padding:80px}
.mid{flex:1;display:flex;flex-direction:column}
.chip{display:inline-block;white-space:nowrap;border-radius:999px;padding:13px 26px;font-size:${Math.round(26 * s)}px;font-weight:${weight(look.bodyFont, 700)};line-height:1;background:${p.primary};color:${ink}}
.top{display:flex;justify-content:space-between;align-items:center;flex:none}
.pg{font-size:26px;font-weight:${weight(look.bodyFont, 700)};opacity:.5;white-space:nowrap}
/* 표지 — 주색 면 */
.cover,.reel{background:${p.primary};color:${ink}}
.cover .chip,.reel .chip{background:${p.background};color:${p.text}}
.cover .mid{justify-content:flex-end}
.cover .inner{padding:0 76px 100px}
.cover h1{font-size:${Math.round(96 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.12;letter-spacing:-.035em;margin-top:30px}
.cover .sub{margin-top:26px;font-size:${Math.round(34 * s)}px;line-height:1.45;opacity:.85}
.cover .mk,.reel .mk{color:inherit;background:none;text-decoration:underline;text-decoration-thickness:.1em;text-underline-offset:.14em}
/* 본문 — 제목 / 사진 / 설명 */
.body h2{font-size:${Math.round(58 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.22;letter-spacing:-.02em;margin:44px 0 36px;flex:none}
.body .photo{flex:1;min-height:360px;border-radius:28px;background:${p.secondary} center/cover no-repeat;margin-bottom:40px}
.body .txt{font-size:${Math.round(36 * s)}px;line-height:1.66;opacity:.85}
.body.has-photo .txt{flex:none;font-size:${Math.round(33 * s)}px;line-height:1.55}
.body .box{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;border:4px solid ${acc};border-radius:28px;padding:56px 52px}
/* 마무리 */
.closing .mid{justify-content:center;align-items:center;text-align:center}
.closing h2{font-size:${Math.round(78 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.2;margin-bottom:30px}
.closing .sub{font-size:${Math.round(36 * s)}px;opacity:.7}
/* 릴스 표지 */
.reel .inner{justify-content:center;align-items:center;text-align:center;padding:0 64px}
.reel .mid{flex:none;align-items:center}
.reel h1{font-size:${Math.round(124 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.06;letter-spacing:-.05em;margin-top:30px}
.reel .chip{font-size:${Math.round(38 * s)}px;padding:18px 36px}
`;
}

export const draftI: Draft = {
  id: 'I',
  name: '반짝 표지 + 사진 본문',
  description: '표지는 주색 면에 반짝이 몇 개와 큰 제목. 본문은 제목 / 사진 / 설명 세 칸(사진이 없으면 테두리 상자 안 설명)',
  bodyPhoto: true,
  html(look: BrandLook, c: FrameContent, s: number, photo?: PhotoOpts): string {
    const { width, height } = FRAME_SIZE[c.kind];
    const chip = (t: string | null | undefined) => (t ? `<span class="chip" data-slot="chip" data-max-lines="1">${esc(t)}</span>` : '<span></span>');
    let card: string;
    if (c.kind === 'cover')
      card = `<div data-card class="cover">${sparkle(look, look.palette.primary)}<div class="inner"><div class="mid" data-region>
        <div>${chip(c.chip)}</div>
        <h1 class="title" data-slot="headline" data-max-lines="2">${textToHtml(c.headline)}</h1>
        ${c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : ''}
      </div></div></div>`;
    else if (c.kind === 'body') {
      const pic = photoBox(photo?.background);
      const text = `<div class="txt" data-slot="text">${textToHtml(c.text)}</div>`;
      card = `<div data-card class="body${pic ? ' has-photo' : ''}"><div class="inner">
        <div class="top">${chip(c.chip)}<span class="pg" data-box="page">${c.page} / ${c.total}</span></div>
        <div class="mid" data-region>
          <h2 class="title" data-slot="title" data-max-lines="2">${textToHtml(c.title)}</h2>
          ${pic ? `${pic}${text}` : `<div class="box">${text}</div>`}
        </div></div></div>`;
    } else if (c.kind === 'closing')
      card = `<div data-card class="closing"><div class="inner"><div class="mid" data-region>
        <h2 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h2>
        ${c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : look.handle ? `<div class="sub" data-slot="handle" data-max-lines="1">@${esc(look.handle)}</div>` : ''}
      </div></div></div>`;
    else
      card = `<div data-card class="reel"><div class="inner"><div class="mid" data-region>
        <div>${chip(c.chip)}</div>
        <h1 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h1>
      </div></div></div>`;
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css(look, s, width, height)}</style></head><body>${card}</body></html>`;
  },
};
