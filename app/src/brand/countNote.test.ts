import { describe, expect, it } from 'vitest';
import { COUNT_PENDING_NOTE, countNote } from './countNote.ts';

describe('글자 수 「확인 대기」 안내 (PRD v0.2 FR-BR-1)', () => {
  it('인스타에서 세는 방식을 확인하기 전에는 안내를 보인다', () => {
    const n = countNote(false);
    expect(n?.note).toBe(COUNT_PENDING_NOTE);
    expect(n?.note).toContain('확인 대기');
    expect(n?.detail).toContain('이모지');
  });
  it('확인한 뒤에는 보이지 않는다', () => {
    expect(countNote(true)).toBeNull();
  });
});
