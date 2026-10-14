// 모름 → 선택지를 고른 답(choice)은 보조 근거 (CLAUDE.md 결정 2026-10-14)
import { describe, expect, it } from 'vitest';
import { buildSources, formatSourcesForPrompt } from './sources.ts';
import { profileRules, salvage, validEvidence, type ProfileContext, type ProfileDraft } from './profile.ts';

const sources = buildSources({ S4: { choices: ['정보 정리', '만든 것'] } }, [
  { turnNo: 1, question: '계기는 무엇인가요?', answer: '써 보고 알게 된 걸 정리해 두면 나 같은 학생한테 도움이 되겠다 싶었다', answerKind: 'text' },
  { turnNo: 2, question: '무엇을 만들었나요?', answer: '잘 모르겠어요', answerKind: 'unknown' },
  { turnNo: 3, question: '어떤 게 가까운가요?', answer: '만드는 과정을 기록하는 것', answerKind: 'choice' },
  { turnNo: 4, question: '얻어 갈 것은?', answer: '본 그날 바로 다르게 해 볼 수 있는 것 하나', answerKind: 'text' },
  { turnNo: 5, question: '피할 것은?', answer: '확인 안 한 소문을 퍼 나르는 것', answerKind: 'text' },
]);
const ctx: ProfileContext = { sources, overlapThreshold: 0.5, minQuoteChars: 4, commonTerms: [] };
const pillar = (name: string, description: string, evidence: Array<[string, string]>) => ({
  name,
  description,
  evidence: evidence.map(([quote, source]) => ({ quote, source })),
});
const base: ProfileDraft = {
  account_line: '학생을 위한 도구 정리',
  audience: '대학생',
  pillars: [
    pillar('써 본 것 정리', '써 본 도구 정리', [['써 보고 알게 된 걸 정리해 두면', 'A1']]),
    pillar('오늘 바로', '그날 해 볼 것 하나', [['본 그날 바로 다르게 해 볼 수 있는 것 하나', 'A4']]),
    pillar('확인한 것만', '소문 대신 확인한 내용', [['확인 안 한 소문을 퍼 나르는 것', 'A5']]),
  ],
  voice_rules: ['쉽게', '짧게', '확인한 것만'],
  avoid: [],
  unknown: [],
};
const codes = (d: ProfileDraft) => profileRules(ctx).flatMap((r) => r(d)).map((i) => i.code);

describe('선택지를 고른 답은 보조 근거', () => {
  it('선택지만으로 근거를 대는 축은 choice_only_evidence', () => {
    const d = { ...base, pillars: [...base.pillars, pillar('제작 과정', '만드는 과정 기록', [['만드는 과정을 기록하는 것', 'A3']])] };
    expect(codes(d)).toEqual(['choice_only_evidence']);
  });

  it('직접 입력 근거가 하나라도 함께 있으면 통과하고, 선택지 인용은 보조 근거로 남는다', () => {
    const p = pillar('써 본 것 정리', '써 본 도구 정리', [
      ['써 보고 알게 된 걸 정리해 두면', 'A1'],
      ['만드는 과정을 기록하는 것', 'A3'],
    ]);
    expect(codes({ ...base, pillars: [p, ...base.pillars.slice(1)] })).toEqual([]);
    expect(validEvidence(p, ctx).map((e) => e.weight)).toEqual(['primary', 'supporting']);
  });

  it('설문 근거가 함께 있어도 통과한다', () => {
    const p = pillar('제작 과정', '만드는 과정 기록', [
      ['보여줄 수 있는 것: 정보 정리, 만든 것', 'S4'],
      ['만드는 과정을 기록하는 것', 'A3'],
    ]);
    expect(codes({ ...base, pillars: [...base.pillars, p] })).toEqual([]);
  });

  it('구제 단계에서 선택지만으로 근거를 댄 축은 이유와 함께 「근거 부족」으로 빠진다', () => {
    const d = { ...base, pillars: [...base.pillars, pillar('제작 과정', '만드는 과정 기록', [['만드는 과정을 기록하는 것', 'A3']])] };
    const out = salvage(d, profileRules(ctx).flatMap((r) => r(d)), ctx, 3);
    expect(out).toMatchObject({ kind: 'saved', dropped: [{ name: '제작 과정', reason: '선택지를 고른 답만 근거로 댐' }] });
  });

  it('프롬프트에도 "보조 근거 — 이것만으로는 근거가 되지 않음"으로 보인다', () => {
    expect(formatSourcesForPrompt(sources)).toContain('[A3] 질문: 어떤 게 가까운가요?\n     답 (※ 선택지를 고른 답 — 보조 근거, 이것만으로는 근거가 되지 않음): 만드는 과정을 기록하는 것');
  });

  it('선택지 문장은 숫자·영문 대조의 허용 출처(사용자가 직접 입력한 문장)가 아니다', () => {
    expect(sources.find((s) => s.id === 'A3')).toMatchObject({ weight: 'supporting', countsAsUserInput: false });
  });
});
