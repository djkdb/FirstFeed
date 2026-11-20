// 아래 타임라인: 글자 · 위에 얹기 · 메인 · 소리 4줄. 조각 끌어 옮기기 · 양 끝 당겨 길이 바꾸기 · 자석 · 확대
import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react';
import { clipEnd, FPS, snap, splitClip, totalFrames, uid, type Clip, type ReelDoc as Project, type Track } from '../../../server/src/reels/model.ts';
import { useCtx } from './context.ts';
import { peaks, PEAKS_PER_SEC } from './waveform.ts';

const TRACKS: Array<{ key: Track; label: string }> = [
  { key: 'texts', label: '글자' },
  { key: 'overlays', label: '위에 얹기' },
  { key: 'scenes', label: '메인' },
  { key: 'audio', label: '소리' },
];
const MIN = 3; // 가장 짧은 조각(프레임)
const LANE = 30; // 겹친 조각이 들어갈 줄 하나의 높이

/** 겹치는 조각은 아래 줄로 — 앞에서부터 들어갈 수 있는 가장 위 줄에 */
export function lanesOf(list: Clip[]): Map<string, number> {
  const ends: number[] = [];
  const out = new Map<string, number>();
  for (const c of [...list].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))) {
    let lane = ends.findIndex((e) => e <= c.start);
    if (lane < 0) lane = ends.length;
    ends[lane] = clipEnd(c);
    out.set(c.id, lane);
  }
  return out;
}

export const clipsOf = (p: Project, t: Track): Clip[] => p[t] as Clip[];
const setClips = (p: Project, t: Track, list: Clip[]): Project => ({ ...p, [t]: list }) as Project;

function label(t: Track, c: Clip): string {
  if (t === 'texts') return (c as Project['texts'][number]).text;
  if (t === 'scenes') return (c as Project['scenes'][number]).name;
  if (t === 'overlays') return '그림';
  return '소리';
}

/** 조각 안에 그릴 소리: 메인은 영상의 소리, 소리 줄은 그 파일 */
/** 저장된 src 는 이미 /media/<프로젝트>/<파일> 주소다 — 다시 붙이면 404(처음에 겪음) */
function audioSrc(t: Track, c: Clip): { url: string; trim: number } | null {
  if (t === 'audio') {
    const a = c as Project['audio'][number];
    return { url: a.src, trim: a.trim };
  }
  if (t === 'scenes') {
    const s = c as Project['scenes'][number];
    if (s.media?.kind === 'video') return { url: s.media.src, trim: s.media.trim };
  }
  return null;
}

function Wave({ src, duration, pxPerFrame }: { src: { url: string; trim: number }; duration: number; pxPerFrame: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let alive = true;
    void peaks(src.url).then((pk) => {
      const cv = ref.current;
      if (!alive || !cv || !pk) return;
      const w = Math.max(1, Math.round(duration * pxPerFrame));
      cv.width = w;
      cv.height = 28;
      const g = cv.getContext('2d')!;
      g.clearRect(0, 0, w, 28);
      g.fillStyle = 'rgba(255,255,255,.55)';
      for (let x = 0; x < w; x++) {
        const f = src.trim + x / pxPerFrame;
        const v = pk[Math.floor((f / FPS) * PEAKS_PER_SEC)] ?? 0;
        const h = Math.max(1, v * 26);
        g.fillRect(x, 28 - h, 1, h);
      }
    });
    return () => {
      alive = false;
    };
  }, [src.url, src.trim, duration, pxPerFrame]);
  return <canvas ref={ref} className="wave" />;
}

export function Timeline() {
  const c = useCtx();
  const { p, ed } = c;
  const [zoom, setZoom] = useState(4); // 1프레임당 px
  const [magnet, setMagnet] = useState(true);
  const scroller = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ track: Track; id: string; mode: 'move' | 'left' | 'right'; sx: number; orig: Clip; targets: number[] } | null>(null);
  const dur = totalFrames(p);
  const width = (dur + FPS * 4) * zoom;

  const selClip = () => (c.sel ? clipsOf(p, c.sel.track).find((x) => x.id === c.sel!.id) ?? null : null);

  const split = () => {
    const s = c.sel;
    const cl = selClip();
    if (!s || !cl) return;
    const parts = splitClip(cl, c.frame);
    if (!parts) return;
    ed.update((q) => setClips(q, s.track, clipsOf(q, s.track).flatMap((x) => (x.id === cl.id ? parts : [x]))));
    c.setSel({ track: s.track, id: parts[1].id });
  };
  const remove = () => {
    const s = c.sel;
    if (!s) return;
    ed.update((q) => setClips(q, s.track, clipsOf(q, s.track).filter((x) => x.id !== s.id)));
    c.setSel(null);
  };
  const duplicate = () => {
    const s = c.sel;
    const cl = selClip();
    if (!s || !cl) return;
    const copy = { ...structuredClone(cl), id: uid(), start: clipEnd(cl) } as Clip;
    ed.update((q) => setClips(q, s.track, [...clipsOf(q, s.track), copy]));
    c.setSel({ track: s.track, id: copy.id });
  };

  // 단축키: S 자르기 · Delete 지우기 · Ctrl+D 복제 · Ctrl+Z 되돌리기 · Ctrl+Shift+Z / Ctrl+Y 다시
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) ed.redo();
        else ed.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        ed.redo();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicate();
      } else if (!mod && e.key.toLowerCase() === 's') split();
      else if (e.key === 'Delete' || e.key === 'Backspace') remove();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const startDrag = (e: RPE, track: Track, cl: Clip, mode: 'move' | 'left' | 'right') => {
    e.stopPropagation();
    c.setSel({ track, id: cl.id });
    ed.checkpoint();
    // 자석 대상: 다른 조각의 양 끝 + 재생 위치 + 0
    const targets = [0, c.frame, ...TRACKS.flatMap((t) => clipsOf(p, t.key).filter((x) => x.id !== cl.id).flatMap((x) => [x.start, clipEnd(x)]))];
    drag.current = { track, id: cl.id, mode, sx: e.clientX, orig: structuredClone(cl), targets };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPE) => {
    const d = drag.current;
    if (!d) return;
    const df = Math.round((e.clientX - d.sx) / zoom);
    const thr = magnet ? Math.round(8 / zoom) + 1 : -1;
    const o = d.orig;
    let next: Clip;
    if (d.mode === 'move') {
      let start = Math.max(0, o.start + df);
      if (magnet) {
        const s1 = snap(start, d.targets, thr);
        const s2 = snap(start + o.duration, d.targets, thr) - o.duration;
        start = Math.abs(s1 - start) <= Math.abs(s2 - start) ? s1 : s2;
      }
      next = { ...o, start: Math.max(0, start) };
    } else if (d.mode === 'right') {
      let end = Math.max(o.start + MIN, clipEnd(o) + df);
      if (magnet) end = Math.max(o.start + MIN, snap(end, d.targets, thr));
      next = { ...o, duration: end - o.start };
    } else {
      let start = Math.min(clipEnd(o) - MIN, Math.max(0, o.start + df));
      if (magnet) start = Math.min(clipEnd(o) - MIN, snap(start, d.targets, thr));
      // 왼쪽 끝을 당기면 영상 · 소리의 시작 지점(trim)도 같이 옮긴다
      const shift = start - o.start;
      const n = { ...structuredClone(o), start, duration: clipEnd(o) - start } as Clip & { trim?: number; media?: { trim: number } | null };
      if (typeof n.trim === 'number') n.trim = Math.max(0, n.trim + shift);
      if (n.media) n.media.trim = Math.max(0, n.media.trim + shift);
      next = n;
    }
    ed.update((q) => setClips(q, d.track, clipsOf(q, d.track).map((x) => (x.id === d.id ? next : x))), false);
  };
  const endDrag = () => {
    drag.current = null;
  };

  const seekFromX = (clientX: number) => {
    const el = scroller.current;
    if (!el) return;
    const x = clientX - el.getBoundingClientRect().left + el.scrollLeft - 72;
    c.seek(Math.max(0, Math.min(dur - 1, Math.round(x / zoom))));
  };
  const scrub = useRef(false);

  return (
    <div className="timeline" onPointerMove={onMove} onPointerUp={endDrag}>
      <div className="tl-tools">
        <button onClick={ed.undo} disabled={!ed.canUndo} title="Ctrl+Z">↶ 되돌리기</button>
        <button onClick={ed.redo} disabled={!ed.canRedo} title="Ctrl+Shift+Z">↷</button>
        <button onClick={split} disabled={!c.sel} title="S">✂ 자르기</button>
        <button onClick={remove} disabled={!c.sel} title="Delete">🗑 지우기</button>
        <button onClick={duplicate} disabled={!c.sel} title="Ctrl+D">⧉ 복제</button>
        <span className="grow" />
        <label className="check">
          <input type="checkbox" checked={magnet} onChange={(e) => setMagnet(e.target.checked)} /> 자석
        </label>
        <span className="muted">확대</span>
        <input type="range" min={1} max={16} step={0.5} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
      </div>
      <div
        className="tl-scroll"
        ref={scroller}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom((z) => Math.min(16, Math.max(1, z * (e.deltaY < 0 ? 1.15 : 0.87))));
          }
        }}
      >
        <div className="tl-inner" style={{ width: width + 72 }}>
          <div
            className="ruler"
            onPointerDown={(e) => {
              scrub.current = true;
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              seekFromX(e.clientX);
            }}
            onPointerMove={(e) => scrub.current && seekFromX(e.clientX)}
            onPointerUp={() => (scrub.current = false)}
          >
            {Array.from({ length: Math.ceil(width / zoom / FPS) }, (_, s) =>
              s % (zoom < 2 ? 4 : 2) === 0 ? (
                <span key={s} className="tick" style={{ left: 72 + s * FPS * zoom }}>
                  {String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}
                </span>
              ) : null,
            )}
          </div>
          {TRACKS.map((t) => {
            const lanes = lanesOf(clipsOf(p, t.key));
            const n = Math.max(1, ...[...lanes.values()].map((x) => x + 1));
            const tall = t.key === 'scenes' || t.key === 'audio';
            return (
            <div key={t.key} className={`track track-${t.key}`} style={{ height: tall ? Math.max(54, n * 46) : Math.max(40, n * LANE + 8) }}>
              <div className="track-label">{t.label}</div>
              <div className="track-lane" onPointerDown={() => c.setSel(null)}>
                {clipsOf(p, t.key).map((cl) => {
                  const on = c.sel?.id === cl.id;
                  const a = audioSrc(t.key, cl);
                  return (
                    <div key={cl.id} className={`clip clip-${t.key}${on ? ' on' : ''}`} style={{ left: cl.start * zoom, width: Math.max(4, cl.duration * zoom), top: 4 + (lanes.get(cl.id) ?? 0) * (tall ? 46 : LANE), height: (tall ? 46 : LANE) - 4 }} onPointerDown={(e) => startDrag(e, t.key, cl, 'move')} title={label(t.key, cl)}>
                      <div className="edge left" onPointerDown={(e) => startDrag(e, t.key, cl, 'left')} />
                      <span className="clip-label">{label(t.key, cl)}</span>
                      {a && <Wave src={a} duration={cl.duration} pxPerFrame={zoom} />}
                      <div className="edge right" onPointerDown={(e) => startDrag(e, t.key, cl, 'right')} />
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
          <div className="playhead" style={{ left: 72 + c.frame * zoom }} />
        </div>
      </div>
    </div>
  );
}
