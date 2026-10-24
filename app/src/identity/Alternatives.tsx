// 「다른 방향 2개 더」 (FR-ID-5). opus 생성 1번 + 자기 평가 1번(재작성 시 더) — 1~3분 걸려서 진행·취소를 보여 주고,
// 새로고침해도 진행 중이던 작업을 이어서 보도록 작업 ID 를 이 브라우저에 임시 저장한다.
import { useState } from 'react';
import { api } from '../api.ts';
import { useJob } from '../useJob.ts';
import { StageLine } from '../StageLine.tsx';

const KEY = 'firstfeed.alternativesJob';
const RUN_LABEL: Record<string, string> = { generate: '두 방향 생성', json_retry: 'JSON 재요청', rewrite: '재작성', review: '자기 평가' };

interface DirectionView {
  index: number;
  angle: string;
  ok: boolean;
  reasons: string[];
  accountLine: string;
  pillars: Array<{ name: string; description: string }>;
}

function readKey(): { jobId: string; baseId: number } | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as { jobId: string; baseId: number }) : null;
  } catch {
    return null;
  }
}
function writeKey(v: { jobId: string; baseId: number } | null) {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch {
    /* 임시 저장 없이 동작 */
  }
}

export function Alternatives({ baseId, onChosen }: { baseId: number; onChosen: () => void }) {
  const saved = readKey();
  const [jobId, setJobId] = useState<string | null>(saved?.baseId === baseId ? saved.jobId : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { job, cancel } = useJob(jobId, (j) => {
    if (j.phase === 'failed') setError(`${j.error?.message ?? '실패했습니다.'} ${j.error?.hint ?? ''}`);
    if (j.phase === 'cancelled') setError('취소했습니다.');
  }, () => {
    writeKey(null);
    setJobId(null);
  });

  const start = async () => {
    setError(null);
    const r = await api.api.identity.profiles[':id'].alternatives.$post({ param: { id: String(baseId) } });
    const b = await r.json();
    writeKey({ jobId: b.jobId, baseId });
    setJobId(b.jobId);
  };

  const choose = async (index: number) => {
    if (!jobId) return;
    setBusy(true);
    try {
      const r = await api.api.identity.alternatives.choose.$post({ json: { jobId, index } });
      const b = await r.json();
      if ('error' in b) throw new Error(b.error);
      writeKey(null);
      setJobId(null);
      onChosen();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    writeKey(null);
    setJobId(null);
    setError(null);
  };

  const running = jobId !== null && (job === null || job.phase === 'running');
  const result = job?.phase === 'done' ? (job.result as { directions: DirectionView[]; calls: number; rewrites: number }) : null;

  return (
    <div className="alternatives">
      {!jobId && (
        <div className="actions">
          <button type="button" onClick={() => void start()}>
            다른 방향 2개 더 보기
          </button>
          <span className="muted small">같은 답으로 다른 축 조합을 만들어 봐요 · AI 호출 2번(재작성하면 더) · 보통 1~3분</span>
        </div>
      )}
      {running && (
        <div className="job">
          <p>
            다른 방향 두 개를 만드는 중… (생성 → 근거 대조 → 자기 평가: 지금 판과 다른지)
            <button type="button" onClick={() => void cancel()}>
              취소
            </button>
          </p>
          <StageLine stage={job?.stage} />
          {job && job.runs.length > 0 && (
            <ol className="runs muted small">
              {job.runs.map((r) => (
                <li key={r.attempt}>
                  {RUN_LABEL[r.kind] ?? r.kind} · {r.model} · {r.status === 'ok' ? '통과' : r.status} · {((r.duration_ms ?? 0) / 1000).toFixed(1)}초
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      {result && (
        <div>
          <p className="muted small">
            AI 호출 {result.calls}번 · 재작성 {result.rewrites}번 · 고르면 새 판으로 바로 적용되고, 언제든 되돌릴 수 있어요
          </p>
          <div className="directions">
            {result.directions.map((d) => (
              <div key={d.index} className={d.ok ? 'direction' : 'direction failed'}>
                <p className="muted small">방향 {d.index + 1} · {d.angle}</p>
                <strong>{d.accountLine}</strong>
                <ul>
                  {d.pillars.map((p) => (
                    <li key={p.name}>
                      <strong>{p.name}</strong> — {p.description}
                    </li>
                  ))}
                </ul>
                {d.ok ? (
                  <button type="button" className="primary" disabled={busy} onClick={() => void choose(d.index)}>
                    이걸로 바꾸기
                  </button>
                ) : (
                  <div className="status error small">
                    규칙을 통과하지 못해 고를 수 없어요:
                    <ul>
                      {d.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={close}>
            닫기
          </button>
        </div>
      )}
      {error && (
        <p className="status error">
          {error}{' '}
          <button type="button" onClick={close}>
            닫기
          </button>
        </p>
      )}
    </div>
  );
}
