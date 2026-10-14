import { describe, expect, it } from 'vitest';
import { contrastRatio, handleProblems, instagramLength, mentionsIn, URL_IN_TEXT } from './limits.ts';

describe('인스타 글자 수 — 확인 전까지 엄하게', () => {
  it('한글·영문은 한 글자에 1', () => {
    expect(instagramLength('AI 도구 정리')).toBe(8);
  });
  it('이모지는 글자 수(1)와 UTF-16 길이(2) 중 큰 값', () => {
    expect('🚀'.length).toBe(2);
    expect(instagramLength('🚀')).toBe(2);
    expect(instagramLength('정리🚀')).toBe(4);
  });
  it('여러 코드 포인트로 된 이모지(가족·국기)도 UTF-16 길이로 센다', () => {
    expect(instagramLength('👨‍👩‍👧')).toBe('👨‍👩‍👧'.length); // 1 글자, 8 단위
    expect(instagramLength('🇰🇷')).toBe(4);
  });
});

describe('아이디 규칙 (외부 자료 등급)', () => {
  it.each([['firstfeed.ai'], ['zun_ai_note'], ['a1.b2_c3']])('%s 는 통과', (h) => {
    expect(handleProblems(h, 30)).toEqual([]);
  });
  it.each([
    ['First.Feed', '영문 소문자'],
    ['.firstfeed', '마침표로 시작'],
    ['firstfeed.', '마침표로 시작하거나 끝날'],
    ['first..feed', '연달아'],
    ['first-feed', '영문 소문자'],
    ['a'.repeat(31), '30자를 넘습니다'],
    ['한글아이디', '영문 소문자'],
  ])('%s 는 실패 (%s)', (h, why) => {
    expect(handleProblems(h, 30).join(' ')).toContain(why);
  });
});

describe('바이오 속 주소와 @아이디', () => {
  it('주소를 잡는다 (링크 서비스 포함)', () => {
    for (const t of ['https://x.com', 'www.firstfeed.kr', '자세히는 firstfeed.com 에서', 'linktr.ee/zun', 'bit.ly/abc']) {
      expect(URL_IN_TEXT.test(t), t).toBe(true);
    }
  });
  it('@아이디·기술 이름·버전은 주소가 아니다', () => {
    for (const t of ['캐릭터 @zun.ai 와 함께', 'Next.js 로 만든 앱', 'Claude 4.5 써 보기', '주 3회']) {
      expect(URL_IN_TEXT.test(t), t).toBe(false);
    }
  });
  it('@아이디를 뽑는다', () => {
    expect(mentionsIn('캐릭터 @zun.ai 와 함께 · 문의 @First_Feed')).toEqual(['zun.ai', 'first_feed']);
  });
});

describe('명암비 (WCAG)', () => {
  it('검정/흰색은 21:1, 같은 색은 1:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });
  it('알려진 값: #777777 / 흰색 ≈ 4.48 (AA 미달), #767676 / 흰색 ≈ 4.54 (AA 통과)', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(4.5);
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
  it('형식이 틀린 색은 알려 준다', () => {
    expect(() => contrastRatio('#fff', '#000000')).toThrow(/#RRGGBB/);
  });
});
