import { describe, expect, it, vi } from 'vitest';
import { loadError } from './loadError.ts';

describe('loadError', () => {
  it('브라우저 · JSON 단계의 영어 오류는 화면 문구에 넣지 않는다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const m = loadError(new SyntaxError("Failed to execute 'json' on 'Response': Unexpected end of JSON input"));
    expect(m).not.toMatch(/Failed|JSON/);
    expect(m).toContain('npm run dev');
  });
  it('서버가 보낸 한국어 오류는 그대로', () => {
    expect(loadError(new Error('브랜드 탭에서 팔레트를 먼저 고르세요.'))).toBe('불러오지 못했어요: 브랜드 탭에서 팔레트를 먼저 고르세요.');
  });
});
