import { describe, expect, it } from 'vitest';
import { smokeRules, type SmokeOutput } from './smoke-extract.ts';

const source = '가게 계정은 개업 1년 만에 팔로워 8,300명을 모았다. Naver 스마트스토어에서 판다.';
const check = (d: SmokeOutput) => smokeRules(source).flatMap((r) => r(d));

describe('스모크 과제 규칙', () => {
  it('원문 인용과 원문 숫자·영문만 쓰면 통과', () => {
    expect(check({ facts: [{ fact: '1년 만에 팔로워 8300명', quote: '가게 계정은 개업 1년 만에 팔로워 8,300명을 모았다.' }, { fact: 'Naver 에서 판다', quote: 'Naver 스마트스토어에서 판다' }] })).toEqual([]);
  });

  it('지어낸 인용·숫자·영문 이름을 잡는다', () => {
    const issues = check({ facts: [{ fact: '팔로워 10,000명, Coupang 판매', quote: '팔로워가 만 명이다' }, { fact: 'x', quote: 'Naver 스마트스토어에서 판다' }] });
    expect(issues.map((i) => i.code).sort()).toEqual(['english_not_in_source', 'number_not_in_source', 'quote_not_in_source']);
  });
});
