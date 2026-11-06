// 가운데: 왼쪽 편집 화면(가이드 박스 · 글자 끌기) + 오른쪽 완성 미리보기. 둘 다 같은 컴포지션(remotion/Reel.tsx)
import { Player, type PlayerRef } from '@remotion/player';
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPE } from 'react';
import { FPS, H, W, totalFrames, type Box } from '../../../server/src/reels/model.ts';
import { Reel, type ReelProps } from './video/Reel.tsx';
import { textTargets, useCtx } from './context.ts';
import { textSig } from './outside.ts';

export function Stage({ editRef, outRef, onFrame }: { editRef: React.RefObject<PlayerRef | null>; outRef: React.RefObject<PlayerRef | null>; onFrame: (f: number) => void }) {
  const c = useCtx();
  const { p } = c;
  const dur = totalFrames(p);
  const wrap = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.3);
  const [playing, setPlaying] = useState(false);
  const drag = useRef<{ ids: Set<string>; kind: 'text' | 'overlay'; sx: number; sy: number; orig: Map<string, { x: number; y: number }> } | null>(null);

  // 화면 크기에 맞춰 배율 — 두 화면이 같은 크기
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 완성 미리보기가 기준, 편집 화면은 따라간다(편집 화면은 소리 끔)
  useEffect(() => {
    const o = outRef.current;
    if (!o) return;
    const onF = (e: { detail: { frame: number } }) => onFrame(e.detail.frame);
    const onPlay = () => {
      setPlaying(true);
      editRef.current?.play();
    };
    const onPause = () => {
      setPlaying(false);
      editRef.current?.pause();
      editRef.current?.seekTo(o.getCurrentFrame());
    };
    o.addEventListener('frameupdate', onF);
    o.addEventListener('play', onPlay);
    o.addEventListener('pause', onPause);
    return () => {
      o.removeEventListener('frameupdate', onF);
      o.removeEventListener('play', onPlay);
      o.removeEventListener('pause', onPause);
    };
  }, [outRef, editRef, onFrame]);

  // 지금 보이는 글자의 실제 상자를 재 둔다(박스 밖 경고가 어림 대신 쓰게)
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const base = el.getBoundingClientRect();
    el.querySelectorAll<HTMLElement>('[data-text-id]').forEach((n) => {
      const t = p.texts.find((x) => x.id === n.dataset.textId);
      if (!t) return;
      const r = n.getBoundingClientRect();
      const box: Box = { x: (r.left - base.left) / scale, y: (r.top - base.top) / scale, w: r.width / scale, h: r.height / scale };
      c.measured.set(t.id, { sig: textSig(t), box });
    });
  });

  const down = (e: RPE<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const tEl = target.closest<HTMLElement>('[data-text-id]');
    const oEl = target.closest<HTMLElement>('[data-clip-id]');
    if (tEl?.dataset.textId) {
      const id = tEl.dataset.textId;
      c.setSel({ track: 'texts', id });
      const ids = textTargets(c, id);
      c.ed.checkpoint();
      drag.current = { ids, kind: 'text', sx: e.clientX, sy: e.clientY, orig: new Map(p.texts.filter((t) => ids.has(t.id)).map((t) => [t.id, { x: t.style.x, y: t.style.y }])) };
    } else if (oEl?.dataset.clipId) {
      const id = oEl.dataset.clipId;
      c.setSel({ track: 'overlays', id });
      c.ed.checkpoint();
      const o = p.overlays.find((x) => x.id === id)!;
      drag.current = { ids: new Set([id]), kind: 'overlay', sx: e.clientX, sy: e.clientY, orig: new Map([[id, { x: o.x, y: o.y }]]) };
    } else return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const move = (e: RPE<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = Math.round((e.clientX - d.sx) / scale);
    const dy = Math.round((e.clientY - d.sy) / scale);
    c.ed.update(
      (q) =>
        d.kind === 'text'
          ? { ...q, texts: q.texts.map((t) => (d.ids.has(t.id) ? { ...t, style: { ...t.style, x: d.orig.get(t.id)!.x + dx, y: d.orig.get(t.id)!.y + dy } } : t)) }
          : { ...q, overlays: q.overlays.map((o) => (d.ids.has(o.id) ? { ...o, x: d.orig.get(o.id)!.x + dx, y: d.orig.get(o.id)!.y + dy } : o)) },
      false,
    );
  };
  const up = () => {
    drag.current = null;
  };

  const editProps: ReelProps = { doc: p, brand: c.brand, guide: c.guide, mediaBase: '', edit: { guide: c.guideOn, selected: c.sel?.id ?? null } };
  const outProps: ReelProps = { doc: p, brand: c.brand, guide: c.guide, mediaBase: '' };
  const selText = c.sel?.track === 'texts' ? p.texts.find((t) => t.id === c.sel!.id) : null;

  return (
    <div className="stage">
      <div className="stage-views">
        <div className="view">
          <div className="view-label">편집 화면{c.guideOn ? ' · 가이드 박스' : ''}</div>
          <div className="frame" ref={wrap} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            <Player ref={editRef} component={Reel} inputProps={editProps} durationInFrames={dur} fps={FPS} compositionWidth={W} compositionHeight={H} style={{ width: '100%' }} initiallyMuted acknowledgeRemotionLicense />
            {selText && c.scope === 'all' && selText.subtitle && <div className="scope-pill">위치 · 자막 전체에 같이 적용</div>}
          </div>
        </div>
        <div className="view">
          <div className="view-label">완성 미리보기</div>
          <div className="frame">
            <Player ref={outRef} component={Reel} inputProps={outProps} durationInFrames={dur} fps={FPS} compositionWidth={W} compositionHeight={H} style={{ width: '100%' }} acknowledgeRemotionLicense />
          </div>
        </div>
      </div>
      <div className="transport">
        <button title="처음으로" onClick={() => c.seek(0)}>⏮</button>
        <button title="한 프레임 뒤로" onClick={() => c.seek(Math.max(0, c.frame - 1))}>◀</button>
        <button className="primary" onClick={() => (playing ? outRef.current?.pause() : outRef.current?.play())}>{playing ? '❚❚ 멈춤' : '▶ 재생'}</button>
        <button title="한 프레임 앞으로" onClick={() => c.seek(Math.min(dur - 1, c.frame + 1))}>▶</button>
        <span className="mono">{(c.frame / FPS).toFixed(1)}s / {(dur / FPS).toFixed(1)}s</span>
      </div>
    </div>
  );
}
