// 「30일 뒤 내 계정」 공유 이미지 (FR-BR-7 · 결정 2026-10-24): 미리보기 화면을 스토리 크기(1080×1920) PNG 한 장으로.
// 프로필 머리 + 격자 9칸 + 작은 「FirstFeed로 만든 30일 계획」. 격자는 화면과 같은 구성(composeGrid)·같은 가림(render.safeArea.feed)·
// 같은 계획 칸 표지(planCover)이고, **계획 칸의 「계획」 배지는 그대로 남긴다** — 밖으로 나가는 그림이라 더욱, 만들지 않은 게시물을
// 만든 것처럼 보이면 안 된다(결정 2026-10-21). 팔로워 같은 없는 숫자는 쓰지 않는다.
// 그리기는 카드와 같은 렌더링 경로(renderCard: 앱에 넣은 글꼴 확인 · 글 칸 넘침 측정 · 바깥 요청 차단)라, 바이오가 넘치면 PNG 를 만들지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { assetPath } from '../brand/assets.ts';
import { currentSelection } from '../brand/store.ts';
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

export const SHARE_SIZE = { width: 1080, height: 1920 };
const FONT = { id: 'pretendard', family: 'Pretendard' };

export interface ShareCell {
  kind: 'made' | 'plan' | 'empty';
  /** 표지 그림(data: 주소). 계획 칸 표지를 못 그렸으면 없음 → 제목 글자 자리표시 */
  img: string | null;
  title: string | null;
}
export interface ShareView {
  handle: string | null;
  displayName: string | null;
  bio: string | null;
  avatar: { img: string } | { initial: string; bg: string; fg: string } | null;
  made: number;
  plan: number;
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
  const grid = composeGrid(made, plan?.slots ?? [], names, getSetting(db, 'preview.gridCells'));
  const cells: ShareCell[] = [];
  for (const c of grid) {
    if (c.kind === 'empty') cells.push({ kind: 'empty', img: null, title: null });
    else if (c.kind === 'made') {
      const p = path.join(rendersDir(dataDir, c.setId), '01-cover.png');
      cells.push({ kind: 'made', img: fs.existsSync(p) ? dataUri(p) : null, title: plain(c.headline) });
    } else {
      const r = await planCover(db, dataDir, brandId, c.slot);
      cells.push({ kind: 'plan', img: r.ok ? dataUri(path.join(previewDir(dataDir), r.file)) : null, title: c.title });
    }
  }
  const look = fixedTemplate(db, brandId)?.look.palette ?? sel.palette?.colors ?? null;
  const photo = sel.profileImage ? assetPath(dataDir, sel.profileImage) : null;
  const name = sel.displayName ?? sel.handle;
  return {
    handle: sel.handle,
    displayName: sel.displayName,
    bio: sel.bio,
    avatar: photo ? { img: dataUri(photo) } : name && look ? { initial: [...name][0]!, bg: look.primary, fg: look.background } : null,
    made: cells.filter((c) => c.kind === 'made').length,
    plan: cells.filter((c) => c.kind === 'plan').length,
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
    return `<div class="cell ${c.kind}">${inner}${c.kind === 'plan' ? '<span class="badge" data-badge>계획</span>' : ''}</div>`;
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
body{font-family:'${FONT.family}';background:#fff;color:#15161a;word-break:keep-all}
[data-card]{position:relative;width:100%;height:100%;display:flex;flex-direction:column;padding:72px 0 0}
.head{display:flex;gap:40px;align-items:center;padding:0 56px}
.avatar{width:168px;height:168px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:72px;font-weight:700;overflow:hidden;box-shadow:0 0 0 2px #e4e4e7}
.avatar.empty{background:#f1f1f3}
.avatar img{width:100%;height:100%;object-fit:cover}
.who{min-width:0;flex:1}
.handle{font-size:46px;font-weight:700;white-space:nowrap;overflow:hidden}
.name{font-size:32px;font-weight:600;margin-top:6px;white-space:nowrap;overflow:hidden}
.counts{font-size:28px;color:#5a5c63;margin-top:14px}
.counts b{color:#15161a}
.bio{font-size:29px;line-height:1.45;white-space:pre-line;padding:28px 56px 0;max-height:${Math.round(29 * 1.45 * 5) + 28}px;overflow:hidden}
.grid{margin-top:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:0 24px}
.cell{position:relative;aspect-ratio:${v.safe.w} / ${v.card.height};overflow:hidden;background:#f1f1f3}
.cell img{position:absolute;top:0;height:100%;width:${imgW}%;left:${imgLeft}%;object-fit:cover}
.cell.plan::after{content:'';position:absolute;inset:0;border:3px dashed rgba(21,22,26,.45);pointer-events:none}
.ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font-size:28px;font-weight:700;color:#5a5c63;overflow:hidden}
.badge{position:absolute;z-index:1;right:12px;top:12px;font-size:24px;font-weight:700;padding:4px 14px;border-radius:999px;background:rgba(255,255,255,.94);color:#15161a;box-shadow:0 0 0 2px rgba(0,0,0,.25)}
.foot{display:flex;justify-content:space-between;align-items:center;padding:22px 32px 28px;font-size:24px;color:#5a5c63}
.foot b{color:${esc(v.accent)}}
</style></head><body><div data-card>
<div class="head">${avatar}<div class="who">
<div class="handle" data-slot="handle" data-max-lines="1">${esc(v.handle ?? '아이디 정하기 전')}</div>
${v.displayName ? `<div class="name" data-slot="name" data-max-lines="1">${esc(v.displayName)}</div>` : ''}
<div class="counts" data-slot="counts" data-max-lines="1">만든 카드 <b>${v.made}</b> · 계획 <b>${v.plan}</b></div>
</div></div>
${v.bio ? `<div class="bio" data-slot="bio" data-max-lines="5">${esc(v.bio)}</div>` : ''}
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
