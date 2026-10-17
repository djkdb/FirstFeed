// AI 작업 상태를 1초마다 묻는다. 작업이 끝나면(done·failed·cancelled) 멈추고 onFinish 를 한 번 부른다.
// 서버가 모르는 작업 ID 는: 끝난 것을 본 작업이면 onStale(화면이 저장한 ID 를 조용히 지운다), 아니면 실패로 안내 (결정 2026-10-18)
import { useEffect, useRef, useState } from 'react';
import type { InferResponseType } from 'hono/client';
import { api } from './api.ts';
import { missingJobOutcome, rememberFinished } from './finishedJobs.ts';

export type JobView = Extract<InferResponseType<(typeof api.api.ai.jobs)[':jobId']['$get']>, { phase: unknown }>;

export function useJob(jobId: string | null, onFinish: (job: JobView) => void, onStale: () => void) {
  const [job, setJob] = useState<JobView | null>(null);
  const finish = useRef(onFinish);
  const stale = useRef(onStale);
  useEffect(() => {
    finish.current = onFinish;
    stale.current = onStale;
  });

  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await api.api.ai.jobs[':jobId'].$get({ param: { jobId } });
        const body = await res.json();
        if (stop) return;
        if (!('phase' in body)) {
          if (missingJobOutcome(jobId) === 'stale') {
            // 이미 끝난 작업이 서버 재시작으로 지워졌을 뿐 — 잃은 것이 없으니 안내 없이 지운다
            stale.current();
            return;
          }
          // 서버가 다시 시작되면 메모리의 작업이 사라진다(개발 중 서버 파일을 고치면 실제로 겪음).
          // 조용히 멈추면 화면이 "만드는 중"에 영원히 머물러서, 실패로 끝내고 다시 하라고 알린다
          finish.current({
            jobId,
            task: '',
            phase: 'failed',
            startedAt: '',
            finishedAt: null,
            result: null,
            runs: [],
            error: { message: '진행 중이던 작업을 찾지 못했습니다(서버가 다시 시작된 것 같습니다).', hint: '버튼을 눌러 다시 실행하세요.' },
          });
          return;
        }
        setJob(body);
        if (body.phase === 'running') setTimeout(() => void tick(), 1000);
        else {
          rememberFinished(jobId);
          finish.current(body);
        }
      } catch {
        if (!stop) setTimeout(() => void tick(), 2000);
      }
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [jobId]);

  const cancel = async () => {
    if (jobId) await api.api.ai.jobs[':jobId'].cancel.$post({ param: { jobId } });
  };
  return { job: jobId ? job : null, cancel };
}
