import { describe, expect, it } from 'vitest';
import { followupRules, type Followup, type FollowupContext } from './followup.ts';

const base: Followup = {
  question: '최근에 직접 써 본 AI 도구 중 남에게 알려 주고 싶었던 것은 무엇인가요?',
  why: '축의 구체적인 소재를 찾으려고',
  examples: ['Claude Code 로 앱을 만든 과정', '노션 AI 로 수업 정리를 바꾼 경험'],
  options: [],
  target: '구체적인 경험',
  ready_for_profile: false,
};
const ctx: FollowupContext = { previousQuestions: ['계정을 시작한 계기는 무엇인가요?'], lastAnswerUnknown: false, duplicateThreshold: 0.6 };
const codes = (d: Followup, c: FollowupContext = ctx) => followupRules(c).flatMap((r) => r(d)).map((i) => i.code);

describe('인터뷰 꼬리질문 규칙 (FR-ID-2)', () => {
  it('좋은 질문은 통과', () => {
    expect(codes(base)).toEqual([]);
  });

  it('한 번에 질문 두 개는 안 된다', () => {
    expect(codes({ ...base, question: '무엇을 만들었나요? 그리고 누구에게 보여 주고 싶나요?' })).toEqual(['multiple_questions']);
  });

  it('앞에서 한 질문과 거의 같으면 안 된다', () => {
    expect(codes({ ...base, question: '계정을 시작하게 된 계기는 무엇인가요?' })).toEqual(['duplicate_question']);
  });

  it('"잘 모르겠어요" 뒤에는 선택지 3~5개가 있어야 한다', () => {
    const c = { ...ctx, lastAnswerUnknown: true };
    expect(codes(base, c)).toEqual(['unknown_needs_options']);
    expect(codes({ ...base, options: ['정보 정리', '만든 것', '과정 기록'] }, c)).toEqual([]);
  });

  it('예시 답끼리 거의 같으면 안 된다', () => {
    expect(codes({ ...base, examples: ['Claude Code 로 앱을 만든 과정', 'Claude Code 로 앱을 만든 과정이요'] })).toEqual(['similar_examples']);
  });
});
