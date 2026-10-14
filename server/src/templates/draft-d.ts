// 시안 D · 카드 속 카드 — 주색 바탕 위에 바탕색 판을 한 장 얹고 글은 판 안에. 판 밖 주색 테두리가 격자에서 계정을 묶어 준다.
// B(주색 면 전체)와 달리 글은 늘 바탕색 판 위라 본문이 길어도 읽기 쉽다
import { accentOn, baseCss, esc, inkOn, markCss, weight } from './base.ts';
import { textToHtml } from './text.ts';
import { FRAME_SIZE, type BrandLook, type Draft, type FrameContent } from './types.ts';

function css(look: BrandLook, s: number, w: number, h: number): string {
  const p = look.palette;
  const ink = inkOn(p.primary, look);
  const acc = accentOn(p.background, look) ?? p.text;
  return `${baseCss(look, w, h)}
[data-card]{background:${p.primary};padding:56px}
.panel{flex:1;min-height:0;display:flex;flex-direction:column;background:${p.background};color:${p.text};border-radius:36px;padding:72px 64px;box-shadow:0 18px 40px rgb(0 0 0 / 18%)}
${markCss(p.background, look)}
.top{display:flex;justify-content:space-between;align-items:center;flex:none}
.chip{display:inline-block;white-space:nowrap;border-radius:999px;padding:12px 24px;font-size:${Math.round(26 * s)}px;font-weight:${weight(look.bodyFont, 700)};line-height:1;background:${acc};color:${p.background}}
.pg{font-size:26px;font-weight:${weight(look.bodyFont, 700)};opacity:.5;white-space:nowrap}
.outside{flex:none;color:${ink};font-size:28px;font-weight:${weight(look.bodyFont, 700)};padding-top:26px;text-align:center;white-space:nowrap}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center}
/* 표지 */
.cover h1{font-size:${Math.round(92 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.16;letter-spacing:-.03em;margin-top:28px}
.cover .sub{margin-top:28px;font-size:${Math.round(34 * s)}px;line-height:1.45;opacity:.75}
/* 본문 */
.body h2{font-size:${Math.round(60 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.24;letter-spacing:-.02em;margin-bottom:36px}
.body .txt{font-size:${Math.round(37 * s)}px;line-height:1.7;opacity:.85}
/* 마무리 */
.closing .mid{align-items:center;text-align:center}
.closing h2{font-size:${Math.round(74 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.22;margin-bottom:30px}
.closing .sub{font-size:${Math.round(36 * s)}px;opacity:.7}
/* 릴스 표지 — 판은 격자에서 남는 가운데 3:4 안쪽에, 제목은 정가운데 */
.reel{padding:0 56px}
.reel .panel{flex:none;height:1260px;margin:330px 0;justify-content:center;align-items:center;text-align:center;padding:64px 56px}
.reel h1{font-size:${Math.round(118 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.06;letter-spacing:-.05em;margin-top:30px}
.reel .chip{font-size:${Math.round(38 * s)}px;padding:18px 36px}
`;
}

export const draftD: Draft = {
  id: 'D',
  name: '카드 속 카드',
  description: '주색 바탕 위에 바탕색 판을 한 장 얹고 글은 판 안에. 판 밖 주색 테두리가 격자에서 계정을 묶어 준다',
  html(look: BrandLook, c: FrameContent, s: number): string {
    const { width, height } = FRAME_SIZE[c.kind];
    const chip = (t: string | null | undefined) => (t ? `<span class="chip" data-slot="chip" data-max-lines="1">${esc(t)}</span>` : '<span></span>');
    const handle = look.handle ? `<div class="outside" data-box="handle">@${esc(look.handle)}</div>` : '';
    let card: string;
    if (c.kind === 'cover')
      card = `<div data-card class="cover"><div class="panel">
        <div class="top">${chip(c.chip)}</div>
        <div class="mid" data-region>
          <h1 class="title" data-slot="headline" data-max-lines="2">${textToHtml(c.headline)}</h1>
          ${c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : ''}
        </div></div>${handle}</div>`;
    else if (c.kind === 'body')
      card = `<div data-card class="body"><div class="panel">
        <div class="top">${chip(c.chip)}<span class="pg" data-box="page">${c.page} / ${c.total}</span></div>
        <div class="mid" data-region>
          <h2 class="title" data-slot="title" data-max-lines="2">${textToHtml(c.title)}</h2>
          <div class="txt" data-slot="text">${textToHtml(c.text)}</div>
        </div></div>${handle}</div>`;
    else if (c.kind === 'closing')
      card = `<div data-card class="closing"><div class="panel"><div class="mid" data-region>
        <h2 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h2>
        ${c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : look.handle ? `<div class="sub" data-slot="handle" data-max-lines="1">@${esc(look.handle)}</div>` : ''}
      </div></div></div>`;
    else
      card = `<div data-card class="reel"><div class="panel" data-region>
        <div>${chip(c.chip)}</div>
        <h1 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h1>
      </div></div>`;
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css(look, s, width, height)}</style></head><body>${card}</body></html>`;
  },
};
