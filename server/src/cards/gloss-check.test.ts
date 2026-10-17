import { describe, expect, it } from 'vitest';
import { findRawSpan } from './gloss-check.ts';

describe('고칠 풀이 문장의 실제 자리', () => {
  it('강조·문장부호가 달라도 원래 글의 그 구간을 찾고, 문장 끝 마침표까지 포함한다', () => {
    const text = '태그만 붙이면 노트가 묶여요. **태그는** 노트에 다는 이름표예요. 처음엔 태그부터.';
    const span = findRawSpan(text, '태그는 노트에 다는 이름표예요');
    expect(span && text.slice(...span)).toBe('**태그는** 노트에 다는 이름표예요.');
  });
  it('강조가 문장 안에서 닫히면 바깥 ** 은 건드리지 않는다', () => {
    const text = '앞 문장이에요. 마크다운은 **기호로** 적는 글이에요. **다음 강조**';
    const span = findRawSpan(text, '마크다운은 기호로 적는 글이에요.');
    expect(span && text.slice(...span)).toBe('마크다운은 **기호로** 적는 글이에요.');
  });
  it('없으면 null', () => {
    expect(findRawSpan('태그만 붙이면 노트가 묶여요.', 'Markdown은 글 파일 형식이에요.')).toBeNull();
  });
});
