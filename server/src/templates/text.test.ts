// 렌더링 직전 글 다듬기 — 넘침 측정(2026-10-15)에서 실제로 나온 줄바꿈 모양
import { describe, expect, it } from 'vitest';
import { polishForRender, textToHtml } from './text.ts';

const show = (s: string) => s.replace(/\u00A0/g, '⍽').replace(/\u2060/g, '⁀'); // 묶은 자리를 눈에 보이게

describe('렌더링 직전 글 다듬기 (원고는 그대로, 그림에 넣는 글만)', () => {
  it('「·」 앞뒤를 묶는다 — 「1,500명 · 87% ·」 / 「3단계」 처럼 줄 끝에 혼자 남지 않게', () => {
    expect(show(polishForRender('1,500명 · 87% · 3단계'))).toBe('1,500명⍽·⍽87%⍽·⍽3단계');
  });

  it('이어진 숫자+단위를 묶는다 — 「3분」 / 「20초」, 날짜', () => {
    expect(show(polishForRender('2026.10.15 · 24시간 · 10,000원 · v1.64.0 · 3분 20초'))).toBe('2026.10.15⍽·⍽24시간⍽·⍽10,000원⍽·⍽v1.64.0⍽·⍽3분⍽20초');
    expect(show(polishForRender('2026년 10월 15일 기준'))).toBe('2026년⍽10월⍽15일 기준');
  });

  it('숫자와 띄어 쓴 단위를 묶는다 — 「5」 / 「가지」', () => {
    expect(show(polishForRender('설정 5 가지, 1,500 원'))).toBe('설정 5⍽가지, 1,500⍽원');
  });

  it('「%」 바로 뒤 한글을 묶는다 — 「88%」 / 「까지」 (공백이 없어 단어 이음표로)', () => {
    expect(show(polishForRender('넣었더니 88%까지 올랐어요'))).toBe('넣었더니 88%⁀까지 올랐어요');
    expect(show(polishForRender('87% · 3단계'))).toBe('87%⍽·⍽3단계');
    expect(show(polishForRender('88% 까지'))).toBe('88%⍽까지');
  });

  it('「~」 범위는 앞뒤를 묶는다 — 「11월 1일」 / 「~15일」', () => {
    expect(show(polishForRender('지원 11월 1일~15일'))).toBe('지원 11월⍽1일⁀~⁀15일');
    expect(show(polishForRender('만 19~34세'))).toBe('만 19⁀~⁀34세');
    expect(polishForRender('가~나')).toBe('가~나');
  });

  it('숫자와 상관없는 띄어쓰기는 그대로 — 줄은 여전히 띄어쓰기에서 바뀐다', () => {
    expect(polishForRender('처음 쓰는 사람을 위한 설정')).toBe('처음 쓰는 사람을 위한 설정');
    expect(show(polishForRender('3단계 안에 끝냈고'))).toBe('3단계 안에 끝냈고');
  });

  it('HTML 로 바꿀 때 다듬기를 거친다', () => {
    expect(show(textToHtml('**87%** · 3단계'))).toBe('<span class="mk">87%</span>⍽·⍽3단계');
  });
});
