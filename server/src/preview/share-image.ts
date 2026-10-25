// 「30일 뒤 내 계정」 공유 이미지 (FR-BR-7 · 결정 2026-10-24): 미리보기 화면을 스토리 크기(1080×1920) PNG 한 장으로.
// 프로필 머리 + 격자 9칸 + 작은 「FirstFeed로 만든 30일 계획」. 모양은 미리보기 화면 · 소개 페이지의 다크 폰 프로필(2026-10-25 · 팔로워 · 팔로잉 「–」). 격자는 화면과 같은 구성(composeGrid)·같은 가림(render.safeArea.feed)·
// 같은 계획 칸 표지(planCover)이고, **계획 칸의 「계획」 배지는 그대로 남긴다** — 밖으로 나가는 그림이라 더욱, 만들지 않은 게시물을
// 만든 것처럼 보이면 안 된다(결정 2026-10-21). 팔로워 같은 없는 숫자는 쓰지 않는다.
// 그리기는 카드와 같은 렌더링 경로(renderCard: 앱에 넣은 글꼴 확인 · 글 칸 넘침 측정 · 바깥 요청 차단)라, 바이오가 넘치면 PNG 를 만들지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { assetPath } from '../brand/assets.ts';
import { currentSelection, latestKit } from '../brand/store.ts';
import type { VisualCandidates } from '../brand/types.ts';
import { draftById } from '../templates/index.ts';
import { avatarSwatch, highlightSwatches, type Swatch } from './swatches.ts';
import { listSets, rendersDir } from '../cards/store.ts';
import { getSetting } from '../config.ts';
import { activeProfile } from '../identity/store.ts';
import { fontFaceCss } from '../render/fonts-css.ts';
import { renderCard, type RenderProblem } from '../render/render.ts';
import { FRAME_SIZE } from '../templates/types.ts';
import { fixedTemplate } from '../templates/store.ts';
import { planCover, previewDir } from './covers.ts';
import { latestPlan } from './plan.ts';
import { composeGrid } from './compose-grid.ts';
import { homeMarks } from '../home/marks.ts';

export const SHARE_SIZE = { width: 1080, height: 1920 };
const FONT = { id: 'pretendard', family: 'Pretendard' };

export interface ShareCell {
  kind: 'made' | 'plan' | 'empty';
  /** 칸 상태(FR-HM-4) — 올림은 사용자가 「올렸어요」로 표시한 것 */
  state: 'plan' | 'made' | 'posted' | null;
  /** 표지 그림(data: 주소). 계획 칸 표지를 못 그렸으면 없음 → 제목 글자 자리표시 */
  img: string | null;
  title: string | null;
}
export interface ShareView {
  handle: string | null;
  displayName: string | null;
  bio: string | null;
  avatar: { img: string } | { initial: string; bg: string; fg: string } | null;
  /** 하이라이트 원(2026-10-25): 축 색 원 + 축 이름 첫 글자 — 미리보기 화면과 같은 함수(swatches.ts) */
  highlights: Array<Swatch & { label: string }>;
  made: number;
  plan: number;
  posted: number;
  cells: ShareCell[];
  /** 카드 크기와 격자 가림 — 화면(grid.ts cellBox)과 같은 비율로 자른다 */
  card: { width: number; height: number };
  safe: { x: number; y: number; w: number; h: number };
  accent: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const dataUri = (file: string) => `data:image/${path.extname(file).slice(1).replace('jpg', 'jpeg')};base64,${fs.readFileSync(file).toString('base64')}`;
const plain = (t: string) => t.replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim();

/** 화면에 보이는 미리보기와 같은 값을 모은다. 계획 칸 표지가 아직 없으면 화면과 같은 경로로 그린다(AI 없음) */
export async function shareView(db: DatabaseSync, dataDir: string, brandId: number): Promise<ShareView> {
  const profile = activeProfile(db, brandId);
  const sel = currentSelection(db, brandId);
  const plan = latestPlan(db, brandId);
  const made = listSets(db, brandId);
  const names = new Map((profile?.pillars ?? []).map((p) => [p.id, p.name]));
  const grid = composeGrid(made, plan?.slots ?? [], names, getSetting(db, 'preview.gridCells'), homeMarks(db, brandId));
  const cells: ShareCell[] = [];
  for (const c of grid) {
    if (c.kind === 'empty') cells.push({ kind: 'empty', state: null, img: null, title: null });
    else if (c.kind === 'made') {
      const p = path.join(rendersDir(dataDir, c.setId), '01-cover.png');
      cells.push({ kind: 'made', state: c.state, img: fs.existsSync(p) ? dataUri(p) : null, title: plain(c.headline) });
    } else {
      const r = await planCover(db, dataDir, brandId, c.slot);
      cells.push({ kind: 'plan', state: c.state, img: r.ok ? dataUri(path.join(previewDir(dataDir), r.file)) : null, title: c.title });
    }
  }
  const fixed = fixedTemplate(db, brandId);
  const look = fixed?.look.palette ?? (sel.palette ? { name: sel.palette.name, ...sel.palette.colors } : null);
  const photo = sel.profileImage ? assetPath(dataDir, sel.profileImage) : null;
  const name = sel.displayName ?? sel.handle;
  const av = look ? avatarSwatch(name, look) : null;
  const labels = (latestKit<VisualCandidates>(db, brandId, 'visual')?.candidates.imagePrompts ?? []).filter((x) => x.target === 'highlight').map((x) => x.label);
  return {
    handle: sel.handle,
    displayName: sel.displayName,
    bio: sel.bio,
    avatar: photo ? { img: dataUri(photo) } : av ? { initial: av.mark, bg: av.bg, fg: av.fg } : null,
    highlights: look ? highlightSwatches(labels, look, draftById(fixed?.draftId ?? '')?.id ?? null, getSetting(db, 'render.pillarCoverVariant'), (profile?.pillars ?? []).map((x) => x.name)) : [],
    made: cells.filter((c) => c.kind === 'made').length,
    plan: cells.filter((c) => c.kind === 'plan').length,
    posted: cells.filter((c) => c.state === 'posted').length,
    cells,
    card: { width: FRAME_SIZE.cover.width, height: FRAME_SIZE.cover.height },
    safe: getSetting(db, 'render.safeArea').feed,
    accent: look?.primary ?? '#15161a',
  };
}

/** 공유 이미지 HTML — [data-card] 루트, 넘치면 안 되는 글은 [data-slot](renderCard 의 측정 약속) */
export function shareHtml(v: ShareView): string {
  const imgW = (v.card.width / v.safe.w) * 100;
  const imgLeft = -(v.safe.x / v.safe.w) * 100;
  const cell = (c: ShareCell) => {
    const inner =
      c.kind === 'empty'
        ? ''
        : c.img
          ? `<img src="${c.img}" alt="">`
          : `<div class="ph">${esc(c.title ?? '')}</div>`;
    // 배지(FR-HM-4): 계획 칸은 「계획」, 사용자가 올렸다고 표시한 칸은 「올림」, 만든 칸은 없음
    const badge = c.state === 'posted' ? '올림' : c.kind === 'plan' ? '계획' : null;
    return `<div class="cell ${c.kind}${c.state === 'posted' ? ' posted' : ''}">${inner}${badge ? `<span class="badge" data-badge>${badge}</span>` : ''}</div>`;
  };
  const avatar = !v.avatar
    ? '<div class="avatar empty"></div>'
    : 'img' in v.avatar
      ? `<div class="avatar"><img src="${v.avatar.img}" alt=""></div>`
      : `<div class="avatar" style="background:${esc(v.avatar.bg)};color:${esc(v.avatar.fg)}">${esc(v.avatar.initial)}</div>`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
${fontFaceCss([FONT.id])}
*{box-sizing:border-box}
html,body{margin:0;width:${SHARE_SIZE.width}px;height:${SHARE_SIZE.height}px;overflow:hidden}
body{font-family:'${FONT.family}';background:#0e1116;color:#f2f3f5;word-break:keep-all}
[data-card]{position:relative;width:100%;height:100%;display:flex;flex-direction:column;padding:44px 0 0}
.head{display:flex;gap:40px;align-items:center;padding:0 56px}
.avatar{width:168px;height:168px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:72px;font-weight:700;overflow:hidden;box-shadow:0 0 0 4px #0e1116,0 0 0 7px #3a3f48}
.avatar.empty{background:#22262d}
.avatar img{width:100%;height:100%;object-fit:cover}
.who{min-width:0;flex:1}
.handle{font-size:46px;font-weight:700;white-space:nowrap;overflow:hidden}
.name{font-size:32px;font-weight:600;margin-top:6px;white-space:nowrap;overflow:hidden}
.stats{display:flex;gap:32px;margin-top:10px;font-size:24px;color:#c9ccd2;white-space:nowrap}
.stats b{font-size:28px;color:#f2f3f5;margin-right:6px}
.counts{font-size:22px;color:#9ea3ab;margin-top:4px}
.counts b{color:#f2f3f5;font-weight:600}
/* 머리 칸이 줄어들지 않게(flex:none) — 넘치면 넘침으로 재야 PNG 를 막는다. 바이오 5줄까지 들어가게 맞춘 크기 */
.bio{flex:none;font-size:27px;line-height:1.45;white-space:pre-line;padding:24px 56px 0;max-height:${Math.round(27 * 1.45 * 5) + 24}px;overflow:hidden}
.head,.foot,.grid{flex:none}
.hls{flex:none;display:flex;gap:30px;padding:22px 56px 0}
.hl{display:flex;flex-direction:column;align-items:center;gap:8px;width:96px;font-size:20px;color:#c9ccd2;text-align:center}
.hl span{width:76px;height:76px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:700;box-shadow:0 0 0 3px #0e1116,0 0 0 5px #3a3f48}
.hl em{font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px}
/* 격자 양옆 여백 56px — 하이라이트 줄을 더하고도 바이오 5줄이 들어가게(테스트로 확인) */
.grid{margin-top:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:3px;padding:0 56px}
.cell{position:relative;aspect-ratio:${v.safe.w} / ${v.card.height};overflow:hidden;background:#171a20}
.cell img{position:absolute;top:0;height:100%;width:${imgW}%;left:${imgLeft}%;object-fit:cover}
.cell.plan::after{content:'';position:absolute;inset:0;border:3px dashed #9ea3ab;pointer-events:none}
.ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font-size:28px;font-weight:700;color:#9ea3ab;overflow:hidden}
.badge{position:absolute;z-index:1;right:12px;top:12px;font-size:24px;font-weight:700;padding:4px 14px;border-radius:999px;background:rgba(255,255,255,.94);color:#15161a;box-shadow:0 0 0 2px rgba(0,0,0,.25)}
.foot{display:flex;justify-content:space-between;align-items:center;padding:22px 32px 28px;font-size:24px;color:#9ea3ab}
.foot b{color:#f2f3f5}
</style></head><body><div data-card>
<div class="head">${avatar}<div class="who">
<div class="handle" data-slot="handle" data-max-lines="1">${esc(v.handle ?? '아이디 정하기 전')}</div>
${v.displayName ? `<div class="name" data-slot="name" data-max-lines="1">${esc(v.displayName)}</div>` : ''}
<div class="stats"><div><b>${v.made + v.plan}</b>게시물</div><div><b>–</b>팔로워</div><div><b>–</b>팔로잉</div></div>
<div class="counts" data-slot="counts" data-max-lines="1">만든 카드 <b>${v.made}</b> · 계획 <b>${v.plan}</b>${v.posted ? ` · 올림 <b>${v.posted}</b>` : ''}</div>
</div></div>
${v.bio ? `<div class="bio" data-slot="bio" data-max-lines="5">${esc(v.bio)}</div>` : ''}
${v.highlights.length ? `<div class="hls">${v.highlights.map((h) => `<div class="hl"><span style="background:${esc(h.bg)};color:${esc(h.fg)}">${esc(h.mark)}</span><em>${esc(h.label)}</em></div>`).join('')}</div>` : ''}
<div class="grid">${v.cells.map(cell).join('')}</div>
<div class="foot"><span><b>FirstFeed</b>로 만든 30일 계획</span><span>「계획」 칸은 아직 만들지 않은 게시물</span></div>
</div></body></html>`;
}

export type ShareImage = { ok: true; png: Buffer; view: ShareView; warnings: RenderProblem[] } | { ok: false; reason: string; problems: RenderProblem[] };

/**
 * 대체 글꼴은 경고만 — 카드와 다른 점. 카드는 기계마다 같은 줄바꿈(넘침 측정)이 나와야 해서 막지만, 이 그림은 프로필 화면을 옮긴 것이라
 * 사용자가 바이오에 쓴 기호(예: 「▸」 — 앱에 넣은 8개 글꼴 어디에도 없음, 2026-10-24 확인)를 그대로 보이는 쪽이 맞다(인스타도 기기 글꼴로 보인다).
 * 넘침 · 줄 수는 그대로 막는다
 */
export async function shareImage(db: DatabaseSync, dataDir: string, brandId: number): Promise<ShareImage> {
  const view = await shareView(db, dataDir, brandId);
  const r = await renderCard(db, { html: shareHtml(view), ...SHARE_SIZE, captureEvenIfBad: true, allowFontFallback: true });
  const blocking = r.problems.filter((p) => p.code !== 'font_fallback');
  if (blocking.length || !r.png) return { ok: false, reason: blocking[0]?.message ?? '이미지를 그리지 못했어요.', problems: blocking };
  return { ok: true, png: r.png, view, warnings: r.problems.filter((p) => p.code === 'font_fallback') };
}
