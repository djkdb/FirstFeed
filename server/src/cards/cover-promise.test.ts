// 표지가 꺼낸 사실은 본문이 지킨다 (결정 2026-10-18 · A)
import { describe, expect, it } from 'vitest';
import { coverFacts, coverPromiseIssues, type BodyOutput } from './body.ts';

const cover = (headline: string, sub: string | null = null) => ({ headline, sub, pillarId: null, chip: null });
const body = (...texts: string[]): BodyOutput => ({ cards: texts.map((t, i) => ({ title: `카드 ${i + 1}`, text: t, evidence: t, image: null })), closing: { headline: '저장해 두세요', sub: null } });

describe('표지의 숫자·영문 이름', () => {
  it('개수 표현(5가지)은 빼고, 숫자·영문 이름만 — 허용 목록 약어(DM)는 이름이 아니다', () => {
    expect(coverFacts(cover('SK AIGEN 지원 전 **알아둘 5가지**', '만 19~34세, 50명 안팎 선발'), [])).toEqual(['19', '34', '50', 'SK', 'AIGEN']);
    expect(coverFacts(cover('DM 으로 받는 법'), ['DM'])).toEqual([]);
  });
});

describe('본문이 표지 약속을 지키는가', () => {
  it('sk-aigen 2회 모양: 부제의 「50명」이 본문에 없으면 재작성 사유', () => {
    const c = cover('SK가 AI 인재에\n**매달 300만 원**', '2년 과정, 50명 안팎 선발');
    const b = body('2년 동안 매달 300만 원을 받아요.', 'SK 취업 보장은 없어요.');
    expect(coverPromiseIssues(c, b, ['AI']).map((x) => x.message)).toEqual([expect.stringContaining('"50"')]);
    expect(coverPromiseIssues(c, body('2년 동안 매달 300만 원.', '뽑는 인원은 50명 안팎이에요.', 'SK 취업 보장은 없어요.'), ['AI'])).toEqual([]);
  });
  it('숫자는 표기를 맞춰 비교(1,015 = 1015), 영문은 대소문자 무시', () => {
    expect(coverPromiseIssues(cover('공공 GitLab 프로젝트 1,015개'), body('gitlab 에 1015개가 있어요.'), [])).toEqual([]);
  });
});
