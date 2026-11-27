// 긴 AI 작업 진행 표시 — 지금 단계 · 지난 호출 목록 · 취소
import type { JobView } from '../useJob.ts';
import { StageLine } from '../StageLine.tsx';

const RUN_LABEL: Record<string, string> = { generate: '생성', json_retry: 'JSON 재요청', rewrite: '재작성', review: '자기 평가' };

export function Progress({ job, onCancel, label }: { job: JobView | null; onCancel: () => void; label: string }) {
  return (
    <div className="job">
      <p>
        {label}
        <button type="button" onClick={onCancel}>
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
  );
}
