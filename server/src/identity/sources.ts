// 프로필 근거의 출처 목록. 설문 답(S1~S8)과 인터뷰 답(A1~A10)에 ID 를 붙여, AI 가 인용마다 출처를 밝히고 코드가 그 출처 안에서만 대조하게 한다.
import { normalizeForQuote } from '../rules/grounding.ts';
import { SURVEY, surveyAnswerText, type SurveyAnswers } from './survey.ts';

/** text: 직접 입력 / example: 예시를 그대로 보냄 / choice: 선택지를 고름 / unknown: 잘 모르겠어요 */
export type AnswerKind = 'text' | 'example' | 'choice' | 'unknown';
export type EvidenceWeight = 'primary' | 'supporting' | 'none';

export interface EvidenceSource {
  id: string; // S2, A3 …
  label: string; // 화면에 보일 출처 이름
  /**
   * 인용을 대조할 원문. 설문은 "라벨: 답" 한 문장(CLAUDE.md 근거 규칙), 인터뷰는 답 부분만(질문 글은 AI 가 쓴 것이라 넣지 않는다)
   */
  text: string;
  /** 설문 라벨 — 라벨만 인용한 것은 근거가 아니므로 가려내려고 */
  surveyLabel?: string;
  kind: 'survey' | AnswerKind;
  /**
   * 근거로서의 무게 (CLAUDE.md 결정 2026-10-14):
   *  - primary: 설문 답·직접 입력 — 이것 하나로 축의 근거가 된다
   *  - supporting: 모름 뒤 선택지를 고른 답 — 선택지도 AI 가 쓴 문장이라, 다른 주 근거와 함께일 때만 센다
   *  - none: 예시를 그대로 보낸 답 — AI 가 쓴 문장이라 근거로 세지 않는다
   */
  weight: EvidenceWeight;
  /** "사용자가 직접 입력한 문장"(허용 출처 4) — 숫자·영문 대조에 쓴다. 주 근거만 해당 */
  countsAsUserInput: boolean;
  question?: string;
  /** 답하는 방식이 글이 아니었을 때 무엇을 보였고 무엇을 골랐는지(인터뷰 다양화 v3) — 프롬프트에 같이 보인다 */
  context?: string;
}

export interface TurnLike {
  turnNo: number;
  question: string;
  answer: string | null;
  answerKind: AnswerKind | null;
  format?: 'open' | 'this_or_that' | 'rewrite' | 'scale';
  options?: string[];
  sample?: string | null;
  scale?: { left: string; right: string } | null;
  pick?: string | null;
}

/** 글이 아닌 방식의 답 — 무엇을 보였고 무엇을 골랐는지 한 줄 */
function turnContext(t: TurnLike): string | undefined {
  if (t.format === 'this_or_that') return `둘 중 고르기 「${t.options?.[0] ?? ''}」 / 「${t.options?.[1] ?? ''}」 → 「${t.pick ?? ''}」를 고름${t.answerKind === 'choice' ? '' : ' · 아래는 고른 이유'}`;
  if (t.format === 'scale' && t.scale) return `말투 척도 「${t.scale.left}」 1~5 「${t.scale.right}」 → ${t.pick ?? '?'}${t.answerKind === 'choice' ? '' : ' · 아래는 덧붙인 말'}`;
  if (t.format === 'rewrite') return `예시 문장 「${t.sample ?? ''}」을 내 말투로 고쳐 쓴 답 — 말투 규칙의 근거`;
  return undefined;
}

/**
 * 답의 종류를 서버가 판정한다 (화면이 보낸 표시를 믿지 않는다).
 * 예시와 정규화(공백·문장부호 제거) 뒤 **완전히 같으면** example — 조금이라도 고쳤으면 직접 입력(text)으로 본다.
 */
export function classifyAnswer(answer: string, examples: string[], options: string[], unknown: boolean): AnswerKind {
  if (unknown) return 'unknown';
  const n = normalizeForQuote(answer);
  if (examples.some((e) => normalizeForQuote(e) === n)) return 'example';
  if (options.some((o) => normalizeForQuote(o) === n)) return 'choice';
  return 'text';
}

export function buildSources(survey: SurveyAnswers, turns: TurnLike[]): EvidenceSource[] {
  const out: EvidenceSource[] = [];
  for (const q of SURVEY) {
    const answer = surveyAnswerText(survey[q.id]);
    // 대조 원문은 프롬프트에 보이는 줄과 같은 "라벨: 답" 문장이어야 한다. 예전에는 답 글자만 넣어서, 보이는 줄 그대로 인용하면
    // quote_not_in_source, 짧은 답만 인용하면 quote_too_short 가 되는 어긋남이 있었다 (devlog 2026-10-14-01)
    if (answer) {
      out.push({
        id: q.id,
        label: `설문 ${q.id} ${q.label}`,
        text: `${q.label}: ${answer}`,
        surveyLabel: q.label,
        kind: 'survey',
        weight: 'primary',
        countsAsUserInput: true,
      });
    }
  }
  for (const t of turns) {
    if (t.answer === null || t.answerKind === null || t.answerKind === 'unknown') continue;
    const suffix = t.answerKind === 'example' ? ' · 예시를 고른 답' : t.answerKind === 'choice' ? ' · 선택지를 고른 답' : '';
    out.push({
      id: `A${t.turnNo}`,
      label: `인터뷰 ${t.turnNo}번 답${suffix}`,
      text: t.answer,
      kind: t.answerKind,
      weight: t.answerKind === 'example' ? 'none' : t.answerKind === 'choice' ? 'supporting' : 'primary',
      countsAsUserInput: t.answerKind === 'text',
      question: t.question,
      context: turnContext(t),
    });
  }
  return out;
}

/** 프롬프트에 넣을 출처 목록 글. 예시를 그대로 고른 답은 근거로 쓰지 말라고 표시한다 */
export function formatSourcesForPrompt(sources: EvidenceSource[]): string {
  return sources
    .map((s) => {
      if (s.kind === 'survey') return `[${s.id}] ${s.text}`;
      const mark =
        s.kind === 'example'
          ? ' (※ 예시 답을 그대로 고른 것 — 근거로 인용하지 말 것)'
          : s.kind === 'choice'
            ? ' (※ 선택지를 고른 답 — 보조 근거, 이것만으로는 근거가 되지 않음)'
            : '';
      return `[${s.id}] 질문: ${s.question}${s.context ? `\n     (${s.context})` : ''}\n     답${mark}: ${s.text}`;
    })
    .join('\n');
}
