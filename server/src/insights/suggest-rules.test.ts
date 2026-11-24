// 제안 코드 규칙 보강(2026-11-24 디버깅): 실제 AI 측정에서 자기 평가(opus)가 「두 문장」을 깨짐으로 잡아 재작성이 났고,
// 코드 검토에서 배수 비교 · 전각 숫자 · 「11%」 대 「11.0%」 가 빠져나가거나 괜히 걸리는 것을 찾았다 — 코드로 잴 수 있는 것은 코드로
import { describe, expect, it } from 'vitest';
import { insightTable, type Group } from './analyze.ts';
import { sentenceCount, suggestRules, type SuggestOut } from './suggest.ts';

const stat = (value: number | null, formatted: string | null, n: number) => ({ value, formatted, n, enough: formatted !== null });
const groups: Group[] = [
  { key: 'format:REELS', dim: 'format', label: '릴스', n: 27, saveRate: stat(0.008, '0.8%', 27), shareRate: stat(0.006, '0.6%', 27) },
  { key: 'format:FEED_CAROUSEL_ALBUM', dim: 'format', label: '캐러셀(여러 장)', n: 17, saveRate: stat(0.11, '11.0%', 17), shareRate: stat(0.003, '0.3%', 15) },
];
const t = insightTable(groups);
const ctx = { groups, table: t.rows, grounding: t.grounding, max: 3, maxChars: 80, ruleMaxChars: 80, commonTerms: ['DM'] };
const one = (p: Partial<SuggestOut['suggestions'][number]>): SuggestOut => ({
  suggestions: [{ kind: 'more', groupKey: 'format:REELS', text: '공유율이 릴스 0.6%로 캐러셀 0.3%보다 높았던 릴스를 더 올린다.', rule: '릴스 형식을 더 쓴다', evidence: [{ groupKey: 'format:REELS', metric: 'shareRate', value: '0.6%' }], ...p }],
});
const codes = (d: SuggestOut) => suggestRules(ctx).flatMap((r) => r(d)).map((i) => i.code);

describe('제안 규칙 보강', () => {
  it('한 문장은 통과, 두 문장은 text_not_one_sentence(소수점은 문장 끝이 아니다)', () => {
    expect(sentenceCount('공유율이 0.6%로 높았던 릴스를 더 올린다.')).toBe(1);
    // 실제 AI 출력(2026-11-24 실제 숫자 측정)에서 자기 평가가 잡은 모양
    expect(sentenceCount('릴스를 더 올린다. 공유율이 0.6%로 캐러셀 0.3%보다 높았다.')).toBe(2);
    expect(codes(one({}))).toEqual([]);
    expect(codes(one({ text: '릴스를 더 올린다. 공유율이 0.6%로 높았다.' }))).toContain('text_not_one_sentence');
  });
  it('배수 비교는 표에 없는 계산 — 개수 숫자(「게시물 27개」)와 겹쳐도 막는다', () => {
    expect(codes(one({ text: '릴스 공유율이 캐러셀의 2배라 릴스를 더 올린다' }))).toContain('multiplier_not_in_table');
    expect(codes(one({ text: '릴스 공유율이 캐러셀의 두 배라 릴스를 더 올린다' }))).toContain('multiplier_not_in_table');
    expect(codes(one({ rule: '릴스를 세 배 더 쓴다' }))).toContain('multiplier_not_in_table');
  });
  it('규칙 문장의 숫자는 전각 숫자도 막는다', () => {
    expect(codes(one({ rule: '릴스를 주 ３번 쓴다' }))).toContain('rule_has_number');
  });
  it('「11.0%」 를 「11%」 로 줄여 쓴 것은 표의 값 — 문장 · 근거 모두', () => {
    const d = one({ groupKey: 'format:FEED_CAROUSEL_ALBUM', text: '저장률 11%로 높았던 캐러셀을 더 올린다.', rule: '캐러셀을 더 쓴다', evidence: [{ groupKey: 'format:FEED_CAROUSEL_ALBUM', metric: 'saveRate', value: '11%' }] });
    expect(codes(d)).toEqual([]);
  });
});
