// 브랜딩 키트 선택 → 템플릿에 입힐 모양. 고정한 판에는 그림 파일 "이름"만 남기고(asset:이름), 그릴 때 data: 주소로 바꾼다 —
// 판마다 그림을 통째로 DB 에 넣지 않으려고
import fs from 'node:fs';
import type { Db } from '../db/index.ts';
import { assetPath, MIME, type ImageType } from '../brand/assets.ts';
import { currentSelection } from '../brand/store.ts';
import type { BrandLook } from './types.ts';

export interface LookFromSelection {
  look: BrandLook | null;
  /** 모자란 것 — 화면에 그대로 보인다 */
  missing: string[];
  selectionId: number | null;
}

export function lookFromSelection(db: Db, brandId: number): LookFromSelection {
  const s = currentSelection(db, brandId);
  const missing: string[] = [];
  if (!s.palette) missing.push('색 팔레트');
  if (!s.titleFont || !s.bodyFont) missing.push('폰트 짝');
  if (missing.length) return { look: null, missing, selectionId: s.id };
  return {
    look: {
      palette: { name: s.palette!.name, ...s.palette!.colors },
      titleFont: s.titleFont!,
      bodyFont: s.bodyFont!,
      handle: s.handle,
      displayName: s.displayName,
      profileImage: s.profileImage ? `asset:${s.profileImage}` : null,
    },
    missing: [],
    selectionId: s.id,
  };
}

/** 그리기 직전: asset:이름 → data: 주소 (파일이 없어졌으면 글자형으로) */
export function resolveLook(look: BrandLook, dataDir: string): BrandLook {
  const name = look.profileImage?.startsWith('asset:') ? look.profileImage.slice(6) : null;
  if (!name) return look;
  const p = assetPath(dataDir, name);
  if (!p) return { ...look, profileImage: null };
  const type = name.split('.').pop() as ImageType;
  return { ...look, profileImage: `data:${MIME[type]};base64,${fs.readFileSync(p).toString('base64')}` };
}
