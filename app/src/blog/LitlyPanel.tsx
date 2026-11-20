// 리틀리 채우기 (사용자 결정 2026-11-20 — 자동 입력, 저장은 사용자). 브랜드 키트의 이름 · 바이오 · 인스타 주소 · 블로그(있으면)를 넣는다
import { useState } from 'react';
import { blogCall, JobSteps, useBlogJob } from './useBlogJob.tsx';

export function LitlyPanel() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [items, setItems] = useState<Array<{ label: string; value: string }>>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const job = useBlogJob(jobId);
  const start = async () => {
    setMsg(null);
    const r = await blogCall<{ jobId: string; items: Array<{ label: string; value: string }> }>('POST', '/api/blog/litly');
    if (r.ok) {
      setJobId(r.data.jobId);
      setItems(r.data.items);
    } else setMsg(r.data.error ?? '시작하지 못했어요.');
  };
  return (
    <section className="card">
      <h2>리틀리 채우기</h2>
      <p className="muted small">이 컴퓨터에 브라우저 창이 열려요. 그 창에서 리틀리에 로그인하면 프로필 이름 · 소개를 찾아 넣고, 링크(인스타 · 블로그 · 최근 글)는 창 오른쪽 아래 판에서 칸을 누른 뒤 넣을 수 있어요. 저장은 리틀리에서 직접 눌러 주세요.</p>
      <div className="actions">
        <button type="button" className="primary" disabled={job?.phase === 'running'} onClick={() => void start()}>
          {job?.phase === 'running' ? '채우는 중…' : '리틀리 열어 채우기'}
        </button>
      </div>
      {msg && <p className="status error small">{msg}</p>}
      <JobSteps job={job} onCancel={() => void blogCall('POST', `/api/blog/jobs/${jobId}/cancel`)} />
      {items.length > 0 && (
        <details className="small">
          <summary>넣을 것 {items.length}개</summary>
          <ul>
            {items.map((i) => (
              <li key={i.label}>
                <b>{i.label}</b> · {i.value}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="muted small">리틀리는 공개 API 가 없어 화면의 칸 이름을 읽어 채워요. 맞는 칸을 못 찾으면 판에 남겨 둬요 — 잘못된 칸에 넣지 않게.</p>
    </section>
  );
}
