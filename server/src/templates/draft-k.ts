// 시안 K · 위아래 나눔 + 팔로우 마무리 — 표지는 위쪽 주색 면에 큰 제목, 아래 바탕색 띠에 부제와 아이디.
// 본문은 위쪽 주색 띠에 제목, 아래에 설명. 마무리는 프로필 동그라미 + 아이디 + 「팔로우」 모양 단추(브랜드 주색 — 인스타 화면을 흉내 내지 않는다).
// 단추 글자는 「팔로우」 한 낱말만 고정 — 약속(「다음 편」 등)을 지어내지 않으려고. 참고: muv.vv 카드뉴스 템플릿(재배포 금지)의 「아이디 + 팔로우 마무리」 구성만
import { accentOn, baseCss, esc, inkOn, markCss, weight } from './base.ts';
import { textToHtml } from './text.ts';
import { FRAME_SIZE, type BrandLook, type Draft, type FrameContent } from './types.ts';

function css(look: BrandLook, s: number, w: number, h: number): string {
  const p = look.palette;
  const ink = inkOn(p.primary, look);
  const acc = accentOn(p.background, look) ?? p.text;
  return `${baseCss(look, w, h)}
[data-card]{background:${p.background};color:${p.text}}
${markCss(p.background, look)}
.band{background:${p.primary};color:${ink};display:flex;flex-direction:column}
.band .mk{color:inherit;background:none;text-decoration:underline;text-decoration-thickness:.1em;text-underline-offset:.14em}
.chip{display:inline-block;white-space:nowrap;border-radius:999px;padding:12px 24px;font-size:${Math.round(26 * s)}px;font-weight:${weight(look.bodyFont, 700)};line-height:1;background:${p.background};color:${p.text}}
.pg{font-size:26px;font-weight:${weight(look.bodyFont, 700)};opacity:.7;white-space:nowrap}
.top{display:flex;justify-content:space-between;align-items:center;flex:none}
.mid{display:flex;flex-direction:column}
/* 표지 */
.cover .band{flex:0 0 820px;padding:76px 76px 64px}
.cover .band .mid{flex:1;justify-content:flex-end}
.cover h1{font-size:${Math.round(96 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.12;letter-spacing:-.035em}
.cover .rest{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-between;padding:56px 76px 96px}
.cover .sub{font-size:${Math.round(36 * s)}px;line-height:1.45}
.cover .hd{font-size:30px;font-weight:${weight(look.bodyFont, 700)};color:${acc};white-space:nowrap}
/* 본문 */
.body .band{flex:none;padding:72px 80px 56px}
.body h2{font-size:${Math.round(60 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.22;letter-spacing:-.02em;margin-top:40px}
.body .rest{flex:1;min-height:0;display:flex;flex-direction:column;padding:64px 80px 80px}
.body .txt{font-size:${Math.round(37 * s)}px;line-height:1.7;opacity:.88}
/* 마무리 — 프로필 + 팔로우 단추 */
.closing{justify-content:center;align-items:center;text-align:center;padding:0 80px}
.closing .mid{align-items:center}
.closing h2{font-size:${Math.round(78 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.2;margin-bottom:28px}
.closing .sub{font-size:${Math.round(36 * s)}px;opacity:.75}
.pill{display:flex;align-items:center;gap:22px;margin-top:64px;padding:18px 18px 18px 18px;border:3px solid color-mix(in srgb, ${p.text} 18%, transparent);border-radius:999px;flex:none}
.av{width:84px;height:84px;border-radius:50%;background:${p.primary} center/cover no-repeat;color:${ink};display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:${weight(look.titleFont, 800)};flex:none}
.pill .name{font-size:32px;font-weight:${weight(look.bodyFont, 700)};white-space:nowrap}
.follow{background:${p.primary};color:${ink};border-radius:999px;padding:18px 34px;font-size:30px;font-weight:${weight(look.bodyFont, 700)};white-space:nowrap;line-height:1}
/* 릴스 표지 — 주색 면이 격자에 남는 가운데를 덮게 */
.reel .band{flex:1;justify-content:center;align-items:center;text-align:center;padding:0 64px}
.reel h1{font-size:${Math.round(124 * s)}px;font-weight:${weight(look.titleFont, 900)};line-height:1.06;letter-spacing:-.05em;margin-top:32px}
.reel .chip{font-size:${Math.round(38 * s)}px;padding:16px 34px}
`;
}

export const draftK: Draft = {
  id: 'K',
  name: '위아래 나눔 + 팔로우',
  description: '표지 · 본문은 위쪽 주색 면에 제목, 아래 바탕색에 설명. 마무리는 프로필 동그라미 + 아이디 + 「팔로우」 단추',
  html(look: BrandLook, c: FrameContent, s: number): string {
    const { width, height } = FRAME_SIZE[c.kind];
    const chip = (t: string | null | undefined) => (t ? `<span class="chip" data-slot="chip" data-max-lines="1">${esc(t)}</span>` : '<span></span>');
    let card: string;
    if (c.kind === 'cover')
      card = `<div data-card class="cover">
        <div class="band"><div class="top">${chip(c.chip)}</div>
          <div class="mid" data-region><h1 class="title" data-slot="headline" data-max-lines="2">${textToHtml(c.headline)}</h1></div></div>
        <div class="rest">${c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : '<div></div>'}${look.handle ? `<div class="hd" data-box="handle">@${esc(look.handle)}</div>` : ''}</div>
      </div>`;
    else if (c.kind === 'body')
      card = `<div data-card class="body">
        <div class="band"><div class="top">${chip(c.chip)}<span class="pg" data-box="page">${c.page} / ${c.total}</span></div>
          <h2 class="title" data-slot="title" data-max-lines="2">${textToHtml(c.title)}</h2></div>
        <div class="rest" data-region><div class="txt" data-slot="text">${textToHtml(c.text)}</div></div>
      </div>`;
    else if (c.kind === 'closing') {
      const initial = [...(look.displayName ?? look.handle ?? '')][0] ?? '';
      const av = look.profileImage
        ? `<div class="av" style="background-image:url('${look.profileImage.replace(/['"\\)]/g, '')}')"></div>`
        : `<div class="av">${esc(initial.toUpperCase())}</div>`;
      card = `<div data-card class="closing"><div class="mid" data-region>
        <h2 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h2>
        ${c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2">${textToHtml(c.sub)}</div>` : ''}
        </div>
        ${look.handle ? `<div class="pill">${av}<div class="name" data-slot="handle" data-max-lines="1">@${esc(look.handle)}</div><div class="follow" data-box="follow">팔로우</div></div>` : ''}
      </div>`;
    } else
      card = `<div data-card class="reel"><div class="band"><div class="mid" data-region style="align-items:center">
        <div>${chip(c.chip)}</div>
        <h1 class="title" data-slot="headline" data-max-lines="3">${textToHtml(c.headline)}</h1>
      </div></div></div>`;
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css(look, s, width, height)}</style></head><body>${card}</body></html>`;
  },
};
