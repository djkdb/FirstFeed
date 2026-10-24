// 카드뉴스 만들기 (FR-MK-1): 소재 붙여넣기 → 표지 제목 후보(고정 틀로 그린 PNG) → 고르기 → 본문 → 세트.
// 2회 재작성 뒤에도 넘친 카드는 어느 칸이 약 몇 자 넘쳤는지 보이고 직접 줄이게 한다(줄여야 저장).
// 긴 AI 작업은 진행·취소를 보이고, 새로고침해도 이어서 보도록 작업 ID 를 이 브라우저에 임시 저장한다
import { useCallback, useEffect, useState } from 'react';
import type { InferResponseType } from 'hono/client';
import { api } from '../api.ts';
import { localTime } from '../time.ts';
import { PublishPanel } from './PublishPanel.tsx';
import { PremadeBadge } from '../premade.tsx';
import { useJob, type JobView } from '../useJob.ts';
import { StageLine } from '../StageLine.tsx';

type State = InferResponseType<typeof api.api.cards.$get>;
interface Candidate {
  index: number;
  headline: string;
  sub: string | null;
  chip: string | null;
  png: string;
  scale: number;
}
interface CoversResult {
  candidates: Candidate[];
  dropped: Array<{ headline: string; sub: string | null; reasons: string[] }>;
  calls: number;
  rewrites: number;
}
interface Overflow {
  where: string;
  slot: string;
  message: string;
}
interface Draft {
  cards: Array<{ title: string; text: string }>;
  closing: { headline: string; sub: string | null };
}
type BodyResult =
  | { status: 'saved'; setId: number; calls: number; rewrites: number }
  | { status: 'needs_edit'; draft: Draft; overflows: Overflow[]; previews: Array<{ where: string; png: string | null }>; calls: number; rewrites: number }
  | { status: 'failed'; errors: string[]; calls: number; rewrites: number };

const KEY = { cover: 'firstfeed.cards.coverJob', body: 'firstfeed.cards.bodyJob' } as const;
const RUN_LABEL: Record<string, string> = { generate: '생성', json_retry: 'JSON 재요청', rewrite: '재작성', review: '자기 평가' };
const load = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const save = (k: string, v: string | null) => {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {
    /* 임시 저장 없이 동작 */
  }
};

function Progress({ job, onCancel, label }: { job: JobView | null; onCancel: () => void; label: string }) {
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

/** 카드 아래 표시된 풀이 문장: 「확인했어요」 체크(저장돼 다시 열어도 유지) 또는 직접 고치기(그 카드만 다시 그림) — 결정 2026-10-18 */
function GlossItem({ setId, idx, gloss, onChanged }: { setId: number; idx: number; gloss: { sentence: string; term: string; checkedAt?: string | null }; onChanged: () => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async (path: string, body: unknown) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/cards/sets/${setId}/glosses/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const b = (await r.json()) as { error?: string; ok?: boolean; problems?: string[] };
      if (b.error) throw new Error(b.error);
      if (b.ok === false) throw new Error(`다시 그리니 넘쳐요: ${(b.problems ?? []).join(' ')}`);
      setDraft(null);
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`gloss small${gloss.checkedAt ? ' checked' : ''}`}>
      <mark>{gloss.sentence}</mark>
      <br />
      <span className="muted">「{gloss.term}」 풀이 · 소재에 없는 설명이에요 — 올리기 전에 맞는지 확인하세요</span>
      {draft === null ? (
        <div className="actions">
          <label>
            <input type="checkbox" checked={!!gloss.checkedAt} disabled={busy} onChange={(e) => void send('check', { idx, sentence: gloss.sentence, checked: e.target.checked })} /> 확인했어요
          </label>
          <button type="button" className="link" disabled={busy} onClick={() => setDraft(gloss.sentence)}>
            고치기
          </button>
        </div>
      ) : (
        <div className="actions">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="button" disabled={busy} onClick={() => void send('edit', { idx, sentence: gloss.sentence, replacement: draft })}>
            {busy ? '다시 그리는 중…' : '저장(비우면 문장을 지워요)'}
          </button>
          <button type="button" disabled={busy} onClick={() => setDraft(null)}>
            그만두기
          </button>
        </div>
      )}
      {err && <span className="status error">{err}</span>}
    </div>
  );
}

type Rewrites = Extract<InferResponseType<(typeof api.api.cards.sets)[':id']['rewrites']['$get']>, { body: unknown }>;

/** 재작성 기록 한 줄(결정 2026-10-21 · C) — 펼치면 걸린 규칙 · 이유와 바뀐 칸 전/후. 기록은 2026-10-21 이후 만든 세트부터 남는다 */
function RewriteLine({ setId }: { setId: number }) {
  const [r, setR] = useState<Rewrites | null>(null);
  useEffect(() => {
    api.api.cards.sets[':id'].rewrites
      .$get({ param: { id: String(setId) } })
      .then(async (res) => {
        const b = (await res.json()) as Rewrites | { error: string };
        if ('body' in b) setR(b);
      })
      .catch(() => setR(null));
  }, [setId]);
  if (!r) return null;
  const steps = [...r.cover.map((x) => ({ ...x, part: '표지 후보' })), ...r.body.map((x) => ({ ...x, part: '본문' }))];
  return (
    <details className="small rewrites">
      <summary>AI 가 고친 곳 {steps.length}개{steps.length === 0 ? ' (한 번에 규칙 통과, 또는 기록 기능 전에 만든 세트)' : ''}</summary>
      <ul>
        {steps.map((st, i) => (
          <li key={i}>
            <b>{st.part}</b> · 걸린 것: {st.issues.map((x) => `${x.code}${x.where ? `(${x.where})` : ''} ${x.message}`).join(' / ')}
            <ul>
              {st.changes.map((ch) => (
                <li key={ch.path}>
                  <code>{ch.path}</code>: <s>{ch.before ?? '(없음)'}</s> → {ch.after ?? '(없음)'}
                </li>
              ))}
            </ul>
            {!st.passedAfter && <span className="muted">(다시 쓴 것도 또 걸려 다음 단계로)</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

function SetView({ setId }: { setId: number }) {
  const [set, setSet] = useState<{
    coverImage: string | null;
    createdAt: string;
    cards: Array<{ idx: number; kind: string; pngFile: string; edited: boolean; image: { prompt: string; filename: string } | null; glosses: Array<{ sentence: string; term: string; checkedAt?: string | null }> | null; render: { scale: number; browser: string; reference: boolean } }>;
  } | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  // 같은 주소의 PNG 를 다시 그렸을 때 화면이 옛 그림을 보이지 않게
  const [rev, setRev] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      api.api.cards.sets[':id']
        .$get({ param: { id: String(setId) } })
        .then((r) => r.json() as Promise<{ set?: unknown; draftId?: string | null }>)
        .then((b) => {
          setSet((b.set as never) ?? null);
          setDraftId(b.draftId ?? null);
          setRev((n) => n + 1);
        }),
    [setId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  // 그림 바탕 표지(시안 F): 그림 프롬프트로 만든 그림을 올리면 표지만 다시 그린다. 본문은 파일 바이트라 RPC 대신 fetch
  const uploadCover = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/cards/sets/${setId}/cover-image`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: file });
      const b = (await r.json()) as { ok?: boolean; shade?: number | null; problems?: string[]; error?: string };
      if (b.ok) setMsg({ ok: true, text: `표지를 그림 바탕으로 다시 그렸어요${b.shade ? ` (글자 뒤 띠 진하기 ${Math.round(b.shade * 100)}%)` : ''}.` });
      else setMsg({ ok: false, text: b.error ?? b.problems?.join(' ') ?? '표지를 다시 그리지 못했습니다.' });
      await load();
    } finally {
      setBusy(false);
    }
  };
  if (!set) return <p className="muted">불러오는 중…</p>;
  const glossCount = set.cards.reduce((n, c) => n + (c.glosses?.length ?? 0), 0);
  return (
    <>
      <PremadeBadge createdAt={set.createdAt} />
      <RewriteLine setId={setId} />
      {draftId === 'F' && (
        <div className="actions small">
          <label>
            표지 그림 올리기 (그림 프롬프트로 만든 PNG·JPG){' '}
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => e.target.files?.[0] && void uploadCover(e.target.files[0])} />
          </label>
          <span className="muted">{set.coverImage ? '그림 바탕 표지예요. 다른 그림을 올리면 바꿔요.' : '아직 그림이 없어 단색 표지예요.'}</span>
        </div>
      )}
      {msg && <p className={`status ${msg.ok ? 'ok' : 'error'} small`}>{msg.text}</p>}
      {glossCount > 0 && (
        <p className="gloss-summary small">
          소재에 없는 설명 {glossCount}곳 — 맞는지 코드로 확인할 수 없어 표시했어요. 아래 카드에서 <mark>강조한 문장</mark>을 올리기 전에 확인하세요.
        </p>
      )}
      <div className="frames">
        {set.cards.map((c) => (
          <figure key={c.idx} className="frame">
            <img src={`/api/cards/sets/${setId}/png/${c.pngFile}?v=${rev}`} alt={`${c.idx + 1}번 카드`} />
            <figcaption className="small">
              {c.idx + 1}. {c.kind === 'cover' ? '표지' : c.kind === 'closing' ? '마무리' : '본문'}
              {c.render.scale < 1 && <span className="muted"> · 글자 {Math.round(c.render.scale * 100)}%</span>}
              {c.edited && <span className="tag">직접 고침</span>}
            </figcaption>
            {c.glosses?.map((g) => (
              <GlossItem key={g.sentence} setId={setId} idx={c.idx} gloss={g} onChanged={() => void load()} />
            ))}
            {c.image && (
              <details className="small">
                <summary>그림 프롬프트 · {c.image.filename}</summary>
                <pre>{c.image.prompt}</pre>
              </details>
            )}
          </figure>
        ))}
      </div>
      <p className="muted small">찍은 브라우저: {set.cards[0]?.render.browser}{set.cards[0] && !set.cards[0].render.reference && ' · 기준 브라우저 아님'}</p>
      <PublishPanel setId={setId} cardUnchecked={set.cards.reduce((n, c) => n + (c.glosses?.filter((g) => !g.checkedAt).length ?? 0), 0)} onChanged={() => void load()} />
    </>
  );
}

/** 홈의 「이 칸으로 만들기」로 왔을 때(#/make?slot=N) 그 칸 번호 */
const slotFromHash = (): number | null => {
  const v = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('slot');
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
  const [viewSet, setViewSet] = useState<number | null>(null);
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
      .catch((e: Error) => setSlotNotice(`세트는 만들었지만 ${n + 1}번 칸에 잇지 못했어요(${e.message}). 홈에서 「이 칸에 잇기」로 이으세요.`));
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

  return (
    <>
      <section className="card">
        <h2>카드뉴스 만들기</h2>
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
        <label className="block small">
          소재 원문 (메모·공식 문서·릴리스 노트 등 — 숫자·이름은 여기 있는 것만 카드에 들어가요)
          <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} disabled={!!notReady} />
        </label>
        <label className="block small">
          메모 (선택 — 내가 직접 쓴 말이라 카드에 써도 되는 사실이 돼요)
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
          <button type="button" className="primary" disabled={!!notReady || body.trim().length < 20 || coverRunning} onClick={() => void startCovers()}>
            표지 제목 후보 만들기
          </button>
          <span className="muted small">AI 호출 2번(생성 + 자기 평가, 재작성하면 더) · 보통 1분 안쪽</span>
        </div>
        {error && <p className="status error">{error}</p>}
      </section>

      {coverRunning && <Progress job={coverJob.job} onCancel={() => void coverJob.cancel()} label="표지 제목 후보를 만드는 중… (생성 → 규칙 → 고정 틀로 그려 넘침 재기 → 자기 평가)" />}

      {covers && (
        <section className="card">
          <h2>표지 고르기</h2>
          <p className="muted small">
            AI 호출 {covers.calls}번 · 재작성 {covers.rewrites}번 · 규칙에 걸려 뺀 후보 {covers.dropped.length}개. 표지를 누르면 본문을 만들어요(AI 호출 2번, 재작성하면 2번씩 더 · 보통 1~2분, 재작성이 겹치면 5분 넘게 걸리기도 해요).
          </p>
          <div className="frames">
            {covers.candidates.map((c) => (
              <figure key={c.index} className="frame">
                <button type="button" className="pick-cover" disabled={bodyRunning} onClick={() => void choose(c.index)}>
                  <img src={c.png} alt={c.headline} />
                </button>
                <figcaption className="small">{c.headline.replace(/\*\*/g, '')}</figcaption>
              </figure>
            ))}
          </div>
          {covers.dropped.length > 0 && (
            <details className="small muted">
              <summary>뺀 후보 {covers.dropped.length}개</summary>
              <ul>
                {covers.dropped.map((d, i) => (
                  <li key={i}>
                    <strong>{d.headline}</strong>
                    {d.sub && <span className="muted"> / 부제: {d.sub}</span>} — {d.reasons.join(' / ')}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

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

      {bodyResult?.status === 'needs_edit' && (
        <section className="card">
          <h2>넘친 칸 직접 줄이기</h2>
          <p className="note small">재작성 {bodyResult.rewrites}번 뒤에도 아래 칸이 틀을 넘쳐요. 직접 줄이면 다시 그려서 저장해요(줄이기 전엔 저장하지 않아요).</p>
          {bodyResult.overflows.map((o) => {
            const m = /^cards\.(\d+)/.exec(o.where);
            const card = m ? bodyResult.draft.cards[Number(m[1])] : null;
            const isClosing = o.where.startsWith('closing');
            const field = isClosing ? 'headline' : o.slot === 'title' ? 'title' : 'text';
            const where = isClosing ? 'closing' : `cards.${m?.[1]}`;
            const key = `${where}|${field}`;
            const initial = isClosing ? bodyResult.draft.closing.headline : field === 'title' ? card?.title : card?.text;
            return (
              <div key={o.where} className="editor">
                <p className="small">
                  <strong>{isClosing ? '마무리' : `${Number(m?.[1]) + 2}번 카드`}</strong> — {o.message}
                </p>
                <textarea rows={field === 'text' ? 6 : 2} value={edits[key] ?? initial ?? ''} onChange={(e) => setEdits({ ...edits, [key]: e.target.value })} />
              </div>
            );
          })}
          <div className="actions">
            <button type="button" className="primary" disabled={busy || Object.keys(edits).length === 0} onClick={() => void finish()}>
              줄여서 저장
            </button>
          </div>
          <div className="frames">
            {bodyResult.previews.map((p) => (
              <figure key={p.where} className={p.png ? 'frame' : 'frame bad'}>
                {p.png ? <img src={p.png} alt={p.where} /> : <div className="noimg">넘침</div>}
                <figcaption className="small">{p.where}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {viewSet !== null && (
        <section className="card">
          <h2>카드 세트 #{viewSet}</h2>
          <SetView setId={viewSet} />
        </section>
      )}

      {state.sets.length > 0 && (
        <section className="card history">
          <h2>만든 세트</h2>
          <ul>
            {state.sets.map((s) => (
              <li key={s.id}>
                #{s.id} · {s.cover.replace(/\*\*/g, '').replace(/\n/g, ' ')} · 본문 {s.bodyCount}장 · {localTime(s.createdAt)} <PremadeBadge createdAt={s.createdAt} />
                <button type="button" onClick={() => setViewSet(s.id)}>
                  보기
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
