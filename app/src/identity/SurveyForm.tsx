// 설문 8문항 (FR-ID-1). 2분 안에 끝나도록 고르기 위주, 글은 덧붙이고 싶을 때만.
import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import type { Question, SurveyAnswers } from './types.ts';

// 작성 중인 설문을 이 브라우저에만 임시 저장한다. 시연 중 원인 모를 새로고침으로 2분 치 입력이 날아간 일이 있어서
// (devlog 2026-10-13-04). 이 브라우저 편의 기능이라 서버에는 보내지 않고, 제출에 성공하면 지운다.
const DRAFT_KEY = 'firstfeed.surveyDraft';

function readDraft(): SurveyAnswers {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as SurveyAnswers) : {};
  } catch {
    return {};
  }
}

export function clearSurveyDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* 저장소를 못 쓰는 브라우저면 지울 것도 없다 */
  }
}

export function SurveyForm({ onSubmit, busy }: { onSubmit: (s: SurveyAnswers) => void; busy: boolean }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<SurveyAnswers>(readDraft);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
    } catch {
      /* 개인 정보 보호 모드 등에서는 임시 저장 없이 동작한다 */
    }
  }, [answers]);

  useEffect(() => {
    void api.api.identity.survey
      .$get()
      .then((r) => r.json())
      .then((b) => setQuestions(b.questions));
  }, []);

  const get = (id: string) => answers[id] ?? { choices: [] };
  // 상태 계산은 항상 "지금 값"(updater 의 a)에서 한다 — 렌더링 때의 answers 로 계산하면, 다음 렌더링 전에 들어온
  // 입력이 앞의 선택을 덮어쓴다 (스크립트로 빠르게 입력하다 고른 항목이 사라지는 것으로 실제로 확인, devlog 2026-10-14-01)
  const update = (id: string, change: (cur: SurveyAnswers[string]) => SurveyAnswers[string]) =>
    setAnswers((a) => ({ ...a, [id]: change(a[id] ?? { choices: [] }) }));
  const set = (id: string, patch: Partial<SurveyAnswers[string]>) => update(id, (cur) => ({ ...cur, ...patch }));

  const toggle = (q: Question, option: string) =>
    update(q.id, (cur) => {
      if (q.maxChoices === 1) return { ...cur, choices: cur.choices[0] === option ? [] : [option] };
      if (cur.choices.includes(option)) return { ...cur, choices: cur.choices.filter((c) => c !== option) };
      const picked = cur.choices.length + (cur.other?.trim() ? 1 : 0);
      return picked < q.maxChoices ? { ...cur, choices: [...cur.choices, option] } : cur;
    });

  const missing = questions.filter((q) => q.required && get(q.id).choices.length === 0 && !get(q.id).other?.trim() && !get(q.id).text?.trim());

  return (
    <form
      className="survey"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(answers);
      }}
    >
      <p className="muted">2분이면 끝나요. 고르기만 해도 되고, 덧붙이고 싶은 말은 칸에 적어 주세요.</p>
      {questions.map((q) => (
        <fieldset key={q.id} className="q">
          <legend>
            <span className="qid">{q.id}</span> {q.label}
            {q.hint && <span className="muted"> · {q.hint}</span>}
            {!q.required && <span className="muted"> · 선택</span>}
          </legend>
          {q.options.length > 0 && (
            <div className="chips">
              {q.options.map((o) => (
                <button type="button" key={o} className={get(q.id).choices.includes(o) ? 'chip on' : 'chip'} onClick={() => toggle(q, o)}>
                  {o}
                </button>
              ))}
            </div>
          )}
          {q.allowOther && (
            <input placeholder="직접 입력 (목록에 없으면)" value={get(q.id).other ?? ''} onChange={(e) => set(q.id, { other: e.target.value })} maxLength={40} />
          )}
          {q.textLabel && <input placeholder={q.textLabel} value={get(q.id).text ?? ''} onChange={(e) => set(q.id, { text: e.target.value })} maxLength={300} />}
        </fieldset>
      ))}
      <div className="actions">
        <button type="submit" className="primary" disabled={busy || missing.length > 0 || questions.length === 0}>
          {busy ? '시작하는 중…' : '인터뷰 시작'}
        </button>
        {missing.length > 0 && <span className="muted">남은 필수 문항: {missing.map((q) => q.id).join(', ')}</span>}
      </div>
    </form>
  );
}
