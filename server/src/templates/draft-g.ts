// 시안 G · 체크 무늬 판 — 주색 바탕에 옅은 체크 무늬, 그 위에 바탕색 판 한 장. 글은 늘 판 안(글자 · 바탕 짝 4.5:1 보장).
// 무늬 색은 주색과 바탕색을 섞은 것(팔레트 밖 색을 지어내지 않는다). 본문 카드에 사진 칸이 있다 — 사진이 없으면 글만 판 안에.
// 참고: 사용자가 보내 준 카드뉴스 템플릿 파일(muv.vv, 재배포 금지)의 「무늬 바탕 + 판 + 작은 배지」 구성만 참고했고 그림 · 무늬 파일은 옮기지 않았다
import { accentOn, baseCss, esc, inkOn, markCss, mix, photoBox, weight } from './base.ts';
import { textToHtml } from './text.ts';
import { FRAME_SIZE, type BrandLook, type Draft, type FrameContent, type PhotoOpts } from './types.ts';

function css(look: BrandLook, s: number, w: number, h: number): string {
  const p = look.palette;
  const ink = inkOn(p.primary, look);
  const acc = accentOn(p.background, look) ?? p.text;
  const tile = mix(p.primary, p.background, 0.16);
  return `${baseCss(look, w, h)}
[data-card]{background:repeating-conic-gradient(${p.primary} 0 25%, ${tile} 0 50%) 0 0/96px 96px;padding:60px}
.panel{flex:1;min-height:0;display:flex;flex-direction:column;background:${p.background};color:${p.text};border-radius:28px;padding:64px 60px;
  outline:6px solid ${p.background};outline-offset:12px}
${markCss(p.background, look)}
.top{display:flex;justify-content:space-between;align-items:center;flex:none;gap:24px}
.chip{display:inline-block;white-space:nowrap;border-radius:12px;padding:12px 22px;font-size:${Math.round(26 * s)}px;font-weight:${weight(look.bodyFont, 700)};line-height:1;background:${acc};color:${p.background}}
.pg{font-size:26px;font-weight:${weight(look.bodyFont, 700)};opacity:.5;white-space:nowrap}
.hd{font-size:26px;font-weight:${weight(look.bodyFont, 700)};opacity:.6;white-space:nowrap}
.mid{flex:1;display:flex;flex-direction:column;justify-content:flex-end}
.outside{flex:none;color:${ink};font-size:28px;font-weight:${weight(look.bodyFont, 700)};padding-top:34px;text-align:center;white-space:nowrap}
/* 표지 — 제목은 판 아래쪽, 아주 두껍게 */
.cover h1{font-size:${Math.round(90 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.14;letter-spacing:-.03em}
.cover .sub{margin-top:26px;font-size:${Math.round(34 * s)}px;line-height:1.45;opacity:.75}
/* 본문 — 사진이 있으면 판 위쪽을 사진이 채우고 글은 아래 */
.body .mid{justify-content:center}
.body .photo{flex:none;height:500px;border-radius:20px;background:${p.secondary} center/cover no-repeat;margin-bottom:44px}
.body.has-photo .mid{justify-content:flex-start;padding-top:36px}
.body h2{font-size:${Math.round(58 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.24;letter-spacing:-.02em;margin-bottom:30px}
.body .txt{font-size:${Math.round(36 * s)}px;line-height:1.68;opacity:.85}
.body.has-photo h2{font-size:${Math.round(52 * s)}px;margin-bottom:22px}
.body.has-photo .txt{font-size:${Math.round(34 * s)}px;line-height:1.6}
/* 마무리 */
.closing .mid{justify-content:center;align-items:center;text-align:center}
.closing h2{font-size:${Math.round(76 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.2;margin-bottom:30px}
.closing .sub{font-size:${Math.round(36 * s)}px;opacity:.7}
/* 릴스 표지 — 판은 격자에 남는 가운데 3:4 안쪽 */
.reel{padding:0 60px}
.reel .panel{flex:none;height:1240px;margin:340px 0;justify-content:center;align-items:center;text-align:center}
.reel .mid{flex:none;justify-content:center;align-items:center}
.reel h1{font-size:${Math.round(118 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.06;letter-spacing:-.04em;margin-top:34px}
.reel .chip{font-size:${Math.round(38 * s)}px;padding:18px 34px}
`;
}

export const draftG: Draft = {
  id: 'G',
  name: '체크 무늬 판',
  description: '주색 체크 무늬 위에 바탕색 판 한 장, 제목은 판 아래쪽에 두껍게. 본문 카드에 사진 칸(없으면 글만)',
  bodyPhoto: true,
  html(look: BrandLook, c: FrameContent, s: number, photo?: PhotoOpts): string {
    const { width, height } = FRAME_SIZE[c.kind];
    const chip = (t: string | null | undefined) => (t ? `<span class="chip" data-slot="chip" data-max-lines="1">${esc(t)}</span>` : '<span></span>');
    const handle = look.handle ? `<div class="outside" data-box="handle">@${esc(look.handle)}</div>` : '';
    const hd = look.handle ? `<span class="hd" data-box="handle-top">@${esc(look.handle)}</span>` : '';
    let card: string;
    if (c.kind === 'cover')
      card = `<div data-card class="cover"><div class="panel">
        <div class="top">${chip(c.chip)}${hd}</div>
        <div class="mid" data-region>
          <h1 class="title" data-slot="headline" data-max-lines="2">${textToHtml(c.headline)}</h1>
          ${c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : ''}
        </div></div></div>`;
    else if (c.kind === 'body') {
      const pic = photoBox(photo?.background);
      card = `<div data-card class="body${pic ? ' has-photo' : ''}"><div class="panel">
        <div class="top">${chip(c.chip)}<span class="pg" data-box="page">${c.page} / ${c.total}</span></div>
        <div class="mid" data-region>
          ${pic}
          <h2 class="title" data-slot="title" data-max-lines="2">${textToHtml(c.title)}</h2>
          <div class="txt" data-slot="text">${textToHtml(c.text)}</div>
        </div></div>${handle}</div>`;
    } else if (c.kind === 'closing')
      card = `<div data-card class="closing"><div class="panel"><div class="mid" data-region>
        <h2 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h2>
        ${c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : look.handle ? `<div class="sub" data-slot="handle" data-max-lines="1">@${esc(look.handle)}</div>` : ''}
      </div></div></div>`;
    else
      card = `<div data-card class="reel"><div class="panel"><div class="mid" data-region>
        <div>${chip(c.chip)}</div>
        <h1 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h1>
      </div></div></div>`;
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css(look, s, width, height)}</style></head><body>${card}</body></html>`;
  },
};
