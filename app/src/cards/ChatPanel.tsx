// 채팅으로 고치기 (FR-MK-3 · 2026-11-04). 「3번 카드 너무 설명조야」처럼 말하면 AI 가 그 카드만 고친 제안을 만든다.
// 제안은 전/후(글 · 그림)만 보여 주고 세트는 그대로 — 「적용」을 눌러야 바뀐다(사용자 결정). 적용한 것은 「되돌리기」로 돌아간다
import { useCallback, useEffect, useRef, useState } from 'react';
import { useJob } from '../useJob.ts';
import { StageLine } from '../StageLine.tsx';
import { wordDiff } from './rewriteText.ts';

type Content = { kind: string; headline?: string; sub?: string | null; title?: string; text?: string };
interface Change {
  idx: number;
  kind: 'cover' | 'body' | 'closing';
  before: { content: Content };
  content: Content;
  pngFile: string;
}
interface Item {
  id: number;
  message: string;
  targets: number[] | null;
  status: 'proposed' | 'applied' | 'discarded' | 'reverted' | 'failed';
  reply: string | null;
  error: string | null;
  changes: Change[];
}

const plain = (s: string | null | undefined) => (s ?? '').replace(/\*\*/g, '');
const STATUS: Record<Item['status'], string> = { proposed: '적용 전', applied: '적용함', discarded: '버림', reverted: '되돌림', failed: '못 고침' };

function Diff({ before, after }: { before: string | null | undefined; after: string | null | undefined }) {
  if (plain(before) === plain(after)) return <span>{plain(after)}</span>;
  return (
    <span className="rewrite-diff">
      {wordDiff(plain(before), plain(after)).map((sg, k) => (sg.kind === 'del' ? <del key={k}>{sg.text}</del> : sg.kind === 'add' ? <ins key={k}>{sg.text}</ins> : <span key={k}>{sg.text}</span>))}
    </span>
  );
}

export function ChatPanel({ setId, cardCount, pngOf, onChanged }: { setId: number; cardCount: number; pngOf: (idx: number) => string; onChanged: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState('');
  const [targets, setTargets] = useState<number[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    () =>
      fetch(`/api/cards/sets/${setId}/chat`)
        .then((r) => r.json() as Promise<{ items?: Item[] }>)
        .then((b) => setItems(b.items ?? [])),
    [setId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  // 중괄호 필수: 새 Chromium 의 scrollIntoView 는 Promise 를 돌려줘, 그대로 돌려주면 React 가 정리 함수로 알고 화면이 깨진다(실제로 겪음)
  useEffect(() => {
    void end.current?.scrollIntoView({ block: 'nearest' });
  }, [items.length, jobId]);

  const { job, cancel } = useJob(
    jobId,
    (j) => {
      setJobId(null);
      if (j.phase === 'failed') setErr(`${j.error?.message ?? '고치지 못했어요.'} ${j.error?.hint ?? ''}`);
      if (j.phase === 'cancelled') setErr('취소했어요.');
      void load();
    },
    () => setJobId(null),
  );

  const send = async () => {
    const message = text.trim();
    if (message.length < 2) return;
    setErr(null);
    const r = await fetch(`/api/cards/sets/${setId}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, targets: targets.length ? targets : null }) }).catch(() => null);
    const b = r ? ((await r.json().catch(() => ({}))) as { jobId?: string; error?: string }) : {};
    if (!b.jobId) return setErr(b.error ?? '보내지 못했어요. 서버가 켜져 있는지 확인하세요.');
    setText('');
    setJobId(b.jobId);
  };
  const act = async (id: number, action: 'apply' | 'discard' | 'revert') => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/cards/sets/${setId}/chat/${id}/${action}`, { method: 'POST' });
      const b = (await r.json()) as { ok?: boolean; error?: string };
      if (!b.ok) setErr(b.error ?? '처리하지 못했어요.');
      await load();
      if (b.ok && action !== 'discard') onChanged();
    } finally {
      setBusy(false);
    }
  };
  const latestApplied = [...items].reverse().find((x) => x.status === 'applied')?.id;
  const label = (i: number) => (i === 0 ? '표지' : i === cardCount - 1 ? '마무리' : `${i + 1}번`);

  return (
    <section className="chat-panel">
      <h3>채팅으로 고치기</h3>
      <p className="muted small">
        「3번 카드 너무 설명조야」, 「표지 더 짧게」처럼 말하면 그 카드만 다시 쓰고 다시 그려 전/후를 보여 줘요. <b>「적용」을 눌러야 세트가 바뀌어요.</b> 표지는 말에 「표지」가 있거나 아래에서 고른 때만 바꿔요. 카드 수는 아직 바꿀 수 없어요.
      </p>
      <div className="chat-log">
        {items.length === 0 && !jobId && <p className="muted small">아직 고친 기록이 없어요.</p>}
        {items.map((it) => (
          <div key={it.id} className="chat-turn">
            <div className="chat-me">
              {it.targets?.length ? <span className="tag">{it.targets.map(label).join(' · ')}</span> : null} {it.message}
            </div>
            <div className={`chat-ai ${it.status}`}>
              <div className="small">
                <span className="tag">{STATUS[it.status]}</span> {it.reply ?? ''}
                {it.error && <span className="status error"> {it.error}</span>}
              </div>
              {it.changes.map((c) => (
                <div key={c.idx} className="chat-change">
                  <div className="chat-pair">
                    <figure>
                      <img src={it.status === 'applied' ? `/api/cards/sets/${setId}/chat-png/chat-${it.id}-before-${String(c.idx + 1).padStart(2, '0')}.png` : pngOf(c.idx)} alt={`${c.idx + 1}번 카드 전`} />
                      <figcaption className="small muted">전</figcaption>
                    </figure>
                    <figure>
                      <img src={`/api/cards/sets/${setId}/chat-png/${c.pngFile}`} alt={`${c.idx + 1}번 카드 후`} />
                      <figcaption className="small muted">후</figcaption>
                    </figure>
                  </div>
                  <div className="small">
                    <b>{label(c.idx)} 카드</b>
                    {c.kind === 'body' ? (
                      <>
                        <div>
                          제목: <Diff before={c.before.content.title} after={c.content.title} />
                        </div>
                        <div>
                          글: <Diff before={c.before.content.text} after={c.content.text} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          제목: <Diff before={c.before.content.headline} after={c.content.headline} />
                        </div>
                        {(c.before.content.sub || c.content.sub) && (
                          <div>
                            부제: <Diff before={c.before.content.sub} after={c.content.sub} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div className="actions">
                {it.status === 'proposed' && (
                  <>
                    <button type="button" className="primary small" disabled={busy} onClick={() => void act(it.id, 'apply')}>
                      적용
                    </button>
                    <button type="button" className="small" disabled={busy} onClick={() => void act(it.id, 'discard')}>
                      버리기
                    </button>
                  </>
                )}
                {it.status === 'applied' && it.id === latestApplied && (
                  <button type="button" className="small" disabled={busy} onClick={() => void act(it.id, 'revert')}>
                    되돌리기
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {jobId && (
          <div className="chat-ai">
            <StageLine stage={job?.stage} />
            <span className="small muted">고치는 중… (AI 호출 · 규칙 검사 · 다시 그리기, 보통 30초~1분) </span>
            <button type="button" className="small" onClick={() => void cancel()}>
              취소
            </button>
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="chat-targets small">
        <span className="muted">고칠 카드(선택):</span>
        {Array.from({ length: cardCount }, (_, i) => (
          <button key={i} type="button" className={`chip-toggle${targets.includes(i) ? ' on' : ''}`} aria-pressed={targets.includes(i)} onClick={() => setTargets((t) => (t.includes(i) ? t.filter((x) => x !== i) : [...t, i].sort((a, b) => a - b)))}>
            {label(i)}
          </button>
        ))}
      </div>
      <div className="chat-input">
        <textarea
          value={text}
          maxLength={500}
          rows={2}
          placeholder="예) 3번 카드 너무 설명조야 · 마무리에 저장 유도 넣어 · 표지 더 짧게"
          disabled={!!jobId}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="button" className="primary" disabled={!!jobId || text.trim().length < 2} onClick={() => void send()}>
          보내기
        </button>
      </div>
      {err && <p className="status error small">{err}</p>}
    </section>
  );
}
