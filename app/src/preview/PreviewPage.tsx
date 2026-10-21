// 30일 뒤 내 계정 미리보기 (FR-BR-6 · 결정 2026-10-21). 게시물을 올리기 전에 프로필 화면을 인스타처럼 먼저 보여 준다.
// 만든 카드와 아직 만들지 않은 계획 칸을 반드시 다르게 보인다(점선 · 「계획」) — 계획을 실제로 만든 것처럼 보이게 하지 않는다.
// 격자 칸은 인스타 프로필처럼 카드의 양옆을 가린다(서버가 넘긴 render.safeArea.feed 값 그대로).
import { useCallback, useEffect, useState } from 'react';
import type { InferResponseType } from 'hono/client';
import { api } from '../api.ts';
import { useJob } from '../useJob.ts';
import { loadBrandFonts } from '../brand/loadFonts.ts';
import { PremadeBadge } from '../premade.tsx';
import { cellBox } from './grid.ts';

type View = Extract<InferResponseType<typeof api.api.preview.$get>, { cells: unknown }>;
type Cell = View['cells'][number];

export function PreviewPage() {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api.api.preview
        .$get()
        .then((r) => r.json())
        .then((b) => ('cells' in b ? setView(b) : setError('미리보기를 불러오지 못했어요.')))
        .catch((e: unknown) => setError(`불러오지 못했어요 (${String(e)}). 서버가 켜져 있는지 확인하고 새로고침하세요.`)),
    [],
  );
  useEffect(() => {
    void load();
    void loadBrandFonts();
  }, [load]);

  const { job, cancel } = useJob(
    jobId,
    (j) => {
      setJobId(null);
      if (j.phase === 'failed') setError(`${j.error?.message ?? '실패했어요.'} ${j.error?.hint ?? ''}`);
      if (j.phase === 'cancelled') setError('취소했어요. 다시 하려면 버튼을 누르세요.');
      void load();
    },
    () => setJobId(null),
  );

  const plan = async () => {
    setError(null);
    const r = await api.api.preview.plan.$post();
    setJobId((await r.json()).jobId);
  };
  const edit = async (idx: number, patch: { title?: string; locked?: boolean }) => {
    const r = await api.api.preview.plan[':idx'].$put({ param: { idx: String(idx) }, json: patch });
    if (!r.ok) {
      const b = (await r.json()) as { error?: string };
      setError(b.error ?? '저장하지 못했어요.');
      return false;
    }
    setError(null);
    await load();
    return true;
  };

  if (!view) return <section className="card">{error ?? '불러오는 중…'}</section>;
  if (!view.ready.profile) return <section className="card">먼저 「정체성」에서 프로필을 만들고 확정하세요. 미리보기는 그 프로필로 그립니다.</section>;

  const p = view.profile;
  return (
    <section className="card preview">
      <h2>30일 뒤 내 계정 미리보기</h2>
      <p className="muted small">
        게시물을 올리기 전에, 지금 정한 프로필과 첫 {view.cells.length}개 게시물 계획이 인스타 프로필에서 어떻게 보일지 먼저 봅니다. <b>실선 = 만든 카드</b>, <b>점선 = 아직 만들지 않은 계획</b>.
      </p>

      <div className="ig-profile">
        <div className="ig-head">
          <Avatar image={p.profileImage} name={p.displayName ?? p.handle} color={view.look?.primary ?? null} />
          <div>
            <div className="ig-handle">{p.handle ?? <span className="muted">(아이디 미정 — 「브랜드」에서 고르세요)</span>}</div>
            <div className="ig-counts">
              게시물 <b>{view.counts.madeShown + view.counts.plan}</b>
              <span className="muted small">
                {' '}
                (만든 카드 {view.counts.madeShown} · 계획 {view.counts.plan})
              </span>
            </div>
          </div>
        </div>
        <div className="ig-name">{p.displayName ?? <span className="muted">(이름 미정)</span>}</div>
        <div className="ig-bio pre">{p.bio ?? <span className="muted">(바이오 미정)</span>}</div>
        {view.highlights.length > 0 && (
          <div className="ig-highlights">
            {view.highlights.map((h) => (
              <div key={h} className="ig-hl">
                <span className="ig-hl-circle" title="하이라이트 커버 그림은 아직 올리지 않았어요(FR-BR-4)" />
                <span className="small">{h}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="actions">
        {!jobId ? (
          <button type="button" className="primary" disabled={!view.ready.template} onClick={() => void plan()}>
            {view.plan ? '계획 다시 만들기(고정한 칸은 그대로)' : '첫 9개 게시물 계획 만들기'}
          </button>
        ) : (
          <span>
            계획 만드는 중… {job?.runs.length ? `(${job.runs.length}번째 호출)` : ''}{' '}
            <button type="button" onClick={() => void cancel()}>
              취소
            </button>
          </span>
        )}
        <span className="muted small">AI 호출 1번(규칙에 걸리면 다시 쓰기 · 숫자·영문 이름은 프로필·답에 있는 것만)</span>
        <label className="small">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> 격자에서 가려지는 곳 보기
        </label>
      </div>
      {!view.ready.template && <p className="note small">「템플릿」에서 시안을 고정해야 계획 칸을 그 틀의 색·글자 수로 그릴 수 있어요.</p>}
      {view.plan?.stale && <p className="note small">계획을 만든 뒤 프로필이 바뀌었어요. 다시 만들면 바뀐 축으로 계획합니다.</p>}
      {error && <p className="status error">{error}</p>}

      <div className="ig-grid">
        {view.cells.map((c, i) => (
          <GridCell key={i} c={c} view={view} showHidden={showHidden} edit={edit} />
        ))}
      </div>
    </section>
  );
}

function Avatar({ image, name, color }: { image: string | null; name: string | null; color: string | null }) {
  if (image && image !== 'monogram') return <img className="ig-avatar" src={`/api/brand/assets/${image}`} alt="프로필 사진" />;
  if (image === 'monogram')
    return (
      <span className="ig-avatar ig-mono" style={{ background: color ?? '#999' }}>
        {[...(name ?? '?')][0]}
      </span>
    );
  return <span className="ig-avatar ig-empty" title="프로필 사진을 아직 고르지 않았어요" />;
}

function GridCell({ c, view, showHidden, edit }: { c: Cell; view: View; showHidden: boolean; edit: (i: number, p: { title?: string; locked?: boolean }) => Promise<boolean> }) {
  const box = cellBox(view.grid, showHidden);
  const [draft, setDraft] = useState<string | null>(null);
  if (c.kind === 'empty') return <div className="ig-cell ig-empty-cell" style={{ aspectRatio: box.aspect }} />;
  if (c.kind === 'made')
    return (
      <div className="ig-cell ig-made" style={{ aspectRatio: box.aspect }}>
        <img src={`/api/cards/sets/${c.setId}/png/01-cover.png`} alt={c.headline.replace(/\*\*/g, '')} style={{ width: `${box.imgWidthPct}%`, left: `${box.imgLeftPct}%` }} />
        {showHidden && <Hidden box={box} />}
        <span className="ig-tag">만든 카드</span>
        <PremadeBadge createdAt={c.createdAt} />
      </div>
    );
  const look = view.look;
  return (
    <div
      className="ig-cell ig-plan"
      style={{ aspectRatio: box.aspect, background: look?.background ?? '#eee', color: look?.text ?? '#222', borderColor: look?.accent ?? '#999' }}
    >
      <div className="ig-plan-title" style={{ fontFamily: view.titleFont?.family, fontWeight: view.titleFont?.weight }}>
        {c.title}
      </div>
      <div className="ig-plan-pillar small" style={{ color: look?.primary }}>
        {c.pillarName ?? '(없는 축)'}
      </div>
      {showHidden && <Hidden box={box} />}
      <span className="ig-tag ig-tag-plan">계획 · 아직 안 만듦{c.locked ? ' · 고정' : ''}{c.origin === 'edit' ? ' · 직접 고침' : ''}</span>
      {draft === null ? (
        <span className="ig-plan-actions">
          <button type="button" className="small" onClick={() => setDraft(c.title)}>
            고치기
          </button>
          <button type="button" className="small" onClick={() => void edit(c.slot, { locked: !c.locked })}>
            {c.locked ? '고정 풀기' : '고정'}
          </button>
        </span>
      ) : (
        <span className="ig-plan-edit">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="button" className="small primary" onClick={() => void edit(c.slot, { title: draft }).then((ok) => ok && setDraft(null))}>
            저장
          </button>
          <button type="button" className="small" onClick={() => setDraft(null)}>
            그만두기
          </button>
        </span>
      )}
    </div>
  );
}

/** 격자에서 가려지는 양옆 띠 */
function Hidden({ box }: { box: ReturnType<typeof cellBox> }) {
  return (
    <>
      <span className="ig-hidden" style={{ left: 0, width: `${box.hiddenPct}%` }} />
      <span className="ig-hidden" style={{ right: 0, width: `${box.hiddenPct}%` }} />
    </>
  );
}
