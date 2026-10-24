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

describe('목록 번호는 구조에서 나온 숫자 (결정 2026-10-25)', () => {
  const src = { source: ['에러 메시지의 첫 단어와 파일 이름, 줄 번호를 적는다'] };
  it('줄 첫머리에서 1부터 차례로 이어지는 목록 번호는 대조하지 않는다 — 확인 실행에서 실제로 걸린 글', () => {
    const text = '"안 돼요" 대신 이렇게 적었다.\n\n1. 에러 메시지의 첫 단어\n2. 파일 이름과 줄 번호\n3. 내가 하려던 일 한 줄';
    expect(findUngrounded(text, src, [])).toEqual([]);
    expect(findUngrounded('1) 첫째\n2) 둘째', src, [])).toEqual([]);
  });
  it('목록 줄 안의 숫자는 그대로 검사한다 — 「3. 팔로워 120명」의 120 은 걸림', () => {
    expect(findUngrounded('1. 처음\n2. 다음\n3. 팔로워 120명', src, []).map((c) => c.value)).toEqual(['120']);
  });
  it('차례가 깨진 번호 · 1로 시작하지 않는 번호 · 문장 안의 「1. 2.」는 걸린다', () => {
    expect(findUngrounded('1. 처음\n3. 건너뜀', src, []).map((c) => c.value)).toEqual(['3']);
    expect(findUngrounded('5. 다섯째부터', src, []).map((c) => c.value)).toEqual(['5']);
    expect(findUngrounded('순서는 1. 이것 2. 저것', src, []).map((c) => c.value)).toEqual(['1', '2']);
  });
  it('새 「1.」 은 새 목록 — 두 목록 모두 통과', () => {
    expect(findUngrounded('1. 가\n2. 나\n\n문단\n\n1. 다\n2. 라', src, [])).toEqual([]);
  });
});

