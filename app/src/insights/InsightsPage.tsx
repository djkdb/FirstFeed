// 성과 (FR-IN-2~6 · 사용자 결정 2026-11-22). 숫자는 Metricool 에서 앱이 직접 받는다(AI 를 거치지 않음) — Metricool 에 없는 게시물만 직접 입력.
// 게시물 ↔ 만든 세트는 앱이 후보만 내고 사용자가 「맞아요」를 눌러야 잇는다. 비어 있는 수치는 「입력 안 됨」 — 0 으로 보이지 않는다.
// 제안은 AI 가 표의 값만 근거로 내고(코드가 대조), 「프로필에 반영」을 눌러야 프로필이 바뀐다(3주 뒤 생성 입력에서 빠짐)
import { useCallback, useEffect, useState } from 'react';
import { blogCall } from '../blog/useBlogJob.tsx';
import { loadError } from '../loadError.ts';
import { isoLocal } from '../time.ts';
import { useJob } from '../useJob.ts';
import { clip, DIMS, formatName, NUMS, type Conn, type Dim, type Draft, type View } from './insightsShared.tsx';
import { PostsSection } from './PostsSection.tsx';
import { GroupsSection } from './GroupsSection.tsx';
import { SuggestionsSection } from './SuggestionsSection.tsx';

export function InsightsPage() {
  const [view, setView] = useState<View | null>(null);
  const [conn, setConn] = useState<Conn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [dim, setDim] = useState<Dim>('pillar');
  const [jobId, setJobId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(
    () =>
      Promise.all([blogCall<View>('GET', '/api/insights'), blogCall<Conn>('GET', '/api/insights/metricool')])
        .then(([v, c]) => {
          if (!v.ok) throw new Error(v.data.error ?? '');
          setView(v.data);
          if (c.ok) setConn(c.data);
        })
        .catch((e: unknown) => setError(loadError(e))),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const { job, cancel } = useJob(
    jobId,
    (j) => {
      setJobId(null);
      const r = j.result as { status?: string; message?: string; errors?: string[]; count?: number } | null;
      if (j.phase === 'failed') setError(`${j.error?.message ?? '실패했어요.'} ${j.error?.hint ?? ''}`);
      else if (j.phase === 'cancelled') setError('취소했어요. 다시 하려면 버튼을 누르세요.');
      else if (r?.status === 'not_enough') setInfo(r.message ?? null);
      else if (r?.status === 'failed') setError(`재작성 한도 안에 규칙을 통과한 제안이 나오지 않아 저장하지 않았어요. ${r.errors?.slice(0, 2).join(' / ') ?? ''}`);
      else if (r?.status === 'saved') setInfo(r.count ? `제안 ${r.count}개를 받았어요.` : '표에서 뚜렷한 차이를 찾지 못해 제안이 없어요.');
      void load();
    },
    () => setJobId(null),
  );

  /** 바꾸는 요청 — 성공하면 서버가 돌려준 화면 값으로 */
  const act = async (method: string, url: string, body?: unknown, done?: string) => {
    setError(null);
    setInfo(null);
    const r = await blogCall<View>(method, url, body);
    if (!r.ok) return void setError(r.data.error ?? '하지 못했어요. 다시 시도하세요.');
    if ('posts' in r.data) setView(r.data);
    if (done) setInfo(done);
    return true;
  };

  const fetchNow = async () => {
    setFetching(true);
    setError(null);
    setInfo(null);
    const r = await blogCall<{ added: number; updated: number; received: number; brand: string; warnings: string[]; view: View }>('POST', '/api/insights/fetch');
    setFetching(false);
    if (!r.ok) return setError(r.data.error ?? '불러오지 못했어요.');
    setView(r.data.view);
    setInfo(`「${r.data.brand}」에서 게시물 ${r.data.received}개를 받았어요(새로 ${r.data.added} · 고침 ${r.data.updated}).${r.data.warnings.length ? ` ${r.data.warnings.join(' ')}` : ''}`);
  };

  const saveDraft = async () => {
    if (!draft) return;
    const nums = Object.fromEntries(NUMS.map(({ k }) => [k, draft.nums[k].trim() === '' ? null : Number(draft.nums[k].replace(/,/g, ''))]));
    if (Object.values(nums).some((v) => v !== null && (!Number.isInteger(v) || v < 0))) return setError('숫자 칸에는 0 이상의 정수만 넣어 주세요. 모르는 수치는 비워 두세요.');
    const body = { publishedAt: new Date(draft.publishedAt).toISOString(), type: draft.type, url: draft.url || null, content: draft.content || null, ...nums, ...(editing ? {} : { setId: draft.setId ? Number(draft.setId) : null }) };
    const ok = await act(editing ? 'PUT' : 'POST', editing ? `/api/insights/posts/${editing}` : '/api/insights/posts', body, editing ? '고쳤어요.' : '게시물을 넣었어요.');
    if (!ok) return;
    setDraft(null);
    setEditing(null);
  };

  if (!view) return <section className="card">{error ?? '불러오는 중…'}</section>;

  const s = view.settings;
  const setTitle = (id: number | null) => (id === null ? null : (view.sets.find((x) => x.id === id)?.title ?? `세트 ${id}`));
  const postOf = (id: number) => view.posts.find((p) => p.id === id);
  const groups = view.groups.filter((g) => g.dim === dim);
  const pending = view.suggestions.filter((x) => x.status === 'pending');
  const groupLabel = (key: string) => {
    const g = view.groups.find((x) => x.key === key);
    return g ? `${DIMS.find((d) => d.id === g.dim)?.label} 「${g.label}」` : key;
  };

  return (
    <div className="insights">
      <section className="card">
        <div className="card-head">
          <h2>성과</h2>
          <div className="actions" style={{ marginTop: 0 }}>
            <button type="button" className="primary" disabled={!conn?.connected || fetching} onClick={() => void fetchNow()}>
              {fetching ? '불러오는 중…' : 'Metricool 에서 불러오기'}
            </button>
          </div>
        </div>
        <p className="muted">
          게시물 성과를 보고 다음에 더 할 것 · 줄일 것을 정해요. 숫자는 Metricool 에서 이 앱이 직접 받아 와요 — AI 는 숫자를 만지지 않아요. 게시 뒤 {s.matureHours}시간이 지난 게시물만 분석에 쓰고, 한 묶음에 값이 있는 게시물이 {s.minSamples}개보다 적으면 결론을 내지 않아요.
        </p>
        <div className="ins-conn">
          {conn?.connected ? (
            <span className={`badge ${conn.needsReconnect ? 'badge-warn' : 'badge-ok'}`}>{conn.needsReconnect ? 'Metricool 다시 연결 필요' : 'Metricool 연결됨 · 읽기만'}</span>
          ) : (
            <span className="badge badge-off">Metricool 연결 안 됨</span>
          )}
          <span className="muted small">{view.lastFetchedAt ? `마지막으로 받은 때 ${isoLocal(view.lastFetchedAt)}` : '아직 불러온 적 없음'}</span>
          {(!conn?.connected || conn.needsReconnect) && (
            <a className="small" href="#/settings">
              설정 → 연결된 계정에서 연결하기
            </a>
          )}
        </div>
        {error && <p className="status error">{error}</p>}
        {info && <p className="status ok small">{info}</p>}
      </section>

      {view.candidates.length > 0 && (
        <section className="card">
          <h2>잇기 확인</h2>
          <p className="muted small">「올렸어요」를 누른 세트와 같은 때 올라간 게시물이에요. 맞으면 「맞아요」를 눌러 이어 주세요 — 이어야 축 · 제목 유형 표에 들어가요. 앱이 저절로 잇지는 않아요.</p>
          {view.candidates.map((c) => (
            <div key={c.setId} className="ins-cand">
              <div className="ins-cand-set">
                <span className="eyebrow">만든 세트</span>
                <b>{setTitle(c.setId)}</b>
              </div>
              <ul className="ins-cand-list">
                {c.candidates.map((k) => {
                  const p = postOf(k.postId);
                  return (
                    <li key={k.postId}>
                      <div className="ins-cand-post">
                        <span className="small muted">
                          {p?.publishedAt ? isoLocal(p.publishedAt) : '날짜 모름'} · {formatName(p?.type ?? null)} · 「올렸어요」와 {k.dayGap === 0 ? '같은 날' : `${k.dayGap}일 차이`} · 글 겹침 {Math.round(k.score * 100)}%
                        </span>
                        <span>{clip(p?.content ?? null, 90) ?? <span className="muted">글 없음</span>}</span>
                      </div>
                      <div className="set-actions">
                        <button type="button" className="small primary" onClick={() => void act('PUT', `/api/insights/posts/${k.postId}/link`, { setId: c.setId }, '이었어요.')}>
                          맞아요
                        </button>
                        <button type="button" className="small ghost" onClick={() => void act('POST', '/api/insights/candidates/reject', { postId: k.postId, setId: c.setId })}>
                          아니에요
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      <PostsSection view={view} draft={draft} setDraft={setDraft} editing={editing} setEditing={setEditing} saveDraft={saveDraft} setTitle={setTitle} act={act} />

      <GroupsSection groups={groups} dim={dim} setDim={setDim} s={s} />

      <SuggestionsSection view={view} s={s} jobId={jobId} setJobId={setJobId} job={job} cancel={cancel} setError={setError} setInfo={setInfo} groupLabel={groupLabel} pending={pending} act={act} />
    </div>
  );
}
