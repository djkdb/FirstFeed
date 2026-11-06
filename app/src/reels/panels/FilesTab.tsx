// 내 파일: 영상 · 사진 · 음악 올리기(누르기 · 끌어 놓기 · Ctrl+V). 올린 파일은 복사본으로만 쓴다
import { useEffect, useState } from 'react';
import { clipEnd, FPS, totalFrames, uid, type Asset } from '../../../../server/src/reels/model.ts';
import { reelApi as api } from '../api.ts';
import { useCtx } from '../context.ts';

export function useUpload() {
  const c = useCtx();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const upload = async (files: File[]): Promise<Asset[]> => {
    setBusy(true);
    setErr(null);
    const done: Asset[] = [];
    try {
      for (const f of files) done.push(await api.upload(c.reelId, f));
      c.ed.update((q) => ({ ...q, assets: [...q.assets.filter((a) => !done.some((d) => d.file === a.file)), ...done] }), false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
    return done;
  };
  return { upload, busy, err };
}

export function FilesTab() {
  const c = useCtx();
  const { upload, busy, err } = useUpload();
  const [over, setOver] = useState(false);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) void upload(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  /** 「원본 지우기」(0-16) — 얼굴이 나오는 원본을 다 쓴 뒤 지울 수 있게. 이 파일을 쓰는 장면 · 얹기 · 소리도 같이 뺀다 */
  const removeOriginal = async (file: string) => {
    if (!confirm('이 파일을 이 컴퓨터에서 지울까요? 이 파일을 쓰는 장면 · 얹은 그림 · 소리도 빠져요.')) return;
    await api.removeMedia(c.reelId, file);
    const uses = (src: string) => src.endsWith(`/${file}`);
    c.ed.update((q) => ({
      ...q,
      assets: q.assets.filter((x) => x.file !== file),
      scenes: q.scenes.map((s) => (s.media && uses(s.media.src) ? { ...s, media: null } : s)),
      overlays: q.overlays.filter((o) => !uses(o.src)),
      audio: q.audio.filter((x) => !uses(x.src)),
    }));
  };
  const lenOf = (a: Asset) => (a.seconds ? Math.max(1, Math.round(a.seconds * FPS)) : FPS * 3);
  const addMain = (a: Asset) =>
    c.ed.update((q) => {
      const start = q.scenes.reduce((m, s) => Math.max(m, clipEnd(s)), 0);
      return { ...q, scenes: [...q.scenes, { id: uid(), name: a.name.replace(/\.[^.]+$/, '').slice(0, 20), start, duration: lenOf(a), media: { src: c.media(a.file), kind: a.kind === 'video' ? 'video' : 'image', trim: 0 }, bg: null }] };
    });
  const addOverlay = (a: Asset) => c.ed.update((q) => ({ ...q, overlays: [...q.overlays, { id: uid(), start: c.frame, duration: Math.min(lenOf(a), FPS * 4), src: c.media(a.file), kind: a.kind === 'video' ? 'video' : 'image', trim: 0, x: 240, y: 560, w: 600, h: 600 }] }));
  const addAudio = (a: Asset) => c.ed.update((q) => ({ ...q, audio: [...q.audio, { id: uid(), start: c.frame, duration: a.seconds ? lenOf(a) : totalFrames(q), src: c.media(a.file), trim: 0, volume: 1 }] }));

  return (
    <div className="tab-body">
      <label
        className={`drop${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void upload([...e.dataTransfer.files]);
        }}
      >
        <input type="file" multiple accept="video/*,image/*,audio/*" hidden onChange={(e) => void upload([...(e.target.files ?? [])])} />
        <b>+ 영상 · 사진 · 음악 올리기</b>
        <span>눌러서 고르거나 끌어 놓기, Ctrl+V</span>
      </label>
      <p className="muted small">올린 파일은 원본 그대로 복사해 쓰고, 원본은 건드리지 않아요.</p>
      {busy && <p className="small">올리는 중…</p>}
      {err && <p className="error small">{err}</p>}
      <ul className="assets">
        {c.p.assets.map((a) => (
          <li key={a.file}>
            <div className="asset-thumb">
              {a.kind === 'image' && <img src={c.media(a.file)} alt="" />}
              {a.kind === 'video' && <video src={c.media(a.file)} muted preload="metadata" />}
              {a.kind === 'audio' && <span>♪</span>}
            </div>
            <div className="asset-info">
              <div className="ellipsis">{a.name}</div>
              <div className="muted small">{a.kind === 'video' ? '영상' : a.kind === 'image' ? '사진' : '소리'}{a.seconds ? ` · ${a.seconds.toFixed(1)}초` : ''}</div>
              <div className="row">
                {a.kind !== 'audio' && <button className="xs" onClick={() => addMain(a)}>메인에</button>}
                {a.kind !== 'audio' && <button className="xs" onClick={() => addOverlay(a)}>위에 얹기</button>}
                {a.kind !== 'image' && <button className="xs" onClick={() => addAudio(a)}>소리에</button>}
                <button className="xs" title="이 컴퓨터에서 파일을 지우고, 이 파일을 쓰는 조각도 빼요" onClick={() => void removeOriginal(a.file)}>원본 지우기</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
