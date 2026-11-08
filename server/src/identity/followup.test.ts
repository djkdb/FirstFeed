import { describe, expect, it } from 'vitest';
import { followupRules, type Followup, type FollowupContext } from './followup.ts';

const base: Followup = {
  question: '최근에 직접 써 본 AI 도구 중 남에게 알려 주고 싶었던 것은 무엇인가요?',
  why: '축의 구체적인 소재를 찾으려고',
  examples: ['Claude Code 로 앱을 만든 과정', '노션 AI 로 수업 정리를 바꾼 경험'],
  options: [],
  target: '구체적인 경험',
  ready_for_profile: false,
  lens: null,
  format: 'open',
  sample: '',
  scaleLeft: '',
  scaleRight: '',
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

describe('인터뷰 다양화 — 각도 · 방식 규칙 (꼬리질문 v3, 2026-11-08)', () => {
  const variety = { window: 5, minDistinctLenses: 4, formatBy: 4 };
  const v3 = (prev: FollowupContext['previous'], extra: Partial<FollowupContext> = {}): FollowupContext => ({ ...ctx, previous: prev, variety, ...extra });
  const q: Followup = { ...base, lens: 'opinion', format: 'open' };

  it('방식마다 차야 하는 칸: 둘 중 고르기는 선택지 정확히 2개 · 고쳐 쓰기는 예시 문장 · 척도는 양 끝', () => {
    expect(codes({ ...q, format: 'this_or_that', options: ['정리해서', '이야기로', '그림으로'] }, v3([]))).toContain('format_pick_two');
    expect(codes({ ...q, format: 'this_or_that', options: ['정리해서 보여 주기', '정리해서 보여 주기!'] }, v3([]))).toContain('format_pick_same');
    expect(codes({ ...q, format: 'this_or_that', examples: [], options: ['정리해서 보여 주기', '겪은 이야기로'] }, v3([]))).toEqual([]);
    expect(codes({ ...q, lens: 'voice', format: 'rewrite', examples: [], sample: '짧음' }, v3([]))).toContain('format_rewrite_sample');
    expect(codes({ ...q, lens: 'voice', format: 'rewrite', examples: [], sample: '오늘은 에러 메시지를 읽는 법을 정리해 봤어요.' }, v3([]))).toEqual([]);
    expect(codes({ ...q, lens: 'voice', format: 'scale', examples: [], scaleLeft: '진지하게', scaleRight: '' }, v3([]))).toContain('format_scale_ends');
  });
  it('같은 각도를 연달아 묻지 않는다 — 단 「잘 모르겠어요」 뒤 다시 묻기는 괜찮다', () => {
    expect(codes(q, v3([{ lens: 'opinion', format: 'open' }]))).toContain('lens_repeat');
    expect(codes({ ...q, options: ['가', '나', '다'] }, v3([{ lens: 'opinion', format: 'open' }], { lastAnswerUnknown: true }))).not.toContain('lens_repeat');
  });
  it('「잘 모르겠어요」 뒤에는 글로 답하기로', () => {
    expect(codes({ ...q, format: 'this_or_that', options: ['가', '나'] }, v3([], { lastAnswerUnknown: true }))).toContain('unknown_needs_open');
  });
  it('최근 5개 안에서 각도 4가지 이상 — 고정 질문(각도 모름)은 세지 않는다', () => {
    const prev: FollowupContext['previous'] = [
      { lens: 'experience', format: 'open' },
      { lens: 'opinion', format: 'this_or_that' },
      { lens: 'experience', format: 'open' },
      { lens: 'struggle', format: 'open' },
    ];
    expect(codes({ ...q, lens: 'opinion' }, v3(prev))).toContain('lens_variety');
    expect(codes({ ...q, lens: 'quirk' }, v3(prev))).not.toContain('lens_variety');
    expect(codes({ ...q, lens: 'opinion' }, v3([{ lens: null, format: 'open' }, { lens: null, format: 'open' }, { lens: null, format: 'open' }, { lens: 'experience', format: 'open' }]))).not.toContain('lens_variety');
  });
  it('네 번째 질문까지 모두 글이면 다른 방식을 섞게', () => {
    const prev: FollowupContext['previous'] = [
      { lens: 'experience', format: 'open' },
      { lens: 'opinion', format: 'open' },
      { lens: 'struggle', format: 'open' },
    ];
    expect(codes({ ...q, lens: 'quirk' }, v3(prev))).toContain('format_variety');
    expect(codes({ ...q, lens: 'quirk', format: 'this_or_that', options: ['가볍게', '깊게'] }, v3(prev))).not.toContain('format_variety');
  });
  it('말투를 한 번도 안 물었으면 ready_for_profile 은 안 된다', () => {
    expect(codes({ ...q, ready_for_profile: true }, v3([{ lens: 'experience', format: 'open' }]))).toContain('voice_before_ready');
    expect(codes({ ...q, ready_for_profile: true }, v3([{ lens: 'experience', format: 'rewrite' }]))).not.toContain('voice_before_ready');
  });
  it('v2 문맥(previous 없음)에는 각도 · 방식 규칙을 걸지 않는다 — 같은 코드로 v2 와 비교 측정', () => {
    expect(codes(base)).toEqual([]);
  });
});
