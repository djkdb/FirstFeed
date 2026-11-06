// 릴스 편집 화면 (결정 2026-11-06 · 편집 화면 녹이기): 위 막대 · 왼쪽 탭 · 가운데 편집 화면 + 완성 미리보기 · 오른쪽 속성 · 아래 타임라인.
// 색 · 글꼴은 브랜딩 키트에서, 화면 자체는 앱의 흰 바탕 · 무채색(색은 영상 안에만)
import type { PlayerRef } from '@remotion/player';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Box, ReelBrand } from '../../../server/src/reels/model.ts';
import { reelApi } from './api.ts';
import { EditorCtx, type Ctx, type Sel } from './context.ts';
import { Inspector } from './Inspector.tsx';
import { outsideItems } from './outside.ts';
import { BgTab } from './panels/BgTab.tsx';
import { FilesTab } from './panels/FilesTab.tsx';
import { ScenesTab } from './panels/ScenesTab.tsx';
import { TextTab } from './panels/TextTab.tsx';
import { Stage } from './Stage.tsx';
import { useReelEditor } from './store.ts';
import { Timeline } from './Timeline.tsx';
import './reels.css';

type Tab = 'files' | 'text' | 'scenes' | 'bg';
const TABS: Array<[Tab, string]> = [
  ['files', '내 파일'],
  ['text', '글자'],
  ['scenes', '장면'],
  ['bg', '배경'],
];
const LAST = 'firstfeed.reels.last';
/** 릴스가 하나도 없을 때 처음 하나 만들기 — 개발 모드는 첫 효과를 두 번 돌려서 두 개가 생겼다(화면 확인 2026-11-06). 한 번만 부르게 */
let creatingFirst: ReturnType<typeof reelApi.create> | null = null;

interface PageState {
  reels: Array<{ id: number; name: string }>;
  brand: ReelBrand & { ready: boolean };
  guide: Box;
  fonts: Array<{ id: string; name: string }>;
  whisper: boolean;
  browser: boolean;
}

type Job = { id: string; phase: string; progress: number; file: string | null; error: string | null; hint: string | null; lufs: number | null; seconds: number | null };

function RenderButton({ reelId, browser }: { reelId: number; browser: boolean }) {
  const [quality, setQuality] = useState<'720' | '1080' | '4k'>('1080');
  const [job, setJob] = useState<Job | null>(null);
  useEffect(() => {
    if (!job || ['done', 'failed', 'cancelled'].includes(job.phase)) return;
    const t = setInterval(() => {
      reelApi
        .job(job.id)
        .then((j) => setJob({ id: job.id, ...j }))
        .catch((e: unknown) => setJob({ ...job, phase: 'failed', error: String(e) }));
    }, 800);
    return () => clearInterval(t);
  }, [job]);
  const running = job && !['done', 'failed', 'cancelled'].includes(job.phase);
  return (
    <div className="render">
      <select value={quality} onChange={(e) => setQuality(e.target.value as typeof quality)} disabled={!!running}>
        <option value="720">720 (빠름)</option>
        <option value="1080">1080</option>
        <option value="4k">4K (느림)</option>
      </select>
      {running ? (
        <>
          <span className="small">{job.phase === 'bundling' ? '준비 중…' : job.phase === 'loudness' ? '음량 맞추는 중…' : `뽑는 중 ${Math.round(job.progress * 100)}%`}</span>
          <button className="small" onClick={() => void reelApi.cancel(job.id)}>취소</button>
        </>
      ) : (
        <button
          className="primary"
          disabled={!browser}
          title={browser ? '' : '영상을 찍을 브라우저가 없어요 — 터미널에서 npx playwright install chromium'}
          onClick={() =>
            void reelApi
              .render(reelId, quality)
              .then((r) => setJob({ id: r.jobId, phase: 'bundling', progress: 0, file: null, error: null, hint: null, lufs: null, seconds: null }))
              .catch((e: unknown) => setJob({ id: '', phase: 'failed', progress: 0, file: null, error: String(e), hint: null, lufs: null, seconds: null }))
          }
        >
          영상 뽑기
        </button>
      )}
      {job?.phase === 'done' && job.file && (
        <>
          <a className="button small" href={`/api/reels/${reelId}/renders/${encodeURIComponent(job.file)}`}>
            ⬇ 받기
          </a>
          <span className="small muted">{job.seconds?.toFixed(1)}초 · {job.lufs != null ? `음량 ${job.lufs.toFixed(1)} LUFS` : '음량 맞춤 없음(소리 없음 · ffmpeg 없음)'}</span>
        </>
      )}
      {job?.phase === 'failed' && (
        <span className="status error small" title={job.error ?? ''}>
          뽑지 못했어요: {job.error?.slice(0, 80)} {job.hint}
        </span>
      )}
    </div>
  );
}

export function ReelsPage() {
  const ed = useReelEditor();
  const [page, setPage] = useState<PageState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('text');
  const [frame, setFrame] = useState(0);
  const [sel, setSel] = useState<Sel | null>(null);
  const [scope, setScope] = useState<'one' | 'all'>('one');
  const [guideOn, setGuideOn] = useState(true);
  const [measured] = useState(() => new Map<string, { sig: string; box: Box }>());
  const editRef = useRef<PlayerRef | null>(null);
  const outRef = useRef<PlayerRef | null>(null);

  const load = ed.load;
  const open = useCallback(
    (id: number) => {
      setSel(null);
      measured.clear();
      void reelApi
        .get(id)
        .then((r) => load(r.id, r.doc))
        .catch((e: unknown) => setErr(String(e)));
      try {
        localStorage.setItem(LAST, String(id));
      } catch {
        /* 기억 못 해도 동작 */
      }
    },
    [load, measured],
  );

  useEffect(() => {
    reelApi
      .state()
      .then(async (s) => {
        setPage(s as PageState);
        if (!s.reels.length) {
          const r = await (creatingFirst ??= reelApi.create('첫 릴스'));
          setPage({ ...(s as PageState), reels: [{ id: r.id, name: r.name }] });
          ed.load(r.id, r.doc);
          return;
        }
        let last: number | null = null;
        try {
          last = Number(localStorage.getItem(LAST));
        } catch {
          /* 없음 */
        }
        open(s.reels.find((x) => x.id === last)?.id ?? s.reels[0]!.id);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seek = useCallback((f: number) => {
    setFrame(f);
    outRef.current?.seekTo(f);
    editRef.current?.seekTo(f);
  }, []);

  const doc = ed.doc;
  const reelId = ed.reelId;
  const ctx: Ctx | null = useMemo(
    () =>
      doc && reelId != null && page
        ? { ed, p: doc, reelId, brand: page.brand, guide: page.guide, fonts: page.fonts, whisper: page.whisper, frame, seek, sel, setSel, scope, setScope, measured, guideOn, media: (f: string) => `/api/reels/${reelId}/media/${f}` }
        : null,
    [ed, doc, reelId, page, frame, seek, sel, scope, measured, guideOn],
  );

  if (err) return <section className="card"><p className="status error">릴스를 불러오지 못했어요: {err}</p></section>;
  // ctx 가 아니라 원재료로 판정 — 린트(react-hooks/refs)가 재생 위치를 옮기는 함수(ref 를 씀)가 든 ctx 를 ref 처럼 본다
  if (!page || !doc || reelId == null) return <section className="card"><p className="muted">불러오는 중…</p></section>;
  const outside = outsideItems(doc, page.guide, measured);

  return (
    <EditorCtx.Provider value={ctx!}>
      <div className="reels">
        <header className="reels-top">
          <select value={reelId} onChange={(e) => open(Number(e.target.value))}>
            {page.reels.map((x) => (
              <option key={x.id} value={x.id}>{x.id === reelId ? doc.name : x.name}</option>
            ))}
          </select>
          <button
            className="small"
            onClick={() => {
              const name = prompt('새 릴스 이름', '새 릴스');
              if (!name) return;
              void reelApi.create(name).then((r) => {
                setPage((pg) => (pg ? { ...pg, reels: [{ id: r.id, name: r.name }, ...pg.reels] } : pg));
                ed.load(r.id, r.doc);
              });
            }}
          >
            + 새 릴스
          </button>
          <input className="name" value={doc.name} aria-label="릴스 이름" onFocus={() => ed.checkpoint()} onChange={(e) => ed.update((q) => ({ ...q, name: e.target.value }), false)} />
          <span className={`save ${ed.saveState}`} title={ed.saveError ?? ''}>{ed.saveState === 'saved' ? '저장됨' : ed.saveState === 'saving' ? '저장 중…' : `저장 실패 ${ed.saveError ?? ''}`}</span>
          <span className="grow" />
          {outside.length > 0 && (
            <button className="warn small" title={outside.map((o) => o.label).join('\n')} onClick={() => setSel({ track: doc.texts.some((t) => t.id === outside[0]!.id) ? 'texts' : 'overlays', id: outside[0]!.id })}>
              ⚠ 격자 밖 {outside.length}개
            </button>
          )}
          <label className="check small">
            <input type="checkbox" checked={guideOn} onChange={(e) => setGuideOn(e.target.checked)} /> 가이드
          </label>
          <RenderButton key={reelId} reelId={reelId} browser={page.browser} />
        </header>
        {!page.brand.ready && <p className="note">브랜딩 키트에서 색을 아직 고르지 않아 중립 색으로 보여요. 「브랜드」에서 팔레트 · 글꼴을 고르면 릴스 색 · 글꼴이 따라 바뀌어요.</p>}
        {!page.browser && <p className="note error">영상을 찍을 브라우저가 없어요. 터미널에서 <code>npx playwright install chromium</code> 을 실행한 뒤 다시 여세요(앱은 브라우저를 내려받지 않아요).</p>}
        <div className="reels-grid">
          <aside className="reels-left">
            <nav className="reels-tabs">
              {TABS.map(([k, l]) => (
                <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
              ))}
            </nav>
            {tab === 'files' && <FilesTab />}
            {tab === 'text' && <TextTab />}
            {tab === 'scenes' && <ScenesTab />}
            {tab === 'bg' && <BgTab />}
          </aside>
          <div className="reels-center">
            <Stage editRef={editRef} outRef={outRef} onFrame={setFrame} />
          </div>
          <Inspector />
          <div className="reels-bottom">
            <Timeline />
          </div>
        </div>
      </div>
    </EditorCtx.Provider>
  );
}
