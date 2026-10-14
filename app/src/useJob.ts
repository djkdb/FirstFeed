// AI 작업 상태를 1초마다 묻는다. 작업이 끝나면(done·failed·cancelled) 멈추고 onFinish 를 한 번 부른다.
import { useEffect, useRef, useState } from 'react';
import type { InferResponseType } from 'hono/client';
import { api } from './api.ts';

export type JobView = Extract<InferResponseType<(typeof api.api.ai.jobs)[':jobId']['$get']>, { phase: unknown }>;

export function useJob(jobId: string | null, onFinish: (job: JobView) => void) {
  const [job, setJob] = useState<JobView | null>(null);
  const finish = useRef(onFinish);
  useEffect(() => {
    finish.current = onFinish;
  });

  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await api.api.ai.jobs[':jobId'].$get({ param: { jobId } });
        const body = await res.json();
        if (stop || !('phase' in body)) return;
        setJob(body);
        if (body.phase === 'running') setTimeout(() => void tick(), 1000);
        else finish.current(body);
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
