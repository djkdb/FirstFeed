// 그림 바탕 표지(시안 F)에 그림 올리기 → 표지만 다시 그리기 (결정 2026-10-18 · 그림 바탕 표지).
// 올리기는 브랜딩 그림과 같은 함수(매직 바이트로 형식 확인 · 서버가 이름 · data 폴더). 사용자가 올린 그림이라 사람 규칙은 걸지 않는다(프롬프트에만).
// 글자 뒤 명암비가 가장 진한 띠로도 모자라거나 넘치면 저장하지 않고 이유를 돌려준다(올린 파일도 지운다)
import fs from 'node:fs';
import { getSetting } from '../config.ts';
import type { Db } from '../db/index.ts';
import { assetPath, MIME, saveAsset, type ImageType } from '../brand/assets.ts';
import { resolveLook } from '../templates/look.ts';
import { draftById } from '../templates/index.ts';
import { renderPhotoFrame } from '../templates/render-frame.ts';
import { getTemplateVersion } from '../templates/store.ts';
import { getSet, replaceCard, setCoverImage } from './store.ts';

export class CoverImageError extends Error {}

export async function applyCoverImage(db: Db, dataDir: string, setId: number, bytes: Uint8Array): Promise<{ ok: true; shade: number | null } | { ok: false; problems: string[] }> {
  const set = getSet(db, setId);
  if (!set) throw new CoverImageError('카드 세트를 찾지 못했습니다.');
  const tv = getTemplateVersion(db, set.templateVersionId);
  const draft = tv ? draftById(tv.draftId) : undefined;
  if (!tv || !draft) throw new CoverImageError('이 세트를 그린 템플릿 판을 찾지 못했습니다.');
  if (draft.id !== 'F') throw new CoverImageError(`이 세트는 시안 ${draft.id} 로 그렸습니다. 그림 바탕 표지는 시안 F 로 고정한 뒤 만든 세트에만 올릴 수 있어요.`);
  const name = saveAsset(dataDir, bytes, getSetting(db, 'brand.maxUploadBytes'), 'cover');
  const file = assetPath(dataDir, name)!;
  const type = name.split('.').pop() as ImageType;
  const dataUrl = `data:${MIME[type]};base64,${fs.readFileSync(file).toString('base64')}`;
  const cover = set.cards.find((c) => c.idx === 0)!;
  const r = await renderPhotoFrame(db, draft, resolveLook(tv.look, dataDir), cover.content, dataUrl);
  if (!r.ok || !r.png) {
    fs.rmSync(file, { force: true });
    return { ok: false, problems: [...r.shorten.map((x) => x.message), ...r.problems.map((x) => x.message)].slice(0, 3) };
  }
  replaceCard(db, dataDir, setId, 0, { content: cover.content, png: r.png, render: { browser: `${r.browser.kind} ${r.browser.version}`, reference: r.browser.reference, scale: r.scale }, glosses: cover.glosses ?? [] }, false);
  setCoverImage(db, setId, name);
  return { ok: true, shade: r.shade };
}
