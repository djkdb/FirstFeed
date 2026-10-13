// 이 파일의 이메일 등은 전부 가짜다. check:privacy 허용 목록에 이 파일 경로가 이유와 함께 올라 있다.
import { describe, expect, it } from 'vitest';
import { describeFinding, scanFile, validateAllowlist } from './privacy.ts';
import { buildManifest } from './fixtures.ts';

describe('허용 목록', () => {
  it('항목마다 이유 한 줄이 없으면 거절한다', () => {
    const r = validateAllowlist({ entries: [{ value: 'a@example.com' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/reason/);
  });

  it('이유가 빈칸이거나 여러 줄이면 거절한다', () => {
    expect(validateAllowlist({ entries: [{ value: 'x', reason: '   ' }] }).ok).toBe(false);
    expect(validateAllowlist({ entries: [{ value: 'x', reason: '첫 줄\n둘째 줄' }] }).ok).toBe(false);
  });

  it('path 와 value 를 둘 다 적거나 둘 다 안 적으면 거절한다', () => {
    expect(validateAllowlist({ entries: [{ path: 'a', value: 'b', reason: '이유' }] }).ok).toBe(false);
    expect(validateAllowlist({ entries: [{ reason: '이유' }] }).ok).toBe(false);
  });

  it('올바른 목록은 통과한다', () => {
    expect(validateAllowlist({ entries: [{ value: 'noreply@example.com', reason: '공개 안내 주소' }] }).ok).toBe(true);
  });
});

describe('파일 검사', () => {
  const list = { entries: [{ value: 'noreply@example.com', reason: '공개 안내 주소' }] };

  it('허용한 값만 빼고 나머지는 잡는다', () => {
    const found = scanFile('docs/a.md', '문의 noreply@example.com, 담당 kim@example.com', list);
    expect(found.map((f) => f.match)).toEqual(['kim@example.com']);
  });

  it('허용한 경로의 파일은 통째로 건너뛴다', () => {
    expect(scanFile('x.test.ts', 'kim@example.com', { entries: [{ path: 'x.test.ts', reason: '테스트용 가짜 값' }] })).toEqual([]);
  });

  it('터미널 출력에 값 전체를 다시 드러내지 않는다', () => {
    const [f] = scanFile('docs/a.md', '\n담당 kim@example.com', { entries: [] });
    expect(describeFinding(f!)).toBe('docs/a.md:2  [이메일] kim****');
  });
});

describe('비공개 자료 목록', () => {
  it('파일 이름과 묶음별 건수만 담는다', () => {
    const m = buildManifest([
      { path: 'interviews/friend-01.json', group: 'interviews' },
      { path: 'notices/notice-01.md', group: 'notices' },
      { path: 'notices/notice-02.md', group: 'notices' },
    ]);
    expect(m.counts).toEqual({ interviews: 1, notices: 2 });
    expect(Object.keys(m)).toEqual(['note', 'counts', 'files']);
  });
});
