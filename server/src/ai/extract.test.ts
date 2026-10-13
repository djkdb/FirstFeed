import { describe, expect, it } from 'vitest';
import { extractJson, firstBalanced } from './extract.ts';

describe('JSON 꺼내기', () => {
  it('구조화 결과가 있으면 그것을 쓴다', () => {
    expect(extractJson({ a: 1 }, '무시되는 글')).toEqual({ ok: true, value: { a: 1 }, via: 'structured' });
  });

  it('글 전체가 JSON 이면 그대로', () => {
    expect(extractJson(undefined, ' {"a":1} ')).toMatchObject({ ok: true, via: 'plain' });
  });

  it('코드 블록 안의 JSON', () => {
    expect(extractJson(undefined, '결과입니다:\n```json\n{"a": [1, 2]}\n```\n끝')).toEqual({ ok: true, value: { a: [1, 2] }, via: 'fence' });
  });

  it('설명 글 사이에 섞인 JSON (문자열 속 괄호는 무시)', () => {
    const r = extractJson(undefined, '여기요 {"t": "괄호 } 포함", "n": [1]} 이상입니다');
    expect(r).toEqual({ ok: true, value: { t: '괄호 } 포함', n: [1] }, via: 'balanced' });
  });

  it('끝 쉼표·작은따옴표 같은 깨진 JSON 은 복구한다', () => {
    const r = extractJson(undefined, "{'a': 1, 'b': [1, 2,],}");
    expect(r).toEqual({ ok: true, value: { a: 1, b: [1, 2] }, via: 'repaired' });
  });

  it('JSON 이 없으면 실패를 알린다', () => {
    const r = extractJson(undefined, '죄송하지만 답할 수 없습니다.');
    expect(r.ok).toBe(false);
  });

  it('완결되지 않은 괄호는 null', () => {
    expect(firstBalanced('{"a": [1, 2}')).toBeNull();
  });
});
