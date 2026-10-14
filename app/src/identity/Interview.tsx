// AI 인터뷰 (FR-ID-2): 한 번에 질문 하나, 예시 답, 「잘 모르겠어요」. 예시를 눌러 그대로 보내면 서버가 "예시를 고른 답"으로 기록한다.
import { useState } from 'react';
import type { State, Turn } from './types.ts';

const KIND_TAG: Record<string, string> = { example: '예시를 고른 답', choice: '선택지를 고른 답', unknown: '잘 모르겠어요' };

function PastTurn({ t }: { t: Turn }) {
  return (
    <li className="turn">
      <div className="q-text">
        <span className="qid">A{t.turnNo}</span> {t.question}
      </div>
      <div className="a-text">
        {t.answerKind === 'unknown' ? <span className="muted">잘 모르겠어요</span> : t.answer}
        {t.answerKind && KIND_TAG[t.answerKind] && t.answerKind !== 'unknown' && <span className="tag">{KIND_TAG[t.answerKind]}</span>}
      </div>
    </li>
  );
}

export function Interview(props: {
  state: State;
  minTurns: number;
  maxTurns: number;
  busy: boolean;
  onAnswer: (turnNo: number, answer: string, unknown: boolean) => void;
}) {
  const { state, minTurns, maxTurns, busy, onAnswer } = props;
  const [draft, setDraft] = useState('');
  const answered = state.turns.filter((t) => t.answer !== null);
  const current = state.turns.find((t) => t.answer === null) ?? null;

  const send = (text: string, unknown = false) => {
    if (!current) return;
    onAnswer(current.turnNo, text, unknown);
    setDraft('');
  };

  return (
    <div className="interview">
      <p className="muted">
        질문 {answered.length + (current ? 1 : 0)} / 최대 {maxTurns} · 최소 {minTurns}개에 답하면 프로필을 만들 수 있어요
      </p>
      <ol className="turns">
        {answered.map((t) => (
          <PastTurn key={t.turnNo} t={t} />
        ))}
      </ol>
      {current && (
        <div className="current">
          <div className="q-text big">
            <span className="qid">A{current.turnNo}</span> {current.question}
          </div>
          {current.why && <p className="muted small">왜 묻나요? {current.why}</p>}
          {current.options.length > 0 && (
            <div className="chips">
              {current.options.map((o) => (
                <button type="button" key={o} className="chip" disabled={busy} onClick={() => send(o)}>
                  {o}
                </button>
              ))}
            </div>
          )}
          <div className="examples">
            <span className="muted small">예시 (눌러서 고쳐 쓰세요 — 그대로 보내면 「예시를 고른 답」으로 기록돼요)</span>
            {current.examples.map((e) => (
              <button type="button" key={e} className="example" onClick={() => setDraft(e)}>
                {e}
              </button>
            ))}
          </div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="내 말로 답해 주세요" disabled={busy} />
          <div className="actions">
            <button type="button" className="primary" disabled={busy || !draft.trim()} onClick={() => send(draft)}>
              보내기
            </button>
            <button type="button" disabled={busy} onClick={() => send('', true)}>
              잘 모르겠어요
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
