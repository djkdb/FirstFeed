// 게시물 ↔ FirstFeed 세트 잇기 후보(사용자 결정 2026-11-22) — 순수 함수. **자동으로 잇지 않는다** — 사용자가 「맞아요」를 눌러야 잇는다.
// 대상: 홈에서 「올렸어요」를 누른 세트 중 아직 어느 게시물과도 잇지 않은 것. 후보: 아직 잇지 않은 Metricool 게시물 중
// 「올렸어요」 날짜 앞뒤 insights.matchWindowDays 일 안에 올라간 것. 점수: 글자 두 개 묶음 — 캡션끼리 자카드, 표지 제목이 게시물 글에 든 정도 중 큰 값
import { containment, similarity } from '../rules/similarity.ts';
import { plainTitle } from './analyze.ts';
import type { InsightPost } from './store.ts';

export interface PostedSet {
  setId: number;
  /** 사용자가 「올렸어요」를 누른 날(YYYY-MM-DD, 그 컴퓨터의 날짜) */
  postedAt: string;
  title: string;
  /** FirstFeed 가 만든 캡션(첫 줄 + 핵심 줄) — 없으면 null */
  caption: string | null;
}

export interface Candidate {
  postId: number;
  score: number;
  /** 「올렸어요」 날짜와 게시 날짜의 차이(일) */
  dayGap: number;
}

const DAY = 86_400_000;

/** ISO 시각 → 이 컴퓨터의 날짜(YYYY-MM-DD) */
export function localDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const dayNumber = (ymd: string) => Math.round(Date.parse(`${ymd}T00:00:00Z`) / DAY);

export function scorePair(s: PostedSet, content: string): number {
  const byCaption = s.caption ? similarity(s.caption, content) : 0;
  const byTitle = s.title ? containment(plainTitle(s.title), content) : 0;
  return Math.round(Math.max(byCaption, byTitle) * 1000) / 1000;
}

export function linkCandidates(
  sets: PostedSet[],
  posts: InsightPost[],
  o: { windowDays: number; rejected: Set<string>; limit?: number; toLocalDate?: (iso: string) => string },
): Array<{ setId: number; candidates: Candidate[] }> {
  const toDate = o.toLocalDate ?? localDate;
  const linked = new Set(posts.map((p) => p.setId).filter((x): x is number => x !== null));
  const free = posts.filter((p) => p.source === 'metricool' && p.setId === null && p.publishedAt);
  return sets
    .filter((s) => !linked.has(s.setId))
    .map((s) => {
      const candidates = free
        .map((p) => ({ p, gap: Math.abs(dayNumber(toDate(p.publishedAt!)) - dayNumber(s.postedAt)) }))
        .filter(({ p, gap }) => gap <= o.windowDays && !o.rejected.has(`${p.id}:${s.setId}`))
        .map(({ p, gap }) => ({ postId: p.id, score: scorePair(s, p.content ?? ''), dayGap: gap }))
        .sort((a, b) => b.score - a.score || a.dayGap - b.dayGap)
        .slice(0, o.limit ?? 3);
      return { setId: s.setId, candidates };
    })
    .filter((x) => x.candidates.length > 0);
}
