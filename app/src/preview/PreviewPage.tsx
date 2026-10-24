// 30일 뒤 내 계정 미리보기 (FR-BR-6 · 결정 2026-10-21). 게시물을 올리기 전에 프로필 화면을 인스타처럼 먼저 보여 준다.
// 계획 칸도 고정 템플릿 표지로 그려 보자마자 완성된 계정처럼 보이게 하되(devlog 2026-10-22-02), 계획 칸에는 반드시 「계획」 배지를
// 붙이고 게시물 수도 나눠 보인다 — 계획을 실제로 만든 것처럼 보이게 하지 않는다. 표지가 틀에 안 들어가면 그 칸만 자리표시와 이유.
// 격자 칸은 인스타 프로필처럼 카드의 양옆을 가린다(서버가 넘긴 render.safeArea.feed 값 그대로).
// 처음 들어오거나 계획을 새로 만들면 바이오가 타이핑되고 9칸이 왼쪽 위부터 뒤집히며 채워진다(CSS 만 · 움직임 줄이기 설정이면 끔).
import { useCallback, useEffect, useState } from 'react';
import type { InferResponseType } from 'hono/client';
import { api } from '../api.ts';
import { useJob } from '../useJob.ts';
import { loadBrandFonts } from '../brand/loadFonts.ts';
import { PremadeBadge } from '../premade.tsx';
import { badgeFor, cellBox, FLIP_DURATION_S, flipDelay } from './grid.ts';
import { StageLine } from '../StageLine.tsx';

type View = Extract<InferResponseType<typeof api.api.preview.$get>, { cells: unknown }>;
type Cell = View['cells'][number];
type Cover = { ok: true; file: string } | { ok: false; reason: string };

export function PreviewPage() {
  const [view, setView] = useState<View | null>(null);
  const [covers, setCovers] = useState<Record<number, Cover> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  /** 바뀌면 모션을 처음부터 다시 — 「다시 보기」 · 새 계획 */
  const [play, setPlay] = useState(0);
  const [saving, setSaving] = useState(false);

  // 공유 이미지(FR-BR-7): 서버가 스토리 크기 PNG 로 그린다. 계획 칸 배지는 그대로 남는다(결정 2026-10-24)
  const saveImage = () => {
    setSaving(true);
    setError(null);
    fetch('/api/preview/share.png')
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? '이미지를 만들지 못했어요.');
        const url = URL.createObjectURL(await r.blob());
        const a = document.createElement('a');
        a.href = url;
        a.download = '퍼스트피드-30일-미리보기.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false));
  };

  // 계획 칸 표지를 차례로 물어 다 모이면 한꺼번에 보인다(그 뒤 모션). 이미 그린 칸은 서버가 바로 돌려준다
  const loadCovers = useCallback(async (v: View) => {
    const out: Record<number, Cover> = {};
    for (const c of v.cells) {
      if (c.kind !== 'plan') continue;
      const r = await api.api.preview.plan[':idx'].cover.$get({ param: { idx: String(c.slot) } });
      out[c.slot] = (await r.json()) as Cover;
    }
    return out;
  }, []);

  const load = useCallback(
    (replay: boolean) =>
      api.api.preview
        .$get()
        .then((r) => r.json())
        .then(async (b) => {
          if (!('cells' in b)) return setError('미리보기를 불러오지 못했어요.');
          setView(b);
          setCovers(await loadCovers(b));
          if (replay) setPlay((n) => n + 1);
        })
        .catch((e: unknown) => setError(`불러오지 못했어요 (${String(e)}). 서버가 켜져 있는지 확인하고 새로고침하세요.`)),
    [loadCovers],
  );
  useEffect(() => {
    void load(false);
    void loadBrandFonts();
  }, [load]);

  const { job, cancel } = useJob(
    jobId,
    (j) => {
      setJobId(null);
      if (j.phase === 'failed') setError(`${j.error?.message ?? '실패했어요.'} ${j.error?.hint ?? ''}`);
      if (j.phase === 'cancelled') setError('취소했어요. 다시 하려면 버튼을 누르세요.');
      void load(j.phase === 'done');
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
    await load(false); // 고친 칸만 새로 그려진다(나머지는 서버가 그린 것을 다시 쓴다)
    return true;
  };

  if (!view) return <section className="card">{error ?? '불러오는 중…'}</section>;
  if (!view.ready.profile) return <section className="card">먼저 「정체성」에서 프로필을 만들고 확정하세요. 미리보기는 그 프로필로 그립니다.</section>;

  const p = view.profile;
  const bioLines = (p.bio ?? '').split('\n');
  return (
    <section className="card preview">
      <h2>30일 뒤 내 계정 미리보기</h2>
      <p className="muted small">
        게시물을 올리기 전에, 지금 정한 프로필과 첫 {view.cells.length}개 게시물이 인스타 프로필에서 어떻게 보일지 먼저 봅니다. <b>「계획」 배지 = 아직 만들지 않은 칸</b>(제목을 고정 템플릿 표지로 그려 본 것).
      </p>

      <div className="ig-profile" key={`p${play}`}>
        <div className="ig-head">
          <Avatar image={p.profileImage} />
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
        <div className="ig-bio">
          {p.bio
            ? bioLines.map((line, i) => (
                <span
                  key={i}
                  className="ig-type"
                  style={{ ['--n' as string]: Math.max(1, [...line].length), ['--d' as string]: `${bioLines.slice(0, i).reduce((s, l) => s + [...l].length, 0) * 0.02}s` }}
                >
                  {line || ' '}
                </span>
              ))
            : <span className="muted">(바이오 미정)</span>}
        </div>
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
        <button type="button" onClick={() => setPlay((n) => n + 1)}>
          다시 보기
        </button>
        <button type="button" disabled={saving || covers === null} onClick={saveImage} title="스토리 크기(1080×1920) PNG — 계획 칸의 「계획」 배지는 그대로 남아요">
          {saving ? '이미지 만드는 중…' : '이미지로 저장'}
        </button>
        <label className="small">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> 격자에서 가려지는 곳 보기
        </label>
      </div>
      {jobId && <StageLine stage={job?.stage} />}
      <p className="muted small">계획 AI 호출 1번(규칙에 걸리면 다시 쓰기 · 숫자·영문 이름은 프로필·답에 있는 것만) · 표지 그리기는 AI 를 부르지 않아요</p>
      {!view.ready.template && <p className="note small">「템플릿」에서 시안을 고정해야 계획 칸을 그 틀의 표지로 그릴 수 있어요.</p>}
      {view.plan?.stale && <p className="note small">계획을 만든 뒤 프로필이 바뀌었어요. 다시 만들면 바뀐 축으로 계획합니다.</p>}
      {error && <p className="status error">{error}</p>}

      {covers === null ? (
        <p className="muted small">계획 칸 표지를 그리는 중… (처음엔 칸마다 1초 안팎)</p>
      ) : (
        <div className="ig-grid ig-anim" key={`g${play}`}>
          {view.cells.map((c, i) => (
            <GridCell key={i} i={i} c={c} cover={c.kind === 'plan' ? (covers[c.slot] ?? null) : null} view={view} showHidden={showHidden} edit={edit} />
          ))}
        </div>
      )}
    </section>
  );
}

/** 프로필 사진: 올린 파일(「브랜드」의 글자형 시안도 그림으로 올라간다)이 있으면 그것, 없으면 빈 원 */
function Avatar({ image }: { image: string | null }) {
  if (image) return <img className="ig-avatar" src={`/api/brand/assets/${image}`} alt="프로필 사진" />;
  return <span className="ig-avatar ig-empty" title="프로필 사진을 아직 고르지 않았어요" />;
}

function GridCell({
  i,
  c,
  cover,
  view,
  showHidden,
  edit,
}: {
  i: number;
  c: Cell;
  cover: Cover | null;
  view: View;
  showHidden: boolean;
  edit: (i: number, p: { title?: string; locked?: boolean }) => Promise<boolean>;
}) {
  const box = cellBox(view.grid, showHidden);
  const [draft, setDraft] = useState<string | null>(null);
  const anim = { animationDelay: `${flipDelay(i)}s`, animationDuration: `${FLIP_DURATION_S}s` };
  const badge = badgeFor(c);
  if (c.kind === 'empty') return <div className="ig-cell ig-empty-cell" style={{ aspectRatio: box.aspect, ...anim }} />;
  const img = (src: string, alt: string) => (
    <img src={src} alt={alt} style={{ width: `${box.imgWidthPct}%`, left: `${box.imgLeftPct}%` }} />
  );
  if (c.kind === 'made')
    return (
      <div className="ig-cell ig-made" style={{ aspectRatio: box.aspect, ...anim }}>
        {img(`/api/cards/sets/${c.setId}/png/01-cover.png`, c.headline.replace(/\*\*/g, ''))}
        {showHidden && <Hidden box={box} />}
        <PremadeBadge createdAt={c.createdAt} />
      </div>
    );
  const look = view.look;
  const drawn = cover?.ok ? cover.file : null;
  return (
    <div
      className={drawn ? 'ig-cell ig-made ig-planned' : 'ig-cell ig-plan'}
      style={{ aspectRatio: box.aspect, ...anim, ...(drawn ? {} : { background: look?.background ?? '#eee', color: look?.text ?? '#222', borderColor: look?.accent ?? '#999' }) }}
    >
      {drawn ? (
        img(`/api/preview/png/${drawn}`, c.title)
      ) : (
        <>
          <div className="ig-plan-title" style={{ fontFamily: view.titleFont?.family, fontWeight: view.titleFont?.weight }}>
            {c.title}
          </div>
          <div className="ig-plan-pillar small" style={{ color: look?.primary }}>
            {c.pillarName ?? '(없는 축)'}
          </div>
          {cover && !cover.ok && <div className="ig-plan-reason">표지로 못 그림: {cover.reason}</div>}
        </>
      )}
      {showHidden && <Hidden box={box} />}
      {badge && (
        <span className="ig-badge" title={`아직 만들지 않은 계획 칸${c.locked ? ' · 고정' : ''}${c.origin === 'edit' ? ' · 직접 고침' : ''}`}>
          {badge}
          {c.locked ? ' · 고정' : ''}
        </span>
      )}
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
