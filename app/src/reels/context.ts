// 릴스 편집 화면 상태 — 화면 조각들이 같이 쓴다
import { createContext, useContext } from 'react';
import type { Box, ReelBrand, ReelDoc, Track } from '../../../server/src/reels/model.ts';
import type { ReelEditor } from './store.ts';

export interface Sel {
  track: Track;
  id: string;
}
export interface Ctx {
  ed: ReelEditor;
  /** 편집 내용 */
  p: ReelDoc;
  reelId: number;
  brand: ReelBrand;
  /** 격자 가림 안전 영역(확인값) */
  guide: Box;
  fonts: Array<{ id: string; name: string }>;
  whisper: boolean;
  frame: number;
  seek: (f: number) => void;
  sel: Sel | null;
  setSel: (s: Sel | null) => void;
  /** 「이 자막만」 / 「자막 전체」 */
  scope: 'one' | 'all';
  setScope: (s: 'one' | 'all') => void;
  /** 편집 화면에서 실제로 잰 글 상자 — 가림 경고에 씀 */
  measured: Map<string, { sig: string; box: Box }>;
  guideOn: boolean;
  media: (file: string) => string;
}
export const EditorCtx = createContext<Ctx | null>(null);
export const useCtx = () => {
  const c = useContext(EditorCtx);
  if (!c) throw new Error('릴스 편집 화면 밖에서 불렀어요');
  return c;
};

/** 고른 글자 하나 또는(자막 전체면) 자막 모두 */
export function textTargets(c: Ctx, id: string): Set<string> {
  const t = c.p.texts.find((x) => x.id === id);
  if (!t) return new Set();
  if (c.scope === 'all' && t.subtitle) return new Set(c.p.texts.filter((x) => x.subtitle).map((x) => x.id));
  return new Set([id]);
}
