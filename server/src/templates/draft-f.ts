// 시안 F · 그림 바탕 표지 (결정 2026-10-18 · 그림 바탕 표지, FR-MK-8 되돌림).
// 운영 계정 게시물 구성: 그림이 카드 전체를 채우고 왼쪽 아래에 배지(칩) · 큰 제목(강조 한 줄) · 작은 안내문(부제).
// 표지·릴스 표지만 그림을 깐다. 본문·마무리는 시안 A 글자 틀 그대로.
// - 그림 위 글자: 아래쪽 어두운 그라데이션(진하기 shade). 실제로 그린 PNG 에서 글자 뒤 명암비를 재서 모자라면 진하게 다시 그린다(photo-frame.ts)
// - 그림이 없으면 브랜드 주색 단색 바탕 — 표지 후보는 그림 프롬프트가 나오기 전에 그려지므로(결정)
// - 배지·제목·안내문은 모두 글 칸(data-slot)이라 격자 안전 영역 검사(feed 좌우 34px · reel 위아래 240px)를 그대로 받는다
import { contrastRatio } from '../brand/limits.ts';
import { baseCss, esc, inkOn, weight } from './base.ts';
import { draftA } from './draft-a.ts';
import { textToHtml } from './text.ts';
import { FRAME_SIZE, type BrandLook, type Draft, type FrameContent, type PhotoOpts } from './types.ts';

const WHITE = '#FFFFFF';

/** 그림 위 강조 글자색: 팔레트 중 검정과 가장 대비가 큰 색이 4.5:1 이상이면 그 색, 아니면 흰 글자 + 주색 밑줄 띠 (팔레트 밖 색을 지어내지 않는다) */
function photoMark(look: BrandLook): string {
  const p = look.palette;
  const best = [p.accent, p.primary, p.secondary].sort((a, b) => contrastRatio(b, '#000000') - contrastRatio(a, '#000000'))[0]!;
  if (contrastRatio(best, '#000000') >= 4.5) return `.mk{color:${best}}`;
  return `.mk{background:linear-gradient(transparent 80%, ${p.primary} 80%, ${p.primary} 94%, transparent 94%)}`;
}

function css(look: BrandLook, s: number, w: number, h: number, o: PhotoOpts): string {
  const p = look.palette;
  const photo = !!o.background;
  const fg = photo ? WHITE : inkOn(p.primary, look);
  const shade = Math.min(1, Math.max(0, o.shade ?? 0));
  return `${baseCss(look, w, h)}
[data-card]{background:${p.primary};color:${fg}}
.bg{position:absolute;inset:0;background:#000 url("${o.background ?? ''}") center/cover no-repeat}
/* 아래에서 위로 옅어지는 어두운 띠 — 글자가 있는 아래쪽 40% 는 같은 진하기 */
.shade{position:absolute;inset:0;background:linear-gradient(to top, rgba(0,0,0,${shade}) 0%, rgba(0,0,0,${shade}) 40%, rgba(0,0,0,0) 78%)}
.inner{position:relative;flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start;padding:0 76px 96px}
.chip{display:inline-block;white-space:nowrap;border-radius:999px;padding:14px 28px;font-size:${Math.round(26 * s)}px;font-weight:${weight(look.bodyFont, 700)};
  line-height:1;background:${photo ? p.primary : p.background};color:${inkOn(photo ? p.primary : p.background, look)}}
h1{font-size:${Math.round(92 * s)}px;font-weight:${weight(look.titleFont, 800)};line-height:1.16;letter-spacing:-.03em;margin-top:30px}
.sub{margin-top:24px;font-size:${Math.round(32 * s)}px;line-height:1.45;font-weight:${weight(look.bodyFont, 500)}}
${photo ? photoMark(look) : `.mk{text-decoration:underline;text-decoration-thickness:.08em;text-underline-offset:.12em}`}
/* 릴스 표지: 격자가 위아래 240px 를 자른다 — 아래 여백을 그만큼 더 */
.reel .inner{padding:0 80px 336px}
.reel h1{font-size:${Math.round(112 * s)}px;line-height:1.08}
.reel .chip{font-size:${Math.round(34 * s)}px;padding:18px 34px}
`;
}

export const draftF: Draft = {
  id: 'F',
  name: '그림 바탕 표지',
  description: '표지·릴스 표지는 올린 그림을 꽉 채워 깔고 왼쪽 아래에 배지·큰 제목·안내문. 그림이 없으면 주색 단색. 본문·마무리는 시안 A',
  html(look: BrandLook, c: FrameContent, s: number, o: PhotoOpts = {}): string {
    if (c.kind === 'body' || c.kind === 'closing') return draftA.html(look, c, s);
    const { width, height } = FRAME_SIZE[c.kind];
    const photo = o.background ? `<div class="bg"></div><div class="shade"></div>` : '';
    // data-on-photo: 그림 위에 올라가는 글 칸 — 렌더링이 이 칸들의 글자 뒤 명암비를 잰다
    const on = o.background ? ' data-on-photo' : '';
    const chip = c.chip ? `<span class="chip" data-slot="chip" data-max-lines="1">${esc(c.chip)}</span>` : '';
    const sub = c.kind === 'cover' && c.sub ? `<div class="sub" data-slot="sub" data-max-lines="2"${on}>${textToHtml(c.sub)}</div>` : '';
    const card = `<div data-card class="${c.kind === 'cover' ? 'cover' : 'reel'}">${photo}<div class="inner" data-region>
        ${chip}
        <h1 class="title" data-slot="headline" data-max-lines="3"${on}>${textToHtml(c.headline)}</h1>
        ${sub}
      </div></div>`;
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css(look, s, width, height, o)}</style></head><body>${card}</body></html>`;
  },
};
