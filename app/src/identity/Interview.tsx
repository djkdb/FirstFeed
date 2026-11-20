// AI 인터뷰 (FR-ID-2): 한 번에 질문 하나. 인터뷰 다양화(2026-11-08)로 답하는 방식이 넷 —
// 글로 답하기(예시 답) · 둘 중 고르기(+ 이유 한 줄) · 고쳐 쓰기(예시 문장을 내 말투로) · 말투 척도(1~5 + 덧붙일 말).
// 무엇이 「직접 쓴 글」인지는 서버가 정한다(예시를 그대로 보내면 근거가 아님, 고른 것만이면 보조 근거)
import { useState } from 'react';
import type { State, Turn } from './types.ts';

const KIND_TAG: Record<string, string> = { example: '예시를 그대로 보냄', choice: '고른 답', unknown: '잘 모르겠어요' };
const LENS_LABEL: Record<string, string> = {
  experience: '경험',
  opinion: '관점',
  reason: '이유',
  struggle: '삽질',
  quirk: '고집·취향',
  others_view: '남이 보는 나',
  audience: '보는 사람',
  voice: '말투',
};
const FORMAT_TAG: Record<string, string> = { this_or_that: '둘 중 고르기', rewrite: '고쳐 쓰기', scale: '말투 척도' };

function PastTurn({ t }: { t: Turn }) {
  return (
    <li className="turn">
      <div className="q-text">
        <span className="qid">A{t.turnNo}</span> {t.question}
        {t.lens && <span className="tag lens">{LENS_LABEL[t.lens] ?? t.lens}</span>}
      </div>
      {t.format === 'rewrite' && t.sample && <div className="muted small">예시 문장: {t.sample}</div>}
      {t.format === 'this_or_that' && t.pick && t.answerKind !== 'choice' && <div className="muted small">고름: {t.pick}</div>}
      {t.format === 'scale' && t.scale && t.pick && t.answerKind !== 'choice' && (
        <div className="muted small">
          {t.scale.left} ↔ {t.scale.right}: {t.pick}
        </div>
      )}
      <div className="a-text">
        {t.answerKind === 'unknown' ? <span className="muted">잘 모르겠어요</span> : t.answer}
        {t.answerKind && KIND_TAG[t.answerKind] && t.answerKind !== 'unknown' && <span className="tag">{KIND_TAG[t.answerKind]}</span>}
        {FORMAT_TAG[t.format] && <span className="tag">{FORMAT_TAG[t.format]}</span>}
      </div>
    </li>
  );
}

type OnAnswer = (turnNo: number, answer: string, unknown: boolean, pick?: string | null, scale?: number | null) => void;

/** 지금 질문의 답 칸 — 방식마다 다르다. key 로 질문이 바뀔 때 새로 그려 입력이 남지 않게 */
function AnswerBox({ current, busy, onAnswer }: { current: Turn; busy: boolean; onAnswer: OnAnswer }) {
  const [draft, setDraft] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const send = (text: string, unknown = false) => onAnswer(current.turnNo, text, unknown, pick, scale);
  const unknownBtn = (
    <button type="button" disabled={busy} onClick={() => send('', true)}>
      잘 모르겠어요
    </button>
  );

  if (current.format === 'this_or_that' && current.options.length === 2) {
    return (
      <>
        <div className="pick-two" role="radiogroup" aria-label="둘 중 고르기">
          {current.options.map((o, i) => (
            <button type="button" key={o} role="radio" aria-checked={pick === o} className={`pick${pick === o ? ' on' : ''}`} disabled={busy} onClick={() => setPick(o)}>
              <span className="pick-side">{i === 0 ? 'A' : 'B'}</span> {o}
            </button>
          ))}
        </div>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="왜 그쪽인가요? 한 줄이면 충분해요 (선택 — 쓰면 프로필의 근거가 돼요)" disabled={busy || !pick} />
        {current.examples.length > 0 && pick && (
          <div className="examples">
            {current.examples.map((e) => (
              <button type="button" key={e} className="example" onClick={() => setDraft(e)}>
                {e}
              </button>
            ))}
          </div>
        )}
        <div className="actions">
          <button type="button" className="primary" disabled={busy || !pick} onClick={() => send(draft)}>
            {draft.trim() ? '보내기' : '고르기만 하고 보내기'}
          </button>
          {unknownBtn}
        </div>
      </>
    );
  }

  if (current.format === 'scale' && current.scale) {
    return (
      <>
        <div className="scale" role="radiogroup" aria-label={`${current.scale.left}에서 ${current.scale.right}까지`}>
          <span className="scale-end">{current.scale.left}</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} role="radio" aria-checked={scale === n} aria-label={`${n}`} className={`scale-dot${scale === n ? ' on' : ''}`} disabled={busy} onClick={() => setScale(n)}>
              {n}
            </button>
          ))}
          <span className="scale-end">{current.scale.right}</span>
        </div>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="덧붙일 말이 있으면 (선택 — 예: 평소엔 장난스럽지만 정보는 정확하게)" disabled={busy || scale === null} />
        <div className="actions">
          <button type="button" className="primary" disabled={busy || scale === null} onClick={() => send(draft)}>
            보내기
          </button>
          {unknownBtn}
        </div>
      </>
    );
  }

  if (current.format === 'rewrite' && current.sample) {
    return (
      <>
        <blockquote className="sample">{current.sample}</blockquote>
        <p className="muted small">이 문장을 내가 실제로 올릴 말투로 고쳐 써 주세요. 끝맺음 · 길이 · 이모지 · 농담 — 무엇이든 바꿔도 돼요. 그대로 보내면 「예시를 그대로 보냄」으로 기록돼요.</p>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="내 말투로 다시 쓰기" disabled={busy} />
        <div className="actions">
          <button type="button" className="primary" disabled={busy || !draft.trim()} onClick={() => send(draft)}>
            보내기
          </button>
          <button type="button" className="small" disabled={busy} onClick={() => setDraft(current.sample ?? '')}>
            예시 문장 불러와 고치기
          </button>
          {unknownBtn}
        </div>
      </>
    );
  }

  return (
    <>
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
        <span className="muted small">예시 (눌러서 고쳐 쓰세요 — 그대로 보내면 「예시를 그대로 보냄」으로 기록돼요)</span>
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
        {unknownBtn}
      </div>
    </>
  );
}

export function Interview(props: { state: State; minTurns: number; maxTurns: number; busy: boolean; onAnswer: OnAnswer }) {
  const { state, minTurns, maxTurns, busy, onAnswer } = props;
  const answered = state.turns.filter((t) => t.answer !== null);
  const current = state.turns.find((t) => t.answer === null) ?? null;

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
            {current.lens && <span className="tag lens">{LENS_LABEL[current.lens] ?? current.lens} 질문</span>}
          </div>
          {current.why && <p className="muted small">왜 묻나요? {current.why}</p>}
          <AnswerBox key={current.turnNo} current={current} busy={busy} onAnswer={onAnswer} />
        </div>
      )}
    </div>
  );
}
