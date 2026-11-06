// 장면: 시작 시간 · 길이, 내 영상으로 갈아끼우기
import { useRef } from 'react';
import { FPS, fmtTime, sceneAt } from '../../../../server/src/reels/model.ts';
import { useCtx } from '../context.ts';
import { useUpload } from './FilesTab.tsx';

export function ScenesTab() {
  const c = useCtx();
  const { upload, busy, err } = useUpload();
  const pick = useRef<HTMLInputElement | null>(null);
  const target = useRef<string | null>(null);
  const now = sceneAt(c.p, c.frame);
  const scenes = [...c.p.scenes].sort((a, b) => a.start - b.start);

  const replace = async (files: File[]) => {
    const id = target.current;
    if (!id || !files[0]) return;
    const [a] = await upload([files[0]]);
    if (!a || a.kind === 'audio') return;
    c.ed.update((q) => ({ ...q, scenes: q.scenes.map((s) => (s.id === id ? { ...s, media: { src: c.media(a.file), kind: a.kind === 'video' ? 'video' : 'image', trim: 0 } } : s)) }));
  };

  return (
    <div className="tab-body">
      <input ref={pick} type="file" accept="video/*,image/*" hidden onChange={(e) => void replace([...(e.target.files ?? [])])} />
      {busy && <p className="small">올리는 중…</p>}
      {err && <p className="error small">{err}</p>}
      <ul className="scene-list">
        {scenes.map((s, i) => (
          <li key={s.id} className={now?.id === s.id || c.sel?.id === s.id ? 'on' : ''} onClick={() => {
            c.setSel({ track: 'scenes', id: s.id });
            c.seek(s.start);
          }}>
            <div>
              <span className="idx">{String(i + 1).padStart(2, '0')}</span> <b>{s.name}</b>
            </div>
            <div className="muted small mono">{fmtTime(s.start)} · {(s.duration / FPS).toFixed(1)}초{s.media ? ` · ${s.media.kind === 'video' ? '영상' : '사진'}` : ''}</div>
            <button
              className="xs"
              onClick={(e) => {
                e.stopPropagation();
                target.current = s.id;
                pick.current?.click();
              }}
            >
              ⇄ 내 영상으로
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
