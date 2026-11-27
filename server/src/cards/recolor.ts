// 표지만 다시 그리기 (결정 2026-11-04 · 표지 색 다시 맞추기). AI 를 부르지 않고 저장된 표지 원고를 그 세트의 템플릿 판으로 다시 그린다.
// - 그림 바탕 표지에 그림 올리기(cover-image.ts)와 같은 길
// - 「표지 색 다시 맞추기」: 표지 바탕색 규칙(render.coverColorRule)이 바뀌었거나, 세트를 칸에 이어 게시 순번 홀짝이 바뀌었거나,
//   규칙이 생기기 전에 만든 세트의 표지를 지금 규칙의 색으로. 지금 색과 같으면 다시 그리지 않는다(카드 render 기록의 tone 으로 비교)
// 다시 그린 표지가 넘치면(같은 원고 · 같은 판이라 원래는 없어야 함) 그 세트는 그대로 두고 이유를 돌려준다 — 반쯤 바꾼 세트를 만들지 않는다
import fs from 'node:fs';
import { assetPath, MIME, type ImageType } from '../brand/assets.ts';
import type { Db } from '../db/index.ts';
import { getProfile } from '../identity/store.ts';
import { postOrderOf } from '../preview/post-order.ts';
import { draftById } from '../templates/index.ts';
import { resolveLook } from '../templates/look.ts';
import { coverLook, renderPhotoFrame, type PhotoFrameResult } from '../templates/render-frame.ts';
import { getTemplateVersion } from '../templates/store.ts';
import { pillarIndexOf, surfaceColor } from '../templates/variant.ts';
import { getSet, listSets, replaceCard } from './store.ts';

export class RecolorError extends Error {}

/** 세트 표지를 다시 그릴 재료: 그 세트의 템플릿 판 · 축 번호(그 세트를 만든 프로필 판의 순서) · 지금 게시 순번 */
function coverInputs(db: Db, dataDir: string, setId: number) {
  const set = getSet(db, setId);
  if (!set) throw new RecolorError('카드 세트를 찾지 못했습니다.');
  const tv = getTemplateVersion(db, set.templateVersionId);
  const draft = tv ? draftById(tv.draftId) : undefined;
  if (!tv || !draft) throw new RecolorError(`세트 ${setId} 를 그린 템플릿 판을 찾지 못했습니다.`);
  const cover = set.cards.find((c) => c.idx === 0);
  if (!cover) throw new RecolorError(`세트 ${setId} 의 표지를 찾지 못했습니다.`);
  const pillars = getProfile(db, set.profileId)?.pillars ?? [];
  const place = { pillarIndex: pillarIndexOf(pillars, set.pillarId), postIndex: postOrderOf(db, set.brandId).ofSet.get(setId) ?? null };
  return { set, draft, look: resolveLook(tv.look, dataDir), cover, place };
}

const dataUrlOf = (dataDir: string, name: string) => {
  const file = assetPath(dataDir, name);
  if (!file || !fs.existsSync(file)) return null;
  return `data:${MIME[name.split('.').pop() as ImageType]};base64,${fs.readFileSync(file).toString('base64')}`;
};

/** 지금 규칙이면 이 세트 표지의 바탕색 */
export function wantedTone(db: Db, dataDir: string, setId: number): string {
  const x = coverInputs(db, dataDir, setId);
  return surfaceColor(x.draft.id, coverLook(db, x.draft, x.look, x.cover.content, x.place));
}

/**
 * 표지만 다시 그려 저장한다. background: 새로 올린 그림(data: 주소) — 없으면 세트에 올려 둔 그림(있을 때)으로.
 * 실패하면 저장하지 않고 결과만 돌려준다
 */
export async function redrawCover(db: Db, dataDir: string, setId: number, background?: string): Promise<PhotoFrameResult> {
  const x = coverInputs(db, dataDir, setId);
  const bg = background ?? (x.set.coverImage ? dataUrlOf(dataDir, x.set.coverImage) : null);
  const r = await renderPhotoFrame(db, x.draft, x.look, x.cover.content, bg, x.place);
  if (r.ok && r.png)
    replaceCard(
      db,
      dataDir,
      setId,
      0,
      { content: x.cover.content, png: r.png, render: { browser: `${r.browser.kind} ${r.browser.version}`, reference: r.browser.reference, scale: r.scale, ...(r.tone ? { tone: r.tone } : {}) }, glosses: x.cover.glosses ?? [] },
      false,
    );
  return r;
}

/** 지금 규칙의 색과 다른(또는 색 기록이 없는 — 규칙 전에 만든) 표지의 세트 ID */
export function staleCovers(db: Db, dataDir: string, brandId: number): number[] {
  return listSets(db, brandId)
    .map((s) => s.id)
    .filter((id) => {
      try {
        const tone = getSet(db, id)?.cards.find((c) => c.idx === 0)?.render.tone;
        return tone !== wantedTone(db, dataDir, id);
      } catch {
        return false; // 판을 못 찾는 세트는 다시 그릴 수도 없다 — 맞추기에서 이유로 보인다
      }
    });
}

export interface RecolorResult {
  redrawn: number[];
  failed: Array<{ setId: number; reason: string }>;
  /** 이미 지금 규칙의 색이라 그대로 둔 세트 수 */
  unchanged: number;
}

export async function recolorCovers(db: Db, dataDir: string, brandId: number): Promise<RecolorResult> {
  const stale = new Set(staleCovers(db, dataDir, brandId));
  const all = listSets(db, brandId).map((s) => s.id).sort((a, b) => a - b);
  const out: RecolorResult = { redrawn: [], failed: [], unchanged: 0 };
  for (const id of all) {
    let r: PhotoFrameResult;
    try {
      if (!stale.has(id)) {
        wantedTone(db, dataDir, id); // 판을 못 찾으면 여기서 이유가 나온다
        out.unchanged++;
        continue;
      }
      r = await redrawCover(db, dataDir, id);
    } catch (err) {
      if (err instanceof RecolorError) {
        out.failed.push({ setId: id, reason: err.message });
        continue;
      }
      throw err;
    }
    if (r.ok) out.redrawn.push(id);
    else out.failed.push({ setId: id, reason: r.shorten[0]?.message ?? r.problems[0]?.message ?? '표지를 다시 그리지 못했어요.' });
  }
  return out;
}
