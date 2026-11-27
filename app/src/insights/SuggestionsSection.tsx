// 「다음에 할 것」 · 「반영한 변경」 묶음 — 제안 받기(AI) · 프로필에 반영 · 넘기기, 성과에서 온 변경과 만료
import type { JobView } from '../useJob.ts';
import { blogCall } from '../blog/useBlogJob.tsx';
import { notifyChanged } from '../changed.ts';
import { StageLine } from '../StageLine.tsx';
import { isoLocal } from '../time.ts';
import type { View } from './insightsShared.tsx';

type Act = (method: string, url: string, body?: unknown, done?: string) => Promise<true | undefined>;

export function SuggestionsSection({ view, s, jobId, setJobId, job, cancel, setError, setInfo, groupLabel, pending, act }: { view: View; s: View['settings']; jobId: string | null; setJobId: (id: string | null) => void; job: JobView | null; cancel: () => Promise<void>; setError: (e: string | null) => void; setInfo: (i: string | null) => void; groupLabel: (key: string) => string; pending: View['suggestions']; act: Act }) {
  return (
    <>
    <section className="card">
      <div className="card-head">
        <h2>다음에 할 것</h2>
        {!jobId ? (
          <button type="button" className="primary" disabled={!view.hasProfile} onClick={() => void blogCall<{ jobId: string }>('POST', '/api/insights/suggest').then((r) => (setError(null), setInfo(null), r.ok ? setJobId(r.data.jobId) : setError(r.data.error ?? '시작하지 못했어요.')))}>
            다음에 할 것 제안 받기
          </button>
        ) : (
          <button type="button" onClick={() => void cancel()}>
            취소
          </button>
        )}
      </div>
      <p className="muted small">AI 가 위 표 중 결론을 낼 수 있는 값만 보고 최대 3개를 제안해요. 인용한 숫자가 표와 같은지는 코드가 대조해요. 「프로필에 반영」을 눌러야 프로필이 바뀌고, {s.acceptDays}일이 지나면 제목 · 카드 생성에서 저절로 빠져요.</p>
      {jobId && <StageLine stage={job?.stage} />}
      {!view.hasProfile && <p className="note small">「정체성」에서 프로필을 먼저 확정하세요.</p>}
      {view.suggestions.length > 0 && (
        <ul className="ins-sugs">
          {view.suggestions.map((x) => (
            <li key={x.id} className={`ins-sug ${x.status}`}>
              <div className="ins-sug-head">
                <span className={`badge ${x.kind === 'more' ? 'badge-ok' : 'badge-warn'}`}>{x.kind === 'more' ? '더 할 것' : '줄일 것'}</span>
                <span className="small muted">{groupLabel(x.groupKey)}</span>
              </div>
              <p className="ins-sug-text">{x.text}</p>
              <div className="ins-chips">
                {x.evidence.map((e, i) => (
                  <span key={i} className="ins-chip">
                    {groupLabel(e.groupKey)} {e.metric === 'saveRate' ? '저장률' : '공유율'} <b>{e.value}</b>
                  </span>
                ))}
              </div>
              <p className="small">
                프로필 {x.kind === 'more' ? '말투 규칙' : '피할 것'}에 더할 줄: <b>{x.rule}</b>
              </p>
              {x.status === 'pending' ? (
                <div className="set-actions" style={{ justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    className="small primary"
                    onClick={() => void act('POST', `/api/insights/suggestions/${x.id}/accept`, undefined, `프로필에 반영했어요 — ${s.acceptDays}일 뒤 저절로 빠져요.`).then((ok) => ok && notifyChanged())}
                  >
                    프로필에 반영
                  </button>
                  <button type="button" className="small ghost" onClick={() => void act('POST', `/api/insights/suggestions/${x.id}/reject`)}>
                    넘기기
                  </button>
                </div>
              ) : (
                <p className="small muted">{x.status === 'accepted' ? '반영함' : '넘김'}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {pending.length === 0 && view.suggestions.length === 0 && !jobId && <p className="empty-state">아직 받은 제안이 없어요.</p>}
    </section>

    <section className="card">
      <h2>반영한 변경</h2>
      <p className="muted small">성과에서 온 변경이에요. 만료일이 지나면 생성 입력에서 빠지고 여기에 「만료됨」으로 남아요. 정체성 화면의 판 이력에서 되돌릴 수도 있어요.</p>
      {view.accepted.length === 0 ? (
        <p className="empty-state">아직 반영한 변경이 없어요.</p>
      ) : (
        <ul className="ins-accepted">
          {view.accepted.map((a) => (
            <li key={a.id}>
              <div>
                <b>{a.rule}</b> <span className="small muted">· {a.kind === 'more' ? '말투 규칙' : '피할 것'}</span>
              </div>
              <div className="small muted">
                {a.decidedAt ? `반영 ${isoLocal(`${a.decidedAt.replace(' ', 'T')}Z`, false)} · ` : ''}
                {a.expired ? <span className="badge badge-off">성과에서 온 변경 · 만료됨</span> : a.expiresAt ? `${isoLocal(a.expiresAt, false)}까지` : ''}
                {!a.expired && !a.inProfile && ' · 지금 프로필에는 없음(직접 지웠거나 되돌림)'}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
    </>
  );
}
