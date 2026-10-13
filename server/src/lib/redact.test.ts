// 이 파일의 이메일·전화번호·키는 전부 가짜다. check:privacy 허용 목록에 이 파일 경로가 이유와 함께 올라 있다.
import { describe, expect, it } from 'vitest';
import { findSensitive, redact } from './redact.ts';

describe('개인정보·비밀 값 찾기', () => {
  it.each([
    ['이메일', '연락은 test.user+ff@example.co.kr 로', 'email'],
    ['휴대폰(하이픈)', '담당자 010-1234-5678', 'phone'],
    ['휴대폰(붙여 씀)', '담당자 01012345678', 'phone'],
    ['서울 지역번호', '대표 02-123-4567', 'phone'],
    ['경기 지역번호', '대표 031-1234-5678', 'phone'],
    ['국제 표기', '+82 10-1234-5678', 'phone'],
    ['Anthropic 키', 'ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwxyz012345', 'api_key'],
    ['GitHub 토큰', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789AB', 'api_key'],
    ['Google 키', 'AIzaSyA-abcdefghijklmnopqrstuvwxyz0123456', 'api_key'],
    ['이름 붙은 비밀 값', 'naver app_password: abcd1234efgh', 'secret_assignment'],
    ['한글 이름 붙은 비밀 값', '앱 비밀번호 = qwer5678tyui', 'secret_assignment'],
    ['JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U', 'jwt'],
  ])('%s 를 찾는다', (_name, text, kind) => {
    const found = findSensitive(text);
    expect(found.map((f) => f.kind)).toContain(kind);
  });

  it.each([
    ['날짜', '마감은 2026-10-13 23:59'],
    ['버전', 'Claude Code 2.1.296, Node v24.18.0'],
    ['팔로워 숫자', '한 달 만에 팔로워 1,500명'],
    ['npm 패키지 주소', 'https://registry.npmjs.org/@types/node/-/node-24.19.2.tgz'],
    ['금액', '원고료 300,000원'],
    ['세션 ID', '6887510c-f5b2-49b7-a2cf-d074e050fe51'],
  ])('%s 는 잘못 잡지 않는다', (_name, text) => {
    expect(findSensitive(text)).toEqual([]);
  });

  it('가린 글에는 원래 값이 남지 않고, 비밀 값은 이름을 남긴다', () => {
    const src = '메일 a.b@example.com / 전화 010-9876-5432 / token=abcdefgh12345678';
    const { text, findings } = redact(src);
    expect(findings).toHaveLength(3);
    expect(text).toBe('메일 [이메일 가림] / 전화 [전화번호 가림] / token=[비밀 값 가림]');
  });

  it('찾은 위치의 줄 번호를 알려준다', () => {
    const [f] = findSensitive('첫 줄\n둘째 줄\n셋째 줄 x@example.com');
    expect(f?.line).toBe(3);
  });
});
