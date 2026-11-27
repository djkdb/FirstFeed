// 넘친 칸 직접 줄이기 — 재작성 2회 뒤에도 틀을 넘친 칸을 보여 주고 사용자가 줄이게 한다(줄이기 전엔 저장하지 않는다)
import type { BodyResult } from './makeTypes.ts';

export function OverflowEditor({ bodyResult, edits, setEdits, busy, onFinish }: { bodyResult: Extract<BodyResult, { status: 'needs_edit' }>; edits: Record<string, string>; setEdits: (e: Record<string, string>) => void; busy: boolean; onFinish: () => void }) {
  return (
    <section className="card">
      <h2>넘친 칸 직접 줄이기</h2>
      <p className="note small">재작성 {bodyResult.rewrites}번 뒤에도 아래 칸이 틀을 넘쳐요. 직접 줄이면 다시 그려서 저장해요(줄이기 전엔 저장하지 않아요).</p>
      {bodyResult.overflows.map((o) => {
        const m = /^cards\.(\d+)/.exec(o.where);
        const card = m ? bodyResult.draft.cards[Number(m[1])] : null;
        const isClosing = o.where.startsWith('closing');
        const field = isClosing ? 'headline' : o.slot === 'title' ? 'title' : 'text';
        const where = isClosing ? 'closing' : `cards.${m?.[1]}`;
        const key = `${where}|${field}`;
        const initial = isClosing ? bodyResult.draft.closing.headline : field === 'title' ? card?.title : card?.text;
        return (
          <div key={o.where} className="editor">
            <p className="small">
              <strong>{isClosing ? '마무리' : `${Number(m?.[1]) + 2}번 카드`}</strong> — {o.message}
            </p>
            <textarea rows={field === 'text' ? 6 : 2} value={edits[key] ?? initial ?? ''} onChange={(e) => setEdits({ ...edits, [key]: e.target.value })} />
          </div>
        );
      })}
      <div className="actions">
        <button type="button" className="primary" disabled={busy || Object.keys(edits).length === 0} onClick={onFinish}>
          줄여서 저장
        </button>
      </div>
      <div className="frames">
        {bodyResult.previews.map((p) => (
          <figure key={p.where} className={p.png ? 'frame' : 'frame bad'}>
            {p.png ? <img src={p.png} alt={p.where} /> : <div className="noimg">넘침</div>}
            <figcaption className="small">{p.where}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
