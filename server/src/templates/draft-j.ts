// 시안 J · 겹친 액자 — 바탕색에서 보조색 쪽으로 옅어지는 그라데이션, 본문은 강조색 판 위에 비스듬히 겹친 사진 액자.
// 그라데이션 끝색은 글자와 4.5:1 이 남는 데까지만 섞는다(tintFor — 팔레트 규칙은 글자 · 바탕 짝만 보장하므로).
// 사진이 없으면 액자 자리에 설명 글이 겹친 판 위에 온다. 참고: muv.vv 카드뉴스 템플릿(재배포 금지)의 「겹친 사진 두 장」 구성만
import { accentOn, baseCss, esc, markCss, photoBox, tintFor, weight } from './base.ts';
import { textToHtml } from './text.ts';
import { FRAME_SIZE, type BrandLook, type Draft, type FrameContent, type PhotoOpts } from './types.ts';

function css(look: BrandLook, s: number, w: number, h: number): string {
  const p = look.palette;
  const acc = accentOn(p.background, look) ?? p.text;
  const end = tintFor(p.background, p.secondary, p.text, 0.6);
  return `${baseCss(look, w, h)}
[data-card]{background:linear-gradient(165deg, ${p.background} 30%, ${end} 100%);color:${p.text}}
${markCss(end, look)}
.inner{flex:1;display:flex;flex-direction:column;padding:80px}
.mid{flex:1;display:flex;flex-direction:column}
.top{display:flex;justify-content:space-between;align-items:center;flex:none}
.chip{display:inline-block;white-space:nowrap;border-radius:999px;padding:12px 24px;font-size:${Math.round(26 * s)}px;font-weight:${weight(look.bodyFont, 700)};line-height:1;border:3px solid ${p.text}}
.pg{font-size:26px;font-weight:${weight(look.bodyFont, 700)};opacity:.5;white-space:nowrap}
.hd{font-size:28px;font-weight:${weight(look.bodyFont, 700)};opacity:.65;white-space:nowrap}
/* 표지 */
.cover .mid{justify-content:flex-end}
.cover .inner{padding:84px 76px 104px}
.cover h1{font-size:${Math.round(96 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.12;letter-spacing:-.035em}
.cover .sub{margin-top:28px;font-size:${Math.round(34 * s)}px;line-height:1.45;opacity:.78}
.cover .line{height:6px;width:100%;background:${p.text};opacity:.85;margin-bottom:44px;flex:none}
/* 본문 — 겹친 액자: 뒤 판(강조색)이 비스듬히, 그 위에 사진 */
.body .frame{position:relative;flex:none;height:560px;margin:56px 24px 52px}
.body .frame .back{position:absolute;inset:0;background:${acc};border-radius:26px;transform:rotate(-3.5deg) translate(-14px,12px)}
.body .frame .photo{position:absolute;inset:0;border-radius:26px;background:${p.secondary} center/cover no-repeat;transform:rotate(1.5deg);border:10px solid ${p.background}}
.body h2{font-size:${Math.round(56 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.22;letter-spacing:-.02em;margin-bottom:24px}
.body .txt{font-size:${Math.round(34 * s)}px;line-height:1.6;opacity:.85}
.body.no-photo .mid{justify-content:center}
.body.no-photo .sheet{position:relative;margin:0 12px}
.body.no-photo .sheet .back{position:absolute;inset:0;background:${acc};border-radius:26px;transform:rotate(-2.5deg)}
.body.no-photo .sheet .front{position:relative;background:${p.background};border-radius:26px;padding:60px 56px}
.body.no-photo h2{font-size:${Math.round(60 * s)}px;margin-bottom:30px}
.body.no-photo .txt{font-size:${Math.round(36 * s)}px;line-height:1.68}
/* 마무리 */
.closing .mid{justify-content:center;align-items:center;text-align:center}
.closing h2{font-size:${Math.round(78 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.2;margin-bottom:30px}
.closing .sub{font-size:${Math.round(36 * s)}px;opacity:.75}
/* 릴스 표지 */
.reel .inner{justify-content:center;align-items:center;text-align:center;padding:0 64px}
.reel .mid{flex:none;align-items:center}
.reel h1{font-size:${Math.round(124 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.06;letter-spacing:-.05em;margin-top:32px}
.reel .chip{font-size:${Math.round(38 * s)}px;padding:16px 34px}
`;
}

export const draftJ: Draft = {
  id: 'J',
  name: '겹친 액자',
  description: '바탕색에서 보조색으로 옅어지는 그라데이션. 본문은 강조색 판 위에 비스듬히 겹친 사진 액자(사진이 없으면 겹친 판 위 설명)',
  bodyPhoto: true,
  html(look: BrandLook, c: FrameContent, s: number, photo?: PhotoOpts): string {
    const { width, height } = FRAME_SIZE[c.kind];
    const chip = (t: string | null | undefined) => (t ? `<span class="chip" data-slot="chip" data-max-lines="1">${esc(t)}</span>` : '<span></span>');
    const hd = look.handle ? `<span class="hd" data-box="handle-top">@${esc(look.handle)}</span>` : '<span></span>';
    let card: string;
    if (c.kind === 'cover')
      card = `<div data-card class="cover"><div class="inner">
        <div class="top">${chip(c.chip)}${hd}</div>
        <div class="mid" data-region>
          <div class="line"></div>
          <h1 class="title" data-slot="headline" data-max-lines="2">${textToHtml(c.headline)}</h1>
          ${c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : ''}
        </div></div></div>`;
    else if (c.kind === 'body') {
      const pic = photoBox(photo?.background);
      const words = `<h2 class="title" data-slot="title" data-max-lines="2">${textToHtml(c.title)}</h2>
          <div class="txt" data-slot="text">${textToHtml(c.text)}</div>`;
      card = `<div data-card class="body${pic ? '' : ' no-photo'}"><div class="inner">
        <div class="top">${chip(c.chip)}<span class="pg" data-box="page">${c.page} / ${c.total}</span></div>
        <div class="mid" data-region>
          ${pic ? `<div class="frame"><div class="back"></div>${pic}</div>${words}` : `<div class="sheet"><div class="back"></div><div class="front">${words}</div></div>`}
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
