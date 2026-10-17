import { describe, expect, it } from 'vitest';
import { trimHashtags } from './caption.ts';
import { folderSlug } from './export.ts';

describe('해시태그는 코드가 자른다 (결정 2026-10-18 · 상한은 설정, 재작성 사유 아님)', () => {
  it('모양이 맞는 것만 · 같은 것은 하나로(대소문자 무시) · 상한까지', () => {
    const r = trimHashtags(['#클로드코드', '#ClaudeCode', '#claudecode', '띄어 쓴 태그', '#AI개발', '#스킬', '#개발자도구', '#바이브코딩'], 5);
    expect(r.kept).toEqual(['#클로드코드', '#ClaudeCode', '#AI개발', '#스킬', '#개발자도구']);
    expect(r.cut).toEqual(['#바이브코딩']);
  });
});

describe('업로드 폴더 이름', () => {
  it('강조·줄바꿈을 지우고 운영체제가 못 쓰는 글자를 빼고 공백은 하이픈', () => {
    expect(folderSlug('모아 1.2\n**바뀐 것** 5가지')).toBe('모아-1.2-바뀐-것-5가지');
    expect(folderSlug('A/B: "정리"?')).toBe('AB-정리');
    expect(folderSlug('***')).toBe('카드뉴스');
  });
});
