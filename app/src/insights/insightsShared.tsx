// 성과 화면이 같이 쓰는 응답 모양 · 표시 도우미 · 직접 입력 초안 — InsightsPage 와 각 묶음 화면이 쓴다
import type { InferResponseType } from 'hono/client';
import type { api } from '../api.ts';

export type View = InferResponseType<typeof api.api.insights.$get, 200>;
export type Post = View['posts'][number];
export type Group = View['groups'][number];
export type Dim = Group['dim'];
export interface Conn {
  connected: boolean;
  needsReconnect: boolean;
  brandId: string | null;
}

export const FORMATS: Array<{ id: string; label: string }> = [
  { id: 'FEED_CAROUSEL_ALBUM', label: '캐러셀(여러 장)' },
  { id: 'FEED_IMAGE', label: '사진 한 장' },
  { id: 'FEED_VIDEO', label: '영상' },
  { id: 'REELS', label: '릴스' },
];
export const formatName = (t: string | null) => (t ? (FORMATS.find((f) => f.id === t)?.label ?? t) : '형식 모름');
export const DIMS: Array<{ id: Dim; label: string }> = [
  { id: 'pillar', label: '축' },
  { id: 'format', label: '형식' },
  { id: 'title', label: '제목 유형' },
];
export const pct = (v: number | null) => (v === null ? null : `${(Math.round(v * 1000) / 10).toFixed(1)}%`);
export const clip = (s: string | null, n = 60) => (s ? ([...s].length > n ? `${[...s].slice(0, n - 1).join('')}…` : s) : null);

/** 비어 있는 값은 0 이 아니라 「입력 안 됨」 */
export function Val({ v }: { v: number | null }) {
  return v === null ? <span className="muted small">입력 안 됨</span> : <>{v.toLocaleString('ko-KR')}</>;
}

/** 「이 컴퓨터 시각」 datetime-local 값 */
export const localInput = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const NUMS = [
  { k: 'reach', label: '도달' },
  { k: 'saved', label: '저장' },
  { k: 'shares', label: '공유' },
  { k: 'views', label: '조회' },
  { k: 'likes', label: '좋아요' },
  { k: 'comments', label: '댓글' },
] as const;
export type NumKey = (typeof NUMS)[number]['k'];

export interface Draft {
  publishedAt: string;
  type: string;
  url: string;
  content: string;
  setId: string;
  nums: Record<NumKey, string>;
}
export const emptyDraft = (): Draft => ({ publishedAt: localInput(), type: 'FEED_CAROUSEL_ALBUM', url: '', content: '', setId: '', nums: { reach: '', saved: '', shares: '', views: '', likes: '', comments: '' } });
export const draftFrom = (p: Post): Draft => ({
  publishedAt: p.publishedAt ? localInput(new Date(p.publishedAt)) : localInput(),
  type: p.type ?? 'FEED_CAROUSEL_ALBUM',
  url: p.url ?? '',
  content: p.content ?? '',
  setId: p.setId === null ? '' : String(p.setId),
  nums: Object.fromEntries(NUMS.map(({ k }) => [k, p[k] === null ? '' : String(p[k])])) as Record<NumKey, string>,
});
