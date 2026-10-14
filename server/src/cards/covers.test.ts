// 표지 규칙 — 개수 표현은 카드 수 규칙이, 그 밖의 숫자는 근거 규칙이
import { describe, expect, it } from 'vitest';
import type { CardContext } from './context.ts';
import { coverRules, type CoversOutput } from './covers.ts';

const ctx = {
  grounding: { source: ['노트 앱 모아 1.2 버전. 공유 링크는 7일 뒤 사라진다.'], brand: [], userInput: [] },
  commonTerms: ['DM'],
  bodyRange: [3, 7],
  profile: { pillars: [{ id: 'p1', name: '써 본 도구' }] },
  template: { budget: { cover: { headline: { charsPerLine: 10, maxLines: 2, maxChars: null } } } },
} as unknown as CardContext;
const codes = (headline: string, requested: number | null = 5) =>
  coverRules(ctx, requested).flatMap((r) => r({ titles: [{ headline, sub: null, pillar_id: 'p1', why: '' }] } as CoversOutput)).map((i) => i.code);

describe('표지 규칙', () => {
  it('개수 표현은 근거 대조에서 빼고 카드 수와 맞춘다', () => {
    expect(codes('모아 1.2\n**5가지**')).toEqual([]);
    expect(codes('알아둘 세 가지')).toEqual(['count_mismatch']);
  });

  it('개수가 아닌 지어낸 숫자는 범위 안의 수(3~7)여도 근거 규칙에 걸린다', () => {
    expect(codes('검색이 3배\n빨라졌다')).toEqual(['number_not_in_source']);
    expect(codes('검색이 3배', null)).toEqual(['number_not_in_source']);
    expect(codes('링크는 7일 뒤\n사라져요')).toEqual([]);
  });
});
