// 성과 화면 값 모으기 — 게시물 · 분석 묶음 · 잇기 후보 · 제안 · 반영한 변경. AI 없음
import { getSetting } from '../config.ts';
import type { Db } from '../db/index.ts';
import { homeMarks } from '../home/marks.ts';
import { isLive } from '../identity/for-generation.ts';
import { activeProfile, listProfiles } from '../identity/store.ts';
import { latestPlan } from '../preview/plan.ts';
import { getCaption } from '../publish/store.ts';
import { analyze, plainTitle, type SetInfo } from './analyze.ts';
import { linkCandidates, type PostedSet } from './match.ts';
import { acceptedSuggestions, lastFetchedAt, latestSuggestions, listPosts, rejectedPairs, setMeta } from './store.ts';

/** 축 이름 — 지금 프로필에 없는 축(예전 판에만 있던 축)도 이름을 찾는다. 같은 ID 면 새 판의 이름 */
export function pillarNames(db: Db, brandId: number): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of listProfiles(db, brandId).reverse()) for (const x of p.pillars) m.set(x.id, x.name);
  return m;
}

/** 세트 → 표지 제목 · 축. 세트에 축이 없으면 홈에서 이은 계획 칸의 축 */
export function setInfos(db: Db, brandId: number): Map<number, SetInfo> {
  const meta = setMeta(db, brandId);
  const plan = latestPlan(db, brandId);
  const slotPillar = new Map<number, string>();
  for (const [idx, m] of homeMarks(db, brandId)) {
    const pid = plan?.slots[idx]?.pillarId;
    if (m.setId !== null && pid) slotPillar.set(m.setId, pid);
  }
  return new Map([...meta].map(([id, x]) => [id, { title: x.title, pillarId: x.pillarId ?? slotPillar.get(id) ?? null }]));
}

/** 홈에서 「올렸어요」를 누른 세트 — 잇기 후보를 찾을 대상 */
export function postedSets(db: Db, brandId: number): PostedSet[] {
  const meta = setMeta(db, brandId);
  return [...homeMarks(db, brandId).values()]
    .filter((m) => m.setId !== null && m.postedAt !== null && meta.has(m.setId))
    .map((m) => {
      const cap = getCaption(db, m.setId!);
      return { setId: m.setId!, postedAt: m.postedAt!, title: meta.get(m.setId!)!.title ?? '', caption: cap ? [cap.hook, ...cap.lines].join('\n') : null };
    });
}

export function analysisFor(db: Db, brandId: number, now = Date.now()) {
  return analyze(listPosts(db, brandId), {
    now,
    matureHours: getSetting(db, 'insights.matureHours'),
    minSamples: getSetting(db, 'insights.minSamples'),
    sets: setInfos(db, brandId),
    pillarNames: pillarNames(db, brandId),
  });
}

export function insightsView(db: Db, brandId: number, now = Date.now()) {
  const { posts, groups } = analysisFor(db, brandId, now);
  const meta = setMeta(db, brandId);
  const linked = new Set(posts.map((p) => p.setId).filter((x): x is number => x !== null));
  const candidates = linkCandidates(postedSets(db, brandId), posts, { windowDays: getSetting(db, 'insights.matchWindowDays'), rejected: rejectedPairs(db) });
  const active = activeProfile(db, brandId);
  const liveRules = new Set([...(active?.voiceRules ?? []), ...(active?.avoid ?? [])].filter((x) => x.origin === 'insight' && isLive(x, now)).map((x) => x.text));
  return {
    settings: {
      matureHours: getSetting(db, 'insights.matureHours'),
      minSamples: getSetting(db, 'insights.minSamples'),
      acceptDays: getSetting(db, 'insights.acceptDays'),
      matchWindowDays: getSetting(db, 'insights.matchWindowDays'),
    },
    lastFetchedAt: lastFetchedAt(db, brandId),
    posts,
    groups,
    candidates,
    /** 직접 잇기 목록 — 만든 세트 전부(이미 이은 세트는 표시) */
    sets: [...meta].map(([id, m]) => ({ id, title: m.title ? plainTitle(m.title) : `세트 ${id}`, createdAt: m.createdAt, linked: linked.has(id) })).reverse(),
    hasProfile: active !== null,
    suggestions: latestSuggestions(db, brandId),
    accepted: acceptedSuggestions(db, brandId).map((s) => ({
      ...s,
      expired: s.expiresAt !== null && !isLive({ expiresAt: s.expiresAt }, now),
      /** 지금 적용 중인 프로필에 아직 들어 있나(사용자가 직접 지웠거나 되돌렸으면 false) */
      inProfile: liveRules.has(s.rule),
    })),
  };
}
