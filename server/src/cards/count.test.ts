import { describe, expect, it } from 'vitest';
import { countClaims, countMismatch } from './count.ts';

const values = (t: string) => countClaims(t).map((c) => c.value);

describe('개수 표현 찾기 (표지 ↔ 본문 카드 수)', () => {
  it('숫자 개수 표현', () => {
    expect(values('설정 5가지')).toEqual([5]);
    expect(values('**3단계**로 끝내기')).toEqual([3]);
    expect(values('앱 3개 비교')).toEqual([3]);
    expect(values('동네 디저트 4곳')).toEqual([4]);
  });

  it('한글 수사 — 한 가지~열두 가지', () => {
    expect(values('다섯 가지 방법')).toEqual([5]);
    expect(values('세 가지만 기억하세요')).toEqual([3]);
    expect(values('딱 한 가지')).toEqual([1]);
    expect(values('열 가지 습관')).toEqual([10]);
    expect(values('열두 단계')).toEqual([12]);
    expect(values('두 개면 충분')).toEqual([2]);
  });

  it('개수가 아닌 숫자는 보지 않는다 (오탐 방지)', () => {
    for (const t of ['3분 만에 끝내기', '2026년 정리', '1,500명이 쓴 앱', '3개월 써 본 후기', 'v1.64.0 바뀐 점', '10,000원으로', '하루 24시간', '3번째 이야기', '1위 앱', '24시간 · 87%'])
      expect(values(t), t).toEqual([]);
  });

  it('낱말 속의 수사는 개수가 아니다 — "세상", "네이버", "열심히", "한가지"는 붙여 쓴 경우만', () => {
    expect(values('세상에서 가장 쉬운')).toEqual([]);
    expect(values('네이버 블로그')).toEqual([]);
    expect(values('열심히 정리')).toEqual([]);
    expect(values('한가지만')).toEqual([1]);
  });

  it('본문 카드 수와 다르면 문제, 같거나 개수 표현이 없으면 통과', () => {
    expect(countMismatch(['처음 쓰는 사람을 위한\n**설정 5가지**'], 5)).toBeNull();
    expect(countMismatch(['다섯 가지 방법'], 4)).toContain('"다섯 가지" 이 본문 카드 수(4장)와 다릅니다');
    expect(countMismatch(['3분 만에 끝내는 설정'], 4)).toBeNull();
    expect(countMismatch(['3가지 방법과 5개 앱'], 3)).toContain('"5개"');
  });
});
