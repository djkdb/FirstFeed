// 성과 (FR-IN-2~6 · 사용자 결정 2026-11-22). 숫자는 Metricool 에서 앱이 직접 받는다(AI 를 거치지 않음) — Metricool 에 없는 게시물만 직접 입력.
// 게시물 ↔ 만든 세트는 앱이 후보만 내고 사용자가 「맞아요」를 눌러야 잇는다. 비어 있는 수치는 「입력 안 됨」 — 0 으로 보이지 않는다.
// 제안은 AI 가 표의 값만 근거로 내고(코드가 대조), 「프로필에 반영」을 눌러야 프로필이 바뀐다(3주 뒤 생성 입력에서 빠짐)
import { useCallback, useEffect, useState } from 'react';
import type { InferResponseType } from 'hono/client';
import { api } from '../api.ts';
import { blogCall } from '../blog/useBlogJob.tsx';
import { notifyChanged } from '../changed.ts';
import { loadError } from '../loadError.ts';
import { StageLine } from '../StageLine.tsx';
import { isoLocal } from '../time.ts';
import { useJob } from '../useJob.ts';

type View = InferResponseType<typeof api.api.insights.$get, 200>;
type Post = View['posts'][number];
type Group = View['groups'][number];
type Dim = Group['dim'];
interface Conn {
  connected: boolean;
  needsReconnect: boolean;
  brandId: string | null;
}

const FORMATS: Array<{ id: string; label: string }> = [
  { id: 'FEED_CAROUSEL_ALBUM', label: '캐러셀(여러 장)' },
  { id: 'FEED_IMAGE', label: '사진 한 장' },
  { id: 'FEED_VIDEO', label: '영상' },
  { id: 'REELS', label: '릴스' },
];
const formatName = (t: string | null) => (t ? (FORMATS.find((f) => f.id === t)?.label ?? t) : '형식 모름');
const DIMS: Array<{ id: Dim; label: string }> = [
  { id: 'pillar', label: '축' },
  { id: 'format', label: '형식' },
  { id: 'title', label: '제목 유형' },
];
const pct = (v: number | null) => (v === null ? null : `${(Math.round(v * 1000) / 10).toFixed(1)}%`);
const clip = (s: string | null, n = 60) => (s ? ([...s].length > n ? `${[...s].slice(0, n - 1).join('')}…` : s) : null);

/** 비어 있는 값은 0 이 아니라 「입력 안 됨」 */
function Val({ v }: { v: number | null }) {
  return v === null ? <span className="muted small">입력 안 됨</span> : <>{v.toLocaleString('ko-KR')}</>;
}

/** 「이 컴퓨터 시각」 datetime-local 값 */
const localInput = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const NUMS = [
  { k: 'reach', label: '도달' },
  { k: 'saved', label: '저장' },
  { k: 'shares', label: '공유' },
  { k: 'views', label: '조회' },
  { k: 'likes', label: '좋아요' },
  { k: 'comments', label: '댓글' },
] as const;
type NumKey = (typeof NUMS)[number]['k'];

interface Draft {
  publishedAt: string;
  type: string;
  url: string;
  content: string;
  setId: string;
  nums: Record<NumKey, string>;
}
const emptyDraft = (): Draft => ({ publishedAt: localInput(), type: 'FEED_CAROUSEL_ALBUM', url: '', content: '', setId: '', nums: { reach: '', saved: '', shares: '', views: '', likes: '', comments: '' } });
const draftFrom = (p: Post): Draft => ({
  publishedAt: p.publishedAt ? localInput(new Date(p.publishedAt)) : localInput(),
  type: p.type ?? 'FEED_CAROUSEL_ALBUM',
  url: p.url ?? '',
  content: p.content ?? '',
  setId: p.setId === null ? '' : String(p.setId),
  nums: Object.fromEntries(NUMS.map(({ k }) => [k, p[k] === null ? '' : String(p[k])])) as Record<NumKey, string>,
});

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

      <section className="card">
        <div className="card-head">
          <h2>게시물</h2>
          {!draft && (
            <button type="button" className="small" onClick={() => (setEditing(null), setDraft(emptyDraft()))}>
              직접 입력
            </button>
          )}
        </div>
        <p className="muted small">Metricool 에 없는 게시물만 직접 입력해요. 모르는 수치는 비워 두면 「입력 안 됨」으로 남고 계산에서 빠져요(0 으로 치지 않아요).</p>
        {draft && (
          <form
            className="panel ins-form"
            onSubmit={(e) => {
              e.preventDefault();
              void saveDraft();
            }}
          >
            <div className="ins-form-row">
              <label>
                게시한 때
                <input type="datetime-local" required value={draft.publishedAt} onChange={(e) => setDraft({ ...draft, publishedAt: e.target.value })} />
              </label>
              <label>
                형식
                <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                  {FORMATS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              {!editing && (
                <label>
                  이은 세트
                  <select value={draft.setId} onChange={(e) => setDraft({ ...draft, setId: e.target.value })}>
                    <option value="">잇지 않음</option>
                    {view.sets
                      .filter((x) => !x.linked || String(x.id) === draft.setId)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {clip(x.title, 30)}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </div>
            <div className="ins-nums">
              {NUMS.map(({ k, label }) => (
                <label key={k}>
                  {label}
                  <input inputMode="numeric" placeholder="모름" value={draft.nums[k]} onChange={(e) => setDraft({ ...draft, nums: { ...draft.nums, [k]: e.target.value } })} />
                </label>
              ))}
            </div>
            <label>
              게시물 주소(선택)
              <input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://www.instagram.com/p/…" />
            </label>
            <label>
              캡션 첫 줄 · 메모(선택)
              <input value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
            </label>
            <div className="set-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="submit" className="primary small">
                {editing ? '고친 것 저장' : '넣기'}
              </button>
              <button type="button" className="small ghost" onClick={() => (setDraft(null), setEditing(null))}>
                취소
              </button>
            </div>
          </form>
        )}
        {view.posts.length === 0 ? (
          <p className="empty-state">아직 게시물이 없어요. Metricool 에서 불러오거나 직접 입력하세요.</p>
        ) : (
          <ul className="ins-posts">
            {view.posts.map((p) => (
              <PostRow
                key={p.id}
                p={p}
                sets={view.sets}
                setTitle={setTitle(p.setId)}
                onLink={(setId) => void act('PUT', `/api/insights/posts/${p.id}/link`, { setId })}
                onEdit={() => (setEditing(p.id), setDraft(draftFrom(p)))}
                onDelete={() => window.confirm('이 직접 입력 게시물을 지울까요?') && void act('DELETE', `/api/insights/posts/${p.id}`)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>묶음별 평균</h2>
          <div className="seg" role="tablist" aria-label="묶는 기준">
            {DIMS.map((d) => (
              <button key={d.id} type="button" role="tab" aria-selected={dim === d.id} className={dim === d.id ? 'on' : ''} onClick={() => setDim(d.id)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <p className="muted small">
          저장률 = 저장 ÷ 도달, 공유율 = 공유 ÷ 도달(게시물마다 낸 비율의 평균). {dim === 'format' ? '잇지 않은 게시물도 들어가요.' : '세트와 이은 게시물만 들어가요.'}
          {` 「표본 부족」은 값 있는 게시물이 ${s.minSamples}개보다 적어 결론을 내지 않는다는 뜻이에요.`}
          {dim === 'title' && ' 제목 유형은 표지 제목으로 정해요: 「?」 · 「…까 · 나요」로 끝나면 질문형, 숫자가 있으면 숫자형.'}
        </p>
        {groups.length === 0 ? (
          <p className="empty-state">{dim === 'format' ? '48시간이 지난 게시물이 아직 없어요.' : '48시간이 지난 게시물 중 세트와 이은 것이 아직 없어요.'}</p>
        ) : (
          <div className="ins-scroll">
            <table className="ins-table">
              <thead>
                <tr>
                  <th>{DIMS.find((d) => d.id === dim)!.label}</th>
                  <th className="num">게시물</th>
                  <th className="num">저장률</th>
                  <th className="num">공유율</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.key}>
                    <td>{g.label}</td>
                    <td className="num">{g.n}</td>
                    <td className="num">
                      <Rate m={g.saveRate} />
                    </td>
                    <td className="num">
                      <Rate m={g.shareRate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>다음에 할 것</h2>
          {!jobId ? (
            <button type="button" className="primary" disabled={!view.hasProfile} onClick={() => void blogCall<{ jobId: string }>('POST', '/api/insights/suggest').then((r) => (setError(null), setInfo(null), r.ok ? setJobId(r.data.jobId) : setError(r.data.error ?? '시작하지 못했어요.')))}>
              다음에 할 것 제안 받기
            </button>
          ) : (
            <button type="button" onClick={() => void cancel()}>
              취소
            </button>
          )}
        </div>
        <p className="muted small">AI 가 위 표 중 결론을 낼 수 있는 값만 보고 최대 3개를 제안해요. 인용한 숫자가 표와 같은지는 코드가 대조해요. 「프로필에 반영」을 눌러야 프로필이 바뀌고, {s.acceptDays}일이 지나면 제목 · 카드 생성에서 저절로 빠져요.</p>
        {jobId && <StageLine stage={job?.stage} />}
        {!view.hasProfile && <p className="note small">「정체성」에서 프로필을 먼저 확정하세요.</p>}
        {view.suggestions.length > 0 && (
          <ul className="ins-sugs">
            {view.suggestions.map((x) => (
              <li key={x.id} className={`ins-sug ${x.status}`}>
                <div className="ins-sug-head">
                  <span className={`badge ${x.kind === 'more' ? 'badge-ok' : 'badge-warn'}`}>{x.kind === 'more' ? '더 할 것' : '줄일 것'}</span>
                  <span className="small muted">{groupLabel(x.groupKey)}</span>
                </div>
                <p className="ins-sug-text">{x.text}</p>
                <div className="ins-chips">
                  {x.evidence.map((e, i) => (
                    <span key={i} className="ins-chip">
                      {groupLabel(e.groupKey)} {e.metric === 'saveRate' ? '저장률' : '공유율'} <b>{e.value}</b>
                    </span>
                  ))}
                </div>
                <p className="small">
                  프로필 {x.kind === 'more' ? '말투 규칙' : '피할 것'}에 더할 줄: <b>{x.rule}</b>
                </p>
                {x.status === 'pending' ? (
                  <div className="set-actions" style={{ justifyContent: 'flex-start' }}>
                    <button
                      type="button"
                      className="small primary"
                      onClick={() => void act('POST', `/api/insights/suggestions/${x.id}/accept`, undefined, `프로필에 반영했어요 — ${s.acceptDays}일 뒤 저절로 빠져요.`).then((ok) => ok && notifyChanged())}
                    >
                      프로필에 반영
                    </button>
                    <button type="button" className="small ghost" onClick={() => void act('POST', `/api/insights/suggestions/${x.id}/reject`)}>
                      넘기기
                    </button>
                  </div>
                ) : (
                  <p className="small muted">{x.status === 'accepted' ? '반영함' : '넘김'}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {pending.length === 0 && view.suggestions.length === 0 && !jobId && <p className="empty-state">아직 받은 제안이 없어요.</p>}
      </section>

      <section className="card">
        <h2>반영한 변경</h2>
        <p className="muted small">성과에서 온 변경이에요. 만료일이 지나면 생성 입력에서 빠지고 여기에 「만료됨」으로 남아요. 정체성 화면의 판 이력에서 되돌릴 수도 있어요.</p>
        {view.accepted.length === 0 ? (
          <p className="empty-state">아직 반영한 변경이 없어요.</p>
        ) : (
          <ul className="ins-accepted">
            {view.accepted.map((a) => (
              <li key={a.id}>
                <div>
                  <b>{a.rule}</b> <span className="small muted">· {a.kind === 'more' ? '말투 규칙' : '피할 것'}</span>
                </div>
                <div className="small muted">
                  {a.decidedAt ? `반영 ${isoLocal(`${a.decidedAt.replace(' ', 'T')}Z`, false)} · ` : ''}
                  {a.expired ? <span className="badge badge-off">성과에서 온 변경 · 만료됨</span> : a.expiresAt ? `${isoLocal(a.expiresAt, false)}까지` : ''}
                  {!a.expired && !a.inProfile && ' · 지금 프로필에는 없음(직접 지웠거나 되돌림)'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Rate({ m }: { m: Group['saveRate'] }) {
  if (m.enough && m.formatted) return <>{m.formatted}</>;
  return (
    <span className="badge badge-off" title="값 있는 게시물이 모자라 결론을 내지 않아요">
      표본 부족{m.n ? ` · ${m.n}개` : ''}
    </span>
  );
}

function PostRow({
  p,
  sets,
  setTitle,
  onLink,
  onEdit,
  onDelete,
}: {
  p: Post;
  sets: View['sets'];
  setTitle: string | null;
  onLink: (setId: number | null) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const stats: Array<[string, React.ReactNode]> = [
    ['도달', <Val v={p.reach} />],
    ['저장', <Val v={p.saved} />],
    ['공유', <Val v={p.shares} />],
    ['저장률', pct(p.saveRate) ?? <span className="muted small">계산 안 됨</span>],
    ['공유율', pct(p.shareRate) ?? <span className="muted small">계산 안 됨</span>],
  ];
  return (
    <li className="ins-post">
      <div className="ins-post-head">
        <span className="ins-post-when">{p.publishedAt ? isoLocal(p.publishedAt) : <span className="muted">날짜 모름</span>}</span>
        <span className="small muted">{formatName(p.type)}</span>
        <span className="badge badge-off">{p.source === 'metricool' ? 'Metricool' : '직접 입력'}</span>
        {!p.mature && p.publishedAt && <span className="badge badge-warn">집계 중</span>}
        {p.source === 'manual' && (
          <span className="ins-post-actions">
            <button type="button" className="small ghost" onClick={onEdit}>
              고치기
            </button>
            <button type="button" className="small ghost" onClick={onDelete}>
              지우기
            </button>
          </span>
        )}
      </div>
      <div className="ins-post-text">
        {p.url ? (
          <a href={p.url} target="_blank" rel="noreferrer noopener">
            {clip(p.content, 80) ?? '게시물 열기'}
          </a>
        ) : (
          (clip(p.content, 80) ?? <span className="muted">글 없음</span>)
        )}
      </div>
      <div className="ins-post-set small">
        {setTitle ? (
          <>
            <span className="muted">이은 세트</span> <b>{clip(setTitle, 40)}</b>{' '}
            <button type="button" className="link small" onClick={() => onLink(null)}>
              끊기
            </button>
          </>
        ) : (
          <select aria-label="세트 잇기" value="" onChange={(e) => e.target.value && onLink(Number(e.target.value))}>
            <option value="">세트 잇기…</option>
            {sets
              .filter((x) => !x.linked)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {clip(x.title, 30)}
                </option>
              ))}
          </select>
        )}
      </div>
      <dl className="ins-stats">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}
