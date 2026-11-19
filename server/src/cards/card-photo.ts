// 본문 카드 사진 칸 (사용자 결정 2026-11-19 — 「본문 사진 자리」): 사진 칸이 있는 시안(draft.bodyPhoto)으로 만든 세트의 본문 카드에
// 그림을 올리면 그 카드만 다시 그린다. 올리기는 표지 그림과 같은 함수(매직 바이트로 형식 확인 · 서버가 이름 · data 폴더).
// 사용자가 올린 그림이라 사람 규칙은 걸지 않는다(결정 2026-10-18 — 프롬프트에만). 글은 그대로라 근거 규칙도 다시 걸지 않고,
// 사진 칸 때문에 글 자리가 좁아져 넘치면 저장하지 않고 「약 N자 줄이세요」를 돌려준다(올린 파일도 지운다)
import fs from 'node:fs';
import { getSetting } from '../config.ts';
import type { Db } from '../db/index.ts';
import { assetPath, MIME, saveAsset, type ImageType } from '../brand/assets.ts';
import { resolveLook } from '../templates/look.ts';
import { draftById } from '../templates/index.ts';
import { renderPhotoFrame } from '../templates/render-frame.ts';
import { getTemplateVersion } from '../templates/store.ts';
import type { Draft } from '../templates/types.ts';
import { getSet, replaceCard, setCardPhoto, type SavedCard } from './store.ts';

export class CardPhotoError extends Error {}

export function assetDataUrl(dataDir: string, name: string | null | undefined): string | null {
  const file = name ? assetPath(dataDir, name) : null;
  if (!file || !fs.existsSync(file)) return null;
  return `data:${MIME[file.split('.').pop() as ImageType]};base64,${fs.readFileSync(file).toString('base64')}`;
}

/** 다시 그릴 때(채팅 고치기 · 풀이 고치기) 그 카드에 깔 사진 — 사진 칸 시안의 본문 카드만 */
export const bodyPhotoUrl = (dataDir: string, draft: Draft, card: Pick<SavedCard, 'kind' | 'photo'>) =>
  draft.bodyPhoto && card.kind === 'body' ? assetDataUrl(dataDir, card.photo) : null;

/** bytes 가 null 이면 사진을 빼고 글만 있는 모양으로 다시 그린다 */
export async function applyBodyPhoto(db: Db, dataDir: string, setId: number, idx: number, bytes: Uint8Array | null): Promise<{ ok: true } | { ok: false; problems: string[] }> {
  const set = getSet(db, setId);
  if (!set) throw new CardPhotoError('카드 세트를 찾지 못했습니다.');
  const card = set.cards.find((c) => c.idx === idx);
  if (!card || card.kind !== 'body') throw new CardPhotoError('사진은 본문 카드에만 넣을 수 있어요. 화면을 새로고침하세요.');
  const tv = getTemplateVersion(db, set.templateVersionId);
  const draft = tv ? draftById(tv.draftId) : undefined;
  if (!tv || !draft) throw new CardPhotoError('이 세트를 그린 템플릿 판을 찾지 못했습니다.');
  if (!draft.bodyPhoto) throw new CardPhotoError(`이 세트는 시안 ${draft.id}(${draft.name})로 그렸습니다. 본문 사진은 사진 칸이 있는 시안(G · I · J)으로 고정한 뒤 만든 세트에만 넣을 수 있어요.`);
  const name = bytes ? saveAsset(dataDir, bytes, getSetting(db, 'brand.maxUploadBytes'), 'photo') : null;
  const r = await renderPhotoFrame(db, draft, resolveLook(tv.look, dataDir), card.content, assetDataUrl(dataDir, name));
  if (!r.ok || !r.png) {
    if (name) fs.rmSync(assetPath(dataDir, name)!, { force: true });
    return { ok: false, problems: [...r.shorten.map((x) => x.message), ...r.problems.map((x) => x.message)].slice(0, 3) };
  }
  replaceCard(db, dataDir, setId, idx, { content: card.content, png: r.png, render: { browser: `${r.browser.kind} ${r.browser.version}`, reference: r.browser.reference, scale: r.scale }, glosses: card.glosses ?? [] }, false);
  setCardPhoto(db, setId, idx, name);
  return { ok: true };
}
