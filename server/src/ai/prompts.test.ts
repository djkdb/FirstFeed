import { describe, expect, it } from 'vitest';
import { loadPrompt } from './prompts.ts';

describe('프롬프트 파일', () => {
  it('맨 앞 메모 주석을 빼고 변수를 채운다', () => {
    const p = loadPrompt(null, '_system/json_retry', { error: '필드 facts 가 없음' });
    expect(p.text.startsWith('<!--')).toBe(false);
    expect(p.text).toContain('문제: 필드 facts 가 없음');
    expect(p.ref).toEqual({ name: '_system/json_retry', version: 'v1' });
  });

  it('채울 값이 빠지면 알려 준다', () => {
    expect(() => loadPrompt(null, '_system/json_retry', {})).toThrow(/채울 값이 없습니다: error/);
  });

  it('없는 변수를 넘기면(오타) 알려 준다', () => {
    expect(() => loadPrompt(null, '_system/json_retry', { error: 'x', eror: 'y' })).toThrow(/없는 변수/);
  });

  it('없는 파일은 무엇을 하면 되는지 알려 준다', () => {
    expect(() => loadPrompt(null, '없는_프롬프트', {})).toThrow(/파일을 만들거나/);
  });
});
