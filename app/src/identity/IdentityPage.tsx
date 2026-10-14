// 정체성 찾기: 설문 → 인터뷰 → 프로필 초안 → 확정. 진행 상태는 서버(DB)에 있어 새로고침해도 이어서 한다.
import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import { useJob, type JobView } from '../useJob.ts';
import { Interview } from './Interview.tsx';
import { ProfileView } from './ProfileView.tsx';
import { ProfileEditor, hasEditDraft } from './ProfileEditor.tsx';
import { ProfileHistory } from './ProfileHistory.tsx';
import { Alternatives } from './Alternatives.tsx';
import { clearSurveyDraft, SurveyForm } from './SurveyForm.tsx';
import type { Current, SurveyAnswers } from './types.ts';

type JobKind = 'next' | 'profile';
const RUN_LABEL: Record<string, string> = { generate: '생성', json_retry: 'JSON 재요청', rewrite: '재작성', review: '자기 평가' };

async function fetchCurrent(): Promise<Current> {
  const r = await api.api.identity.current.$get();
  return r.json();
}

export function IdentityPage() {
  const [current, setCurrent] = useState<Current | null>(null);
  const [newSurvey, setNewSurvey] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobKind, setJobKind] = useState<JobKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    fetchCurrent()
      .then(setCurrent)
      .catch((e: unknown) => setError(`불러오지 못했습니다 (${String(e)}). 서버가 켜져 있는지 확인하고 새로고침하세요.`));
  }, []);

  const start = async (kind: JobKind, sessionId: number) => {
    setError(null);
    const r =
      kind === 'next'
        ? await api.api.identity.sessions[':id'].next.$post({ param: { id: String(sessionId) } })
        : await api.api.identity.sessions[':id'].profile.$post({ param: { id: String(sessionId) } });
    const body = await r.json();
    setJobKind(kind);
    setJobId(body.jobId);
  };

  const onFinish = async (job: JobView) => {
    setJobId(null);
    const kind = jobKind;
    setJobKind(null);
    const fresh = await fetchCurrent();
    setCurrent(fresh);
    if (job.phase === 'cancelled') return setError('취소했습니다. 다시 하려면 버튼을 누르세요.');
    if (job.phase === 'failed') return setError(`${job.error?.message ?? '실패했습니다.'} ${job.error?.hint ?? ''}`);
    const result = job.result as { kind?: string; outcome?: string } | null;
    if (kind === 'next' && result?.kind === 'failed') setError('질문을 만들지 못했습니다(규칙을 통과하지 못함). [다음 질문 다시 받기]를 눌러 주세요.');
    // 근거가 부족해 인터뷰로 돌아왔으면 바로 다음 질문을 받는다.
    // 단, 아직 답하지 않은 질문이 남아 있으면 그 질문부터 답하게 둔다 — 서버가 "먼저 답하라"며 거절한다(실제로 겪음)
    const pending = fresh.state?.turns.some((t) => t.answer === null) ?? false;
    if (kind === 'profile' && result?.outcome === 'needs_more' && fresh.state?.status === 'interview' && !pending) void start('next', fresh.state.id);
  };
  const { job, cancel } = useJob(jobId, (j) => void onFinish(j));

  const submitSurvey = async (survey: SurveyAnswers) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.api.identity.sessions.$post({ json: { survey } });
      const body = await r.json();
      if ('error' in body) throw new Error(body.error);
      setCurrent(body);
      setNewSurvey(false);
      clearSurveyDraft();
      if (body.state) await start('next', body.state.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const answer = async (turnNo: number, text: string, unknown: boolean) => {
    if (!current?.state) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.api.identity.sessions[':id'].answer.$post({ param: { id: String(current.state.id) }, json: { turnNo, answer: text, unknown } });
      const body = await r.json();
      if ('error' in body) throw new Error(body.error);
      setCurrent(body);
      await start('next', current.state.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setCurrent(await fetchCurrent());
    setHistoryKey((k) => k + 1);
  };

  const confirm = async (profileId: number) => {
    setBusy(true);
    await api.api.identity.profiles[':id'].confirm.$post({ param: { id: String(profileId) } });
    await refresh();
    setBusy(false);
  };

  if (!current) return <section className="card">{error ? <p className="status error">{error}</p> : <p className="muted">불러오는 중…</p>}</section>;

  const state = newSurvey ? null : current.state;
  const running = jobId !== null;
  const answered = state?.turns.filter((t) => t.answer !== null).length ?? 0;
  const unanswered = state?.turns.some((t) => t.answer === null) ?? false;
  const canProfile = state !== null && answered >= current.minTurns && !running && state.status !== 'profiled';

  return (
    <section className="card identity">
      <div className="card-head">
        <h2>정체성 찾기</h2>
        {state && (
          <button type="button" onClick={() => setNewSurvey(true)} disabled={running}>
            처음부터 다시
          </button>
        )}
      </div>

      {!state && <SurveyForm onSubmit={(s) => void submitSurvey(s)} busy={busy} />}

      {state && state.note && state.status !== 'profiled' && (
        <div className={state.note.kind === 'failed' ? 'note error' : 'note'}>
          <p>{state.note.message}</p>
          {state.note.missing.length > 0 && (
            <ul>
              {state.note.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state && state.status !== 'profiled' && (
        <Interview state={state} minTurns={current.minTurns} maxTurns={current.maxTurns} busy={busy || running} onAnswer={(n, a, u) => void answer(n, a, u)} />
      )}

      {running && job && (
        <div className="job">
          <p>
            {jobKind === 'profile' ? '프로필 초안을 만드는 중… (생성 → 근거 대조 → 자기 평가, 보통 30초~1분)' : '다음 질문을 만드는 중…'}
            <button type="button" onClick={() => void cancel()}>
              취소
            </button>
          </p>
          {job.runs.length > 0 && (
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
      {running && !job && <p className="muted">작업을 시작하는 중…</p>}

      {error && <p className="status error">{error}</p>}
      {notice && <p className="note">{notice}</p>}

      {state && state.status !== 'profiled' && !running && (
        <div className="actions">
          {!unanswered && answered < current.maxTurns && (
            <button type="button" onClick={() => void start('next', state.id)}>
              다음 질문 다시 받기
            </button>
          )}
          {canProfile && (
            <button type="button" className={state.status === 'ready' ? 'primary' : ''} onClick={() => void start('profile', state.id)}>
              {state.status === 'ready' ? '이제 프로필 만들기' : '이 정도로 프로필 만들기'}
            </button>
          )}
        </div>
      )}

      {state?.profile && state.status === 'profiled' && !editing && (
        <>
          <ProfileView profile={state.profile} active={state.activeProfileId === state.profile.id} busy={busy} onConfirm={() => void confirm(state.profile!.id)} />
          <div className="actions">
            <button type="button" onClick={() => setEditing(true)} disabled={running}>
              {hasEditDraft(state.profile.id) ? '고치던 것 이어서 고치기' : '고치기'}
            </button>
          </div>
          <Alternatives baseId={state.profile.id} onChosen={() => void refresh()} />
          <ProfileHistory refreshKey={historyKey} onChanged={() => void refresh()} />
        </>
      )}
      {state?.profile && state.status === 'profiled' && editing && (
        <ProfileEditor
          profile={state.profile}
          onDone={(saved, notes) => {
            setEditing(false);
            setNotice(notes?.join(' / ') ?? null);
            if (saved) void refresh();
          }}
        />
      )}
    </section>
  );
}
