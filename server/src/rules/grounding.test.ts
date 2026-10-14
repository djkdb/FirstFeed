import { describe, expect, it } from 'vitest';
import { commonEnglishTerms } from '../config.ts';
import { findUngrounded, normalizeForQuote, numbersIn, quoteInSources } from './grounding.ts';

const source = '퍼스트피드는 2026년 10월에 시작한 프로젝트다. 첫 달에 팔로워 1,500명을 모았다. Claude Code 로 만들었다.';

describe('인용 일치 (공백·문장부호 정리 후 부분 문자열)', () => {
  it('띄어쓰기·문장부호가 달라도 같은 문장이면 통과', () => {
    expect(quoteInSources('첫 달에 팔로워 1,500명을  모았다', [source])).toBe(true);
    expect(quoteInSources('첫달에 팔로워 1500명을 모았다!', [source])).toBe(true);
  });

  it('글자가 바뀌면 실패 (요약·바꿔 쓰기는 인용이 아니다)', () => {
    expect(quoteInSources('첫 달에 팔로워 1,500명이 모였다', [source])).toBe(false);
    expect(quoteInSources('   ', [source])).toBe(false);
  });

  it('정규화는 글자와 숫자만 남긴다', () => {
    expect(normalizeForQuote('「안녕」, 세상! 1,500')).toBe('안녕세상1500');
  });
});

describe('숫자·영문 이름 대조 (허용 출처 4가지)', () => {
  it('천 단위 쉼표를 맞춰 비교한다', () => {
    expect(numbersIn('1,500명과 1500명, 버전 2.1.296, 가격 1,234,567원')).toEqual(['1500', '1500', '2.1.296', '1234567']);
  });

  it('원문에 있는 숫자·영문 이름은 통과', () => {
    expect(findUngrounded('2026년 10월 시작, 팔로워 1500명, claude code 사용', { source: [source] }, [])).toEqual([]);
  });

  it('원문에 없는 숫자·영문 이름을 잡는다', () => {
    expect(findUngrounded('팔로워 2,000명, ChatGPT 로 만들었다', { source: [source] }, [])).toEqual([
      { kind: 'number', value: '2000' },
      { kind: 'english', value: 'ChatGPT' },
    ]);
  });

  it('브랜드 프로필·구조 숫자·사용자 입력도 허용 출처다', () => {
    const text = '꼭 알아야 할 5가지 · @firstfeed.kr 팔로우 · 매주 3번 올린다';
    expect(findUngrounded(text, { source: [source] }, []).map((c) => c.value)).toEqual(['5', '3', 'firstfeed.kr']);
    expect(
      findUngrounded(text, { source: [source], brand: ['핸들: @firstfeed.kr'], structural: [5], userInput: ['일주일에 3번 올릴 수 있어요'] }, []),
    ).toEqual([]);
  });

  it('흔한 영문 약어 허용 목록: 낱말 전체가 같을 때만 통과, 목록에 없는 이름(GPT)은 여전히 걸린다 (결정 2026-10-14)', () => {
    const terms = commonEnglishTerms(null);
    expect(terms).toContain('DM');
    expect(findUngrounded('협업 제안은 DM 💬', { source: [source] }, terms)).toEqual([]);
    expect(findUngrounded('협업 제안은 dm 으로', { source: [source] }, terms)).toEqual([]);
    expect(findUngrounded('GPT 로 정리', { source: [source] }, terms)).toEqual([{ kind: 'english', value: 'GPT' }]);
    expect(findUngrounded('DMV 서류 정리', { source: [source] }, terms)).toEqual([{ kind: 'english', value: 'DMV' }]);
  });

  it('한글 수사는 지금은 검사하지 않는다 (결정 사항)', () => {
    expect(findUngrounded('다섯 가지 방법', { source: [source] }, [])).toEqual([]);
  });
});
