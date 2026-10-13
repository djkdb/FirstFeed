// 정체성 설문 (FR-ID-1): 2분 안에 끝나는 8문항. 질문 목록은 설정값이 아니라 제품 내용이라 여기 한 곳에 두고, 화면은 API 로 받아 그린다.
import { z } from 'zod';

export interface SurveyQuestion {
  id: string; // S1 … S8 — 프로필 인용의 출처 ID 로도 쓴다
  label: string;
  hint?: string;
  options: string[];
  /** 고를 수 있는 개수. 0 이면 고르는 칸 없이 글만 */
  maxChoices: number;
  /** "직접 입력" 칸을 줄지 (고르기 목록에 없는 답) */
  allowOther: boolean;
  /** 덧붙이는 글 칸의 이름. 없으면 글 칸 없음 */
  textLabel?: string;
  required: boolean;
}

export const SURVEY: SurveyQuestion[] = [
  {
    id: 'S1',
    label: '지금 하는 일',
    options: ['대학생', '대학원생', '직장인', '프리랜서', '창업/사이드 프로젝트', '기타'],
    maxChoices: 1,
    allowOther: false,
    textLabel: '전공·직무',
    required: true,
  },
  {
    id: 'S2',
    label: '관심 분야',
    hint: '최대 3개',
    options: ['IT·AI', '개발', '디자인', '공부·자기계발', '커리어', '여행', '음식', '운동', '책·영화'],
    maxChoices: 3,
    allowOther: true,
    required: true,
  },
  { id: 'S3', label: '계정 목표', hint: '최대 2개', options: ['포트폴리오', '홍보', '수익', '기록'], maxChoices: 2, allowOther: false, textLabel: '덧붙일 말', required: true },
  {
    id: 'S4',
    label: '보여줄 수 있는 것',
    hint: '여러 개',
    options: ['만든 것', '공부한 것', '과정/비하인드', '정보 정리', '리뷰/추천', '일상'],
    maxChoices: 6,
    allowOther: false,
    required: true,
  },
  { id: 'S5', label: '한 주에 올릴 수 있는 횟수', options: ['1', '2~3', '4~5', '매일'], maxChoices: 1, allowOther: false, required: true },
  {
    id: 'S6',
    label: '얼굴 노출',
    options: ['괜찮다', '일부만(손·뒷모습)', '안 한다'],
    maxChoices: 1,
    allowOther: false,
    textLabel: '덧붙일 말',
    required: true,
  },
  { id: 'S7', label: '이 계정을 누가 봤으면 좋겠나요', options: [], maxChoices: 0, allowOther: false, textLabel: '보는 사람', required: false },
  { id: 'S8', label: '지금 떠오르는 계정 소개 한 줄', hint: '모르겠으면 비워 두세요', options: [], maxChoices: 0, allowOther: false, textLabel: '한 줄', required: false },
];

export const SurveyAnswer = z.object({
  choices: z.array(z.string()).default([]),
  other: z.string().max(40).optional(),
  text: z.string().max(300).optional(),
});
export type SurveyAnswer = z.infer<typeof SurveyAnswer>;
export const SurveyAnswers = z.record(z.string(), SurveyAnswer);
export type SurveyAnswers = z.infer<typeof SurveyAnswers>;

/** 설문 답 검사. 문제 목록을 돌려준다 (비어 있으면 통과) */
export function validateSurvey(answers: SurveyAnswers): string[] {
  const problems: string[] = [];
  for (const q of SURVEY) {
    const a = answers[q.id] ?? { choices: [] };
    const picked = a.choices.length + (a.other?.trim() ? 1 : 0);
    if (a.choices.some((c) => !q.options.includes(c))) problems.push(`${q.id} ${q.label}: 목록에 없는 답이 있습니다.`);
    if (q.maxChoices > 0 && picked > q.maxChoices) problems.push(`${q.id} ${q.label}: 최대 ${q.maxChoices}개까지 고를 수 있습니다.`);
    const empty = picked === 0 && !a.text?.trim();
    if (q.required && empty) problems.push(`${q.id} ${q.label}: 답을 골라 주세요.`);
  }
  return problems;
}

/** 설문 답 → 근거 원문. 고른 것은 쉼표로, 덧붙인 글은 " — " 뒤에 (CLAUDE.md 결정 6: "관심 분야: AI 도구" 같은 문장) */
export function surveyAnswerText(a: SurveyAnswer | undefined): string {
  if (!a) return '';
  const picks = [...a.choices, ...(a.other?.trim() ? [a.other.trim()] : [])].join(', ');
  const text = a.text?.trim() ?? '';
  return picks && text ? `${picks} — ${text}` : picks || text;
}
