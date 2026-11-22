// 성과 분석 계산(FR-IN-3 · FR-IN-4) — 순수 함수. AI 없음.
// - 게시 뒤 insights.matureHours(48) 시간이 지난 게시물만 쓴다. 그 전은 「집계 중」
// - 저장률 = 저장 / 도달, 공유율 = 공유 / 도달. 분자가 비었거나 도달이 비었거나 0 이면 그 계산에서 뺀다(0 으로 치지 않는다)
// - 묶음(축 · 형식 · 제목 유형)마다 게시물별 비율의 평균. 값이 있는 표본이 insights.minSamples(3) 미만이면 「표본 부족 — 결론 없음」
import type { InsightPost } from './store.ts';

export type Dim = 'pillar' | 'format' | 'title';
export type TitleType = 'question' | 'number' | 'other';

export const DIM_LABEL: Record<Dim, string> = { pillar: '축', format: '형식', title: '제목 유형' };
export const TITLE_LABEL: Record<TitleType, string> = { question: '질문형', number: '숫자형', other: '그 외' };

/** Metricool 의 종류 값 → 화면 이름. 모르는 값은 그대로 보인다(지어 붙이지 않는다) */
export const FORMAT_LABEL: Record<string, string> = {
  FEED_CAROUSEL_ALBUM: '캐러셀(여러 장)',
  FEED_IMAGE: '사진 한 장',
  FEED_VIDEO: '영상',
  REELS: '릴스',
};
export const formatLabel = (t: string) => FORMAT_LABEL[t] ?? t;

/** 표지 제목의 강조 표시(**…**)를 지운 글 */
export const plainTitle = (t: string) => t.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

/**
 * 제목 유형 — 첫 판(결정 2026-11-22), 코드만 한 곳에서. 질문형을 먼저 본다(「?」 로 끝나거나 「…까 · …나요 · …가요」로 끝남),
 * 그다음 숫자가 하나라도 있으면 숫자형, 나머지는 그 외. 「다섯 가지」 같은 한글 수사는 숫자형으로 세지 않는다(근거 규칙과 같은 한계)
 */
export function titleType(title: string): TitleType {
  const t = plainTitle(title).replace(/[\s!.…~]+$/u, '');
  if (/[?？]$/.test(t) || /(까|나요|가요)$/.test(t)) return 'question';
  if (/\d/.test(t)) return 'number';
  return 'other';
}

export function rate(numerator: number | null, reach: number | null): number | null {
  if (numerator === null || reach === null || reach <= 0) return null;
  return numerator / reach;
}

/** 표 · 제안이 같은 글을 쓰도록 한 곳에서: 소수 한 자리 퍼센트 */
export const formatRate = (v: number) => `${(Math.round(v * 1000) / 10).toFixed(1)}%`;

export interface SetInfo {
  title: string | null;
  pillarId: string | null;
}

export interface AnalyzedPost extends InsightPost {
  /** 48시간이 지났는가. 게시 시각을 모르면 false */
  mature: boolean;
  saveRate: number | null;
  shareRate: number | null;
  title: string | null;
  titleType: TitleType | null;
  pillarId: string | null;
}

export interface MetricStat {
  value: number | null;
  /** 표 · 제안에 쓰는 글(「4.2%」). 표본이 모자라면 null */
  formatted: string | null;
  /** 값이 있는 표본 수 */
  n: number;
  enough: boolean;
}

export interface Group {
  key: string;
  dim: Dim;
  label: string;
  /** 이 묶음의 분석에 쓸 수 있는(48시간 지난) 게시물 수 */
  n: number;
  saveRate: MetricStat;
  shareRate: MetricStat;
}

export interface AnalyzeOptions {
  now: number;
  matureHours: number;
  minSamples: number;
  sets: Map<number, SetInfo>;
  pillarNames: Map<string, string>;
}

function stat(values: Array<number | null>, min: number): MetricStat {
  const v = values.filter((x): x is number => x !== null);
  if (v.length === 0) return { value: null, formatted: null, n: 0, enough: false };
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  const enough = v.length >= min;
  return { value: avg, formatted: enough ? formatRate(avg) : null, n: v.length, enough };
}

export function analyze(posts: InsightPost[], o: AnalyzeOptions): { posts: AnalyzedPost[]; groups: Group[] } {
  const out: AnalyzedPost[] = posts.map((p) => {
    const t = p.publishedAt ? Date.parse(p.publishedAt) : NaN;
    const info = p.setId !== null ? o.sets.get(p.setId) : undefined;
    const title = info?.title ? plainTitle(info.title) : null;
    return {
      ...p,
      mature: !Number.isNaN(t) && t + o.matureHours * 3_600_000 <= o.now,
      saveRate: rate(p.saved, p.reach),
      shareRate: rate(p.shares, p.reach),
      title,
      titleType: title ? titleType(title) : null,
      pillarId: info?.pillarId ?? null,
    };
  });
  const buckets = new Map<string, { dim: Dim; label: string; items: AnalyzedPost[] }>();
  const add = (key: string, dim: Dim, label: string, p: AnalyzedPost) => {
    const b = buckets.get(key) ?? { dim, label, items: [] };
    b.items.push(p);
    buckets.set(key, b);
  };
  for (const p of out) {
    if (!p.mature) continue;
    // 축 · 제목 유형은 이은 세트가 있을 때만 — 잇지 않은 게시물은 형식 표에만 들어간다(사용자 결정 2026-11-22)
    if (p.pillarId) add(`pillar:${p.pillarId}`, 'pillar', o.pillarNames.get(p.pillarId) ?? '지금 프로필에 없는 축', p);
    if (p.type) add(`format:${p.type}`, 'format', formatLabel(p.type), p);
    if (p.titleType) add(`title:${p.titleType}`, 'title', TITLE_LABEL[p.titleType], p);
  }
  const order: Dim[] = ['pillar', 'format', 'title'];
  const groups = [...buckets]
    .map(([key, b]): Group => ({
      key,
      dim: b.dim,
      label: b.label,
      n: b.items.length,
      saveRate: stat(b.items.map((x) => x.saveRate), o.minSamples),
      shareRate: stat(b.items.map((x) => x.shareRate), o.minSamples),
    }))
    .sort((a, b) => order.indexOf(a.dim) - order.indexOf(b.dim) || b.n - a.n || a.label.localeCompare(b.label));
  return { posts: out, groups };
}

export interface TableRow {
  key: string;
  dim: Dim;
  label: string;
  n: number;
  saveRate: string | null;
  shareRate: string | null;
}

/**
 * AI 에 보일 표 — 결론을 낼 수 있는 값(표본 minSamples 이상)이 하나라도 있는 묶음만. 표본이 모자란 값은 숫자 없이 「표본 부족」.
 * grounding: 제안 문장의 숫자 대조에 쓸 글 — 묶음 키(축 ID 의 16진수 숫자가 섞인다)는 빼고 이름 · 개수 · 비율만
 */
export function insightTable(groups: Group[]): { rows: TableRow[]; text: string; grounding: string } {
  const rows: TableRow[] = groups
    .filter((g) => g.saveRate.enough || g.shareRate.enough)
    .map((g) => ({ key: g.key, dim: g.dim, label: g.label, n: g.n, saveRate: g.saveRate.formatted, shareRate: g.shareRate.formatted }));
  const cell = (name: string, v: string | null, n: number) => (v ? `${name} ${v} (값 있는 게시물 ${n}개)` : `${name} 표본 부족`);
  const lines = rows.map((r) => {
    const g = groups.find((x) => x.key === r.key)!;
    return { key: r.key, body: `${DIM_LABEL[r.dim]} 「${r.label}」 · 게시물 ${r.n}개 · ${cell('저장률', r.saveRate, g.saveRate.n)} · ${cell('공유율', r.shareRate, g.shareRate.n)}` };
  });
  return { rows, text: lines.map((l) => `- [${l.key}] ${l.body}`).join('\n'), grounding: lines.map((l) => l.body).join('\n') };
}
