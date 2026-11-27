// 카드뉴스 만들기 (FR-MK-1): 소재 붙여넣기 → 표지 제목 후보(고정 틀로 그린 PNG) → 고르기 → 본문 → 세트.
// 2회 재작성 뒤에도 넘친 카드는 어느 칸이 약 몇 자 넘쳤는지 보이고 직접 줄이게 한다(줄여야 저장).
// 긴 AI 작업은 진행·취소를 보이고, 새로고침해도 이어서 보도록 작업 ID 를 이 브라우저에 임시 저장한다
import { loadError } from '../loadError.ts';
import { useCallback, useEffect, useState } from 'react';
import type { InferResponseType } from 'hono/client';
import { api } from '../api.ts';
import { useJob } from '../useJob.ts';
import { KEY, load, save } from './jobStorage.ts';
import type { BodyResult, CoversResult, Overflow } from './makeTypes.ts';
import { Progress } from './Progress.tsx';
import { CoverPicker } from './CoverPicker.tsx';
import { OverflowEditor } from './OverflowEditor.tsx';
import { SetView } from './SetView.tsx';
import { SetHistory } from './SetHistory.tsx';

type State = InferResponseType<typeof api.api.cards.$get>;

/** 홈의 「이 칸으로 만들기」로 왔을 때(#/make?slot=N) 그 칸 번호 */
const slotFromHash = (): number | null => {
  const v = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('slot');
  return v !== null && /^\d+$/.test(v) ? Number(v) : null;
};

/** 작업 콘솔에서 왔을 때(#/make?set=N) 열 세트 */
const setFromHash = (): number | null => {
  const v = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('set');
  return v !== null && /^\d+$/.test(v) ? Number(v) : null;
};

export function MakePage() {
  const [state, setState] = useState<State | null>(null);
  // 홈에서 고른 계획 칸 — 세트를 다 만들면 그 칸에 잇는다(FR-HM-2 · 결정 2026-10-24)
  const [slot, setSlot] = useState<number | null>(slotFromHash);
  const [slotTitle, setSlotTitle] = useState<string | null>(null);
  const [slotNotice, setSlotNotice] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [memo, setMemo] = useState('');
  const [requested, setRequested] = useState<number | null>(null);
  const [coverJobId, setCoverJobId] = useState<string | null>(() => load(KEY.cover));
  const [bodyJobId, setBodyJobId] = useState<string | null>(() => load(KEY.body));
  const [covers, setCovers] = useState<CoversResult | null>(null);
  const [bodyResult, setBodyResult] = useState<BodyResult | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [viewSet, setViewSet] = useState<number | null>(setFromHash);
  // 작업 콘솔의 줄(#/make?set=N)을 누르면 그 세트를 연다 — 같은 탭 안에서 주소만 바뀌어도
  useEffect(() => {
    const onHash = () => {
      const id = setFromHash();
      if (id === null) return;
      setViewSet(id);
      setTimeout(() => {
        void document.getElementById('set-view')?.scrollIntoView({ block: 'start' });
      }, 300);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => api.api.cards.$get().then((r) => r.json()).then(setState), []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  // 이미 「만들기」 탭에 있을 때 홈에서 다른 칸을 골라 와도 읽는다
  useEffect(() => {
    const onHash = () => setSlot(slotFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (slot === null) return;
    fetch('/api/home')
      .then((r) => r.json() as Promise<{ slots?: Array<{ title: string }> }>)
      .then((h) => setSlotTitle(h.slots?.[slot]?.title ?? null))
      .catch(() => setSlotTitle(null));
  }, [slot]);
  /** 다 만든 세트를 홈의 그 칸에 잇는다. 실패해도 세트는 그대로 — 홈에서 다시 이을 수 있다고 알린다 */
  const linkToSlot = (setId: number) => {
    if (slot === null) return;
    const n = slot;
    fetch(`/api/home/slots/${n}/set`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ setId }) })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? '잇지 못했어요.');
        setSlotNotice(`홈의 ${n + 1}번 칸에 이었어요. 업로드 준비를 마치고 홈에서 「올렸어요」를 누르세요.`);
        setSlot(null);
        window.history.replaceState(null, '', '#/make');
      })
      .catch((e: unknown) => setSlotNotice(`${loadError(e, `세트는 만들었지만 ${n + 1}번 칸에 잇지`)} 홈에서 「이 칸에 잇기」로 이으세요.`));
  };

  const coverJob = useJob(coverJobId, (j) => {
    if (j.phase === 'done') setCovers(j.result as unknown as CoversResult);
    else setError(j.phase === 'cancelled' ? '취소했습니다.' : `${j.error?.message ?? '실패했습니다.'} ${j.error?.hint ?? ''}`);
    if (j.phase !== 'done') {
      save(KEY.cover, null);
      setCoverJobId(null);
    }
  }, () => {
    save(KEY.cover, null);
    setCoverJobId(null);
  });
  const bodyJob = useJob(bodyJobId, (j) => {
    if (j.phase === 'done') {
      const r = j.result as unknown as BodyResult;
      setBodyResult(r);
      if (r.status === 'saved') {
        setViewSet(r.setId);
        linkToSlot(r.setId);
        void refresh();
      }
    } else {
      setError(j.phase === 'cancelled' ? '취소했습니다.' : `${j.error?.message ?? '실패했습니다.'} ${j.error?.hint ?? ''}`);
      save(KEY.body, null);
      setBodyJobId(null);
    }
  }, () => {
    save(KEY.body, null);
    setBodyJobId(null);
  });

  const startCovers = async () => {
    setError(null);
    setCovers(null);
    setBodyResult(null);
    setViewSet(null);
    const s = await api.api.cards.sources.$post({ json: { body, memo: memo || null } });
    const sb = await s.json();
    if ('error' in sb) return setError(sb.error);
    const r = await api.api.cards.covers.$post({ json: { sourceId: sb.sourceId, requested } });
    const b = await r.json();
    if ('error' in b) return setError(b.error);
    save(KEY.cover, b.jobId);
    save(KEY.body, null);
    setBodyJobId(null);
    setCoverJobId(b.jobId);
  };

  const choose = async (index: number) => {
    if (!coverJobId) return;
    setError(null);
    setBodyResult(null);
    const r = await api.api.cards.body.$post({ json: { coverJobId, index } });
    const b = await r.json();
    if ('error' in b) return setError(b.error);
    save(KEY.body, b.jobId);
    setBodyJobId(b.jobId);
  };

  const finish = async () => {
    if (!bodyJobId || bodyResult?.status !== 'needs_edit') return;
    setBusy(true);
    setError(null);
    try {
      const list = Object.entries(edits).map(([key, value]) => {
        const [where, field] = key.split('|') as [string, string];
        return { where, [field]: value };
      });
      const r = await api.api.cards.finish.$post({ json: { bodyJobId, edits: list } });
      const b = (await r.json().catch(() => ({ error: `서버 오류(HTTP ${r.status})` }))) as { status?: string; setId?: number; overflows?: Overflow[]; problems?: string[]; error?: string };
      if (b.error) return setError(b.error);
      if (b.status === 'saved' && b.setId) {
        setViewSet(b.setId);
        linkToSlot(b.setId);
        setBodyResult(null);
        void refresh();
      } else setError(['아직 넘칩니다:', ...(b.overflows ?? []).map((o) => `${o.where} — ${o.message}`), ...(b.problems ?? [])].join(' '));
    } finally {
      setBusy(false);
    }
  };

  if (!state) return <section className="card">불러오는 중…</section>;
  const notReady = !state.ready.profile ? '「정체성」에서 프로필을 먼저 확정하세요.' : !state.ready.template ? '「템플릿」에서 틀을 먼저 고정하세요. 카드 글자 수는 고정한 틀에서 정해져요.' : null;
  const coverRunning = coverJobId !== null && !covers && (coverJob.job === null || coverJob.job.phase === 'running');
  const bodyRunning = bodyJobId !== null && !bodyResult && (bodyJob.job === null || bodyJob.job.phase === 'running');
  // 지금 어느 단계인가 — 실제 상태(작업 · 결과 · 연 세트)에서만 정한다(가짜 진행 표시 금지, 결정 2026-10-24)
  const step = bodyRunning || bodyResult?.status === 'needs_edit' ? 2 : coverRunning || (covers && !bodyResult) ? 1 : viewSet !== null ? 3 : 0;

  return (
    <>
      <section className="card">
        <h2>카드뉴스 만들기</h2>
        <ol className="stepper" aria-label="만드는 단계">
          {['소재 붙여 넣기', '표지 고르기', '본문 카드', '다듬기 · 캡션', '업로드 폴더'].map((label, i) => (
            <li key={label} className={i < step ? 'done' : i === step ? 'now' : ''} aria-current={i === step ? 'step' : undefined}>
              <span className="stepper-n">{i < step ? '✓' : i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        {notReady ? (
          <p className="note">{notReady}</p>
        ) : (
          <p className="muted small">
            고정한 틀: 시안 {state.ready.template!.draftId} · v{state.ready.template!.version}. 소재를 붙여 넣으면 표지 제목 후보를 그 틀로 그려 보여 드려요.
          </p>
        )}
        {slot !== null && (
          <p className="note small">
            홈의 {slot + 1}번 칸{slotTitle ? ` 「${slotTitle}」` : ''}으로 만들어요. 이 칸에 맞는 소재를 붙여 넣으세요 — 표지 제목은 소재에서 다시 만들어요(칸 제목을 그대로 쓰지 않아요). 다 만들면 그 칸에 저절로 이어요.{' '}
            <button
              type="button"
              className="link"
              onClick={() => {
                setSlot(null);
                window.history.replaceState(null, '', '#/make');
              }}
            >
              칸에 잇지 않기
            </button>
          </p>
        )}
        {slotNotice && <p className="status ok small">{slotNotice}</p>}
        <label className="field">
          <span className="field-label">소재 원문</span>
          <span className="field-hint">휴대폰 메모 · 정리해 둔 글 · 공지처럼 이미 써 둔 글을 그대로 붙여 넣으세요. 숫자 · 이름은 여기 있는 것만 카드에 들어가요.</span>
          <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} disabled={!!notReady} placeholder="예) 직접 써 본 도구의 공식 발표문이나, 써 보며 적어 둔 메모" />
        </label>
        <label className="field">
          <span className="field-label">
            메모 <span className="muted">(선택)</span>
          </span>
          <span className="field-hint">내가 직접 쓴 말이라 카드에 써도 되는 사실이 돼요.</span>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} disabled={!!notReady} />
        </label>
        <div className="actions">
          <label className="small">
            본문 카드 수{' '}
            <select value={requested ?? ''} onChange={(e) => setRequested(e.target.value ? Number(e.target.value) : null)}>
              <option value="">자동 (소재 양에 따라 {state.range[0]}~{state.range[1]}장)</option>
              {Array.from({ length: state.range[1] - state.range[0] + 1 }, (_, i) => state.range[0] + i).map((n) => (
                <option key={n} value={n}>
                  {n}장
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="primary big" disabled={!!notReady || body.trim().length < 20 || coverRunning} onClick={() => void startCovers()}>
            표지 제목 후보 만들기
          </button>
          <span className="muted small">보통 1분 · AI 2번(규칙에 걸리면 더)</span>
        </div>
        {error && <p className="status error">{error}</p>}
      </section>

      {coverRunning && <Progress job={coverJob.job} onCancel={() => void coverJob.cancel()} label="표지 제목 후보를 만드는 중… (생성 → 규칙 → 고정 틀로 그려 넘침 재기 → 자기 평가)" />}

      {covers && <CoverPicker covers={covers} bodyRunning={bodyRunning} onChoose={(i) => void choose(i)} />}

      {bodyRunning && <Progress job={bodyJob.job} onCancel={() => void bodyJob.cancel()} label="본문 카드를 만드는 중… (생성 → 근거 대조 → 모든 카드를 그려 넘침 재기 → 자기 평가)" />}

      {bodyResult?.status === 'failed' && (
        <section className="card">
          <p className="status error">본문을 만들지 못했어요(재작성 {bodyResult.rewrites}번 뒤에도 규칙 위반). 다른 표지를 고르거나 다시 시도하세요.</p>
          <ul className="small">
            {bodyResult.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </section>
      )}

      {bodyResult?.status === 'needs_edit' && <OverflowEditor bodyResult={bodyResult} edits={edits} setEdits={setEdits} busy={busy} onFinish={() => void finish()} />}

      {viewSet !== null && (
        <section className="card" id="set-view">
          <h2>카드 세트 #{viewSet}</h2>
          <SetView setId={viewSet} />
        </section>
      )}

      {state.sets.length > 0 && <SetHistory sets={state.sets} onView={setViewSet} />}
    </>
  );
}
