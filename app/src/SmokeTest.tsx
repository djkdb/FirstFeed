// 「AI 시험 호출」: 어댑터 → 규칙 검증 → 자기 평가 → 재작성 루프를 실제 CLI 로 돌려 보고, 호출 이력과 취소를 확인한다.
// 제품 기능이 아니라 AI 연결이 끝까지 동작하는지 보는 점검 도구다.
import { useEffect, useState } from 'react';
import type { InferResponseType } from 'hono/client';
import { api } from './api.ts';

type JobView = Extract<InferResponseType<(typeof api.api.ai.jobs)[':jobId']['$get']>, { phase: unknown }>;
type Fact = { fact: string; quote: string };
type Issue = { level: string; code: string; message: string; where?: string };
type Checked = { ok: boolean; data?: { facts: Fact[] }; errors?: Issue[]; warnings: Issue[]; calls: number; rewrites: number };

const KIND_LABEL: Record<string, string> = { generate: '생성', json_retry: 'JSON 재요청', rewrite: '재작성', review: '자기 평가' };
const STATUS_LABEL: Record<string, string> = {
  ok: '통과',
  invalid_json: 'JSON 아님',
  schema_error: '형식 불일치',
  rule_error: '규칙 위반',
  failed: '실패',
  timeout: '시간 초과',
  cancelled: '취소됨',
  blocked: '막음(구독 아님)',
};

export function SmokeTest() {
  const [source, setSource] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobView | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 작업이 끝날 때까지 1초마다 상태를 묻는다
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await api.api.ai.jobs[':jobId'].$get({ param: { jobId } });
        const body = await res.json();
        if (stop) return;
        if (!('phase' in body)) throw new Error(body.error);
        setJob(body);
        if (body.phase === 'running') setTimeout(() => void tick(), 1000);
      } catch (err) {
        if (!stop) setError(err instanceof Error ? err.message : String(err));
      }
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [jobId]);

  const start = async () => {
    setError(null);
    setJob(null);
    try {
      const res = await api.api.ai.smoke.$post({ json: { source } });
      const body = await res.json();
      if ('error' in body) throw new Error(body.error);
      if (!source) setSource(body.source);
      setJobId(body.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const cancel = async () => {
    if (jobId) await api.api.ai.jobs[':jobId'].cancel.$post({ param: { jobId } });
  };

  const running = job?.phase === 'running' || (jobId !== null && job === null);
  const result = job?.phase === 'done' ? (job.result as Checked) : null;

  return (
    <section className="card">
      <div className="card-head">
        <h2>AI 시험 호출</h2>
        {running ? (
          <button type="button" onClick={() => void cancel()}>
            취소
          </button>
        ) : (
          <button type="button" onClick={() => void start()}>
            시험 호출
          </button>
        )}
      </div>
      <p className="muted">원문에서 사실 2~3개와 근거 인용을 뽑고, 코드 규칙과 자기 평가를 거칩니다. 비워 두면 예시 원문을 씁니다.</p>
      <textarea value={source} onChange={(e) => setSource(e.target.value)} rows={4} placeholder="원문 (비우면 예시 원문)" disabled={running} />
      {error && <p className="status error">{error}</p>}

      {job && (
        <>
          <table className="providers">
            <thead>
              <tr>
                <th>#</th>
                <th>단계</th>
                <th>모델</th>
                <th>결과</th>
                <th>시간</th>
              </tr>
            </thead>
            <tbody>
              {job.runs.map((r) => (
                <tr key={r.attempt}>
                  <td>{r.attempt}</td>
                  <td>{KIND_LABEL[r.kind] ?? r.kind}</td>
                  <td>{r.model}</td>
                  <td className={r.status === 'ok' ? 'ok' : 'error-text'}>{STATUS_LABEL[r.status] ?? r.status}</td>
                  <td>{r.duration_ms === null ? '—' : `${(r.duration_ms / 1000).toFixed(1)}초`}</td>
                </tr>
              ))}
              {running && (
                <tr>
                  <td colSpan={5} className="muted">
                    AI 응답을 기다리는 중…
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {job.phase === 'cancelled' && <p className="status error">취소했습니다. 결과는 저장하지 않습니다.</p>}
          {job.phase === 'failed' && job.error && (
            <p className="status error">
              {job.error.message} {job.error.hint}
            </p>
          )}
          {result && !result.ok && (
            <div className="status error">
              <p>재작성 {result.rewrites}회 뒤에도 규칙을 통과하지 못해 결과를 버렸습니다.</p>
              <ul>
                {result.errors?.map((i, n) => (
                  <li key={n}>
                    [{i.code}] {i.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result?.ok && result.data && (
            <div>
              <p className="status ok">
                통과 — AI 호출 {result.calls}번 · 재작성 {result.rewrites}번
              </p>
              <ol className="facts">
                {result.data.facts.map((f, n) => (
                  <li key={n}>
                    <strong>{f.fact}</strong>
                    <blockquote>{f.quote}</blockquote>
                  </li>
                ))}
              </ol>
              {result.warnings.length > 0 && (
                <ul className="muted">
                  {result.warnings.map((w, n) => (
                    <li key={n}>
                      경고 [{w.code}] {w.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
