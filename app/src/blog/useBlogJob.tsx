// 발행 작업(티스토리 · 리틀리) 단계 묻기 — 1초마다. 실제로 지나온 단계만 서버가 적는다
import { useEffect, useState } from 'react';

export interface BlogJob {
  id: string;
  phase: 'running' | 'done' | 'failed' | 'cancelled';
  steps: Array<{ at: string; text: string }>;
  result: unknown;
  error: { message: string; hint: string } | null;
}

export async function blogCall<T>(method: string, url: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string | null } }> {
  const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = (await r.json().catch(() => ({ error: '서버가 응답하지 않아요. npm run dev 가 켜져 있는지 확인하세요.' }))) as T & { error?: string | null };
  // 작업 상태의 error 는 {message, hint} 객체(작업이 실패한 것) — 요청 실패는 문자열 error 뿐이다(둘을 섞어 객체를 글자로 그리다 화면이 깨졌다)
  return { ok: r.ok && typeof data.error !== 'string', status: r.status, data };
}

export function useBlogJob(jobId: string | null, onEnd?: (j: BlogJob) => void): BlogJob | null {
  const [job, setJob] = useState<BlogJob | null>(null);
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      const r = await blogCall<BlogJob>('GET', `/api/blog/jobs/${jobId}`);
      if (stop) return;
      if (!r.ok) {
        setJob({ id: jobId, phase: 'failed', steps: [], result: null, error: { message: typeof r.data.error === 'string' ? r.data.error : '작업을 찾지 못했어요.', hint: '' } });
        return;
      }
      setJob(r.data);
      if (r.data.phase === 'running') setTimeout(() => void tick(), 1000);
      else onEnd?.(r.data);
    };
    void tick();
    return () => {
      stop = true;
    };
    // onEnd 는 바뀌어도 다시 묻지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);
  return job;
}

export function JobSteps({ job, onCancel }: { job: BlogJob | null; onCancel: () => void }) {
  if (!job) return null;
  return (
    <div className="blog-job">
      <ol className="blog-steps small">
        {job.steps.map((s, i) => (
          <li key={i} className={i === job.steps.length - 1 && job.phase === 'running' ? 'now' : ''}>
            {s.text}
          </li>
        ))}
      </ol>
      {job.phase === 'running' && (
        <button type="button" className="small" onClick={onCancel}>
          그만두기
        </button>
      )}
      {job.phase === 'failed' && job.error && (
        <p className="status error small">
          {job.error.message} {job.error.hint}
        </p>
      )}
      {job.phase === 'cancelled' && <p className="muted small">그만뒀어요. 열린 창은 닫았어요.</p>}
    </div>
  );
}
