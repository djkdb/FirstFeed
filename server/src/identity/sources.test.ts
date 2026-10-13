import { describe, expect, it } from 'vitest';
import { buildSources, classifyAnswer, formatSourcesForPrompt } from './sources.ts';
import { surveyAnswerText, validateSurvey } from './survey.ts';

describe('설문 (FR-ID-1)', () => {
  it('고른 것·직접 입력·덧붙인 글을 한 문장으로', () => {
    expect(surveyAnswerText({ choices: ['IT·AI', '개발'], other: '바이브코딩' })).toBe('IT·AI, 개발, 바이브코딩');
    expect(surveyAnswerText({ choices: ['안 한다'], text: '직접 만든 캐릭터로 대신한다' })).toBe('안 한다 — 직접 만든 캐릭터로 대신한다');
  });

  it('필수 문항·개수·목록 밖 답을 검사한다', () => {
    const problems = validateSurvey({ S2: { choices: ['IT·AI', '개발', '디자인'], other: '바이브코딩' }, S5: { choices: ['100'] } });
    expect(problems.some((p) => p.startsWith('S1'))).toBe(true); // 필수인데 비어 있음
    expect(problems.some((p) => p.startsWith('S2') && p.includes('최대 3개'))).toBe(true);
    expect(problems.some((p) => p.startsWith('S5') && p.includes('목록에 없는'))).toBe(true);
    expect(problems.some((p) => p.startsWith('S7'))).toBe(false); // 선택 문항
  });
});

describe('답의 종류 판정 — 예시 답 순환 막기', () => {
  const examples = ['AI 도구를 써 본 후기를 정리하고 싶어요', '만든 앱을 알리고 싶어요'];
  it('예시를 그대로 보내면 example (공백·문장부호만 다른 것도)', () => {
    expect(classifyAnswer('AI 도구를 써 본 후기를 정리하고 싶어요', examples, [], false)).toBe('example');
    expect(classifyAnswer('AI도구를 써본 후기를 정리하고 싶어요!!', examples, [], false)).toBe('example');
  });

  it('예시를 조금이라도 고치면 직접 입력(text)', () => {
    expect(classifyAnswer('AI 도구를 써 본 후기를 정리하고 싶어요. 특히 Claude', examples, [], false)).toBe('text');
    expect(classifyAnswer('AI 도구를 써 본 후기를 기록하고 싶어요', examples, [], false)).toBe('text');
  });

  it('모름 뒤 선택지를 고르면 choice, 모름 버튼은 unknown', () => {
    expect(classifyAnswer('정보 정리', [], ['정보 정리', '만든 것'], false)).toBe('choice');
    expect(classifyAnswer('잘 모르겠어요', [], [], true)).toBe('unknown');
  });

  it('출처: 예시를 고른 답은 화면 표시가 다르고 직접 입력 근거로 세지 않는다. 모름 답은 출처가 아니다', () => {
    const sources = buildSources({ S1: { choices: ['대학생'], text: '소프트웨어학부' } }, [
      { turnNo: 1, question: '왜 시작했나요?', answer: '직접 쓴 답', answerKind: 'text' },
      { turnNo: 2, question: '무엇을?', answer: examples[0]!, answerKind: 'example' },
      { turnNo: 3, question: '누구에게?', answer: '잘 모르겠어요', answerKind: 'unknown' },
    ]);
    expect(sources.map((s) => [s.id, s.label, s.countsAsUserInput])).toEqual([
      ['S1', '설문 S1 지금 하는 일', true],
      ['A1', '인터뷰 1번 답', true],
      ['A2', '인터뷰 2번 답 · 예시를 고른 답', false],
    ]);
    // 질문 글(AI 가 씀)은 대조 원문에 넣지 않는다
    expect(sources.find((s) => s.id === 'A1')?.text).toBe('직접 쓴 답');
    expect(formatSourcesForPrompt(sources)).toContain('근거로 인용하지 말 것');
  });
});
