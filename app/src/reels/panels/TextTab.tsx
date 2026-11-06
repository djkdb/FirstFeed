// 글자: 스타일 단추 · 음성 받아쓰기로 자막 · 대본 붙여넣어 한꺼번에 · 시간별 자막 목록
import { useState } from 'react';
import { clipEnd, defaultTextStyle, FPS, fmtTime, scriptToSubtitles, STYLE_PRESETS, totalFrames, uid, type Preset, type TextStyle } from '../../../../server/src/reels/model.ts';
import { reelApi as api } from '../api.ts';
import { textTargets, useCtx } from '../context.ts';

export function TextTab() {
  const c = useCtx();
  const { p } = c;
  const [script, setScript] = useState<string | null>(null);
  const [replace, setReplace] = useState(true);
  const [stt, setStt] = useState<{ busy: boolean; err: string | null }>({ busy: false, err: null });
  const sorted = [...p.texts].sort((a, b) => a.start - b.start);
  const subStyle = (): TextStyle => p.texts.find((t) => t.subtitle)?.style ?? defaultTextStyle();

  const applyPreset = (k: Preset) => {
    const sel = c.sel?.track === 'texts' ? c.sel.id : null;
    const st = STYLE_PRESETS[k].style;
    if (sel) {
      const ids = textTargets(c, sel);
      c.ed.update((q) => ({ ...q, texts: q.texts.map((t) => (ids.has(t.id) ? { ...t, style: { ...t.style, ...st, x: k === 'title' ? t.style.x : t.style.x, y: k === 'title' ? (st.y ?? t.style.y) : t.style.y } } : t)) }));
    } else {
      const t = { id: uid(), start: c.frame, duration: FPS * 2, text: '새 글자', subtitle: k !== 'title', style: { ...defaultTextStyle(), ...st } };
      c.ed.update((q) => ({ ...q, texts: [...q.texts, t] }));
      c.setSel({ track: 'texts', id: t.id });
    }
  };

  const pasteScript = () => {
    if (!script?.trim()) return;
    const end = Math.max(...p.scenes.map(clipEnd), FPS);
    const subs = scriptToSubtitles(script, 0, end, subStyle());
    c.ed.update((q) => ({ ...q, texts: [...(replace ? q.texts.filter((t) => !t.subtitle) : q.texts), ...subs] }));
    setScript(null);
  };

  // 받아쓰기: 소리가 있는 첫 조각(소리 줄 → 메인 영상 순)을 이 컴퓨터에서 받아써 자막으로
  const transcribe = async () => {
    const src = p.audio[0] ? { file: p.audio[0].src.split('/').pop()!, at: p.audio[0].start, trim: p.audio[0].trim } : (() => {
      const s = p.scenes.find((x) => x.media?.kind === 'video');
      return s?.media ? { file: s.media.src.split('/').pop()!, at: s.start, trim: s.media.trim } : null;
    })();
    if (!src) return setStt({ busy: false, err: '받아쓸 소리가 없어요. 소리 줄에 음성을 올리거나 메인에 영상을 넣으세요.' });
    setStt({ busy: true, err: null });
    try {
      const { segments } = await api.transcribe(c.reelId, src.file);
      const st = subStyle();
      const subs = segments
        .map((g) => ({ id: uid(), start: src.at + Math.round(g.start * FPS) - src.trim, duration: Math.max(6, Math.round((g.end - g.start) * FPS)), text: g.text, subtitle: true, style: { ...st } }))
        .filter((t) => t.start + t.duration > 0 && t.text);
      c.ed.update((q) => ({ ...q, texts: [...q.texts.filter((t) => !t.subtitle), ...subs] }));
      setStt({ busy: false, err: subs.length ? null : '받아쓴 말이 없어요.' });
    } catch (e) {
      setStt({ busy: false, err: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="tab-body">
      <div className="preset-grid">
        {(Object.keys(STYLE_PRESETS) as Preset[]).map((k) => (
          <button key={k} className={`preset preset-${k}`} onClick={() => applyPreset(k)}>
            {STYLE_PRESETS[k].label}
          </button>
        ))}
      </div>
      <p className="muted small">{c.sel?.track === 'texts' ? '고른 글자에 스타일을 입혀요.' : '고른 글자가 없으면 지금 위치에 새 글자를 넣어요.'}</p>
      <button className="wide" disabled={stt.busy || !c.whisper} onClick={() => void transcribe()} title={c.whisper ? '' : '선택 기능 — faster-whisper 를 설치하면 쓸 수 있어요'}>
        {stt.busy ? '받아쓰는 중… (이 컴퓨터에서)' : '음성 받아쓰기로 자막 만들기'}
      </button>
      {/* 선택 기능(결정 2026-11-06): 기본 자막은 대본 문장, 받아쓰기는 실제로 한 말이 필요할 때만. 소리는 밖으로 안 나간다 */}
      <p className="muted small">{c.whisper ? '이 컴퓨터에서만 받아써요(소리를 밖으로 보내지 않아요).' : '선택 기능이에요. 쓰려면 터미널에서 pip install faster-whisper 를 실행한 뒤 이 화면을 다시 여세요.'}</p>
      {stt.err && <p className="error small">{stt.err}</p>}
      <button className="wide" onClick={() => setScript(script === null ? '' : null)}>
        대본 붙여넣어 한꺼번에 넣기
      </button>
      {script !== null && (
        <div className="script-box">
          <textarea rows={6} value={script} placeholder={'한 줄 = 자막 하나\n시간은 글자 수에 맞춰 메인 길이에 나눠요'} onChange={(e) => setScript(e.target.value)} />
          <label className="check small">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> 지금 자막을 바꿔 넣기
          </label>
          <button className="primary" onClick={pasteScript}>넣기</button>
        </div>
      )}
      <div className="list-head">자막 목록 {sorted.length}개</div>
      <ul className="sub-list">
        {sorted.map((t) => (
          <li key={t.id} className={c.sel?.id === t.id ? 'on' : ''}>
            <button className="time mono" onClick={() => c.seek(t.start)}>{fmtTime(t.start)}</button>
            <input
              value={t.text}
              onFocus={() => {
                c.setSel({ track: 'texts', id: t.id });
                c.seek(t.start);
                c.ed.checkpoint();
              }}
              onChange={(e) => c.ed.update((q) => ({ ...q, texts: q.texts.map((x) => (x.id === t.id ? { ...x, text: e.target.value } : x)) }), false)}
            />
            <button className="x" title="지우기" onClick={() => c.ed.update((q) => ({ ...q, texts: q.texts.filter((x) => x.id !== t.id) }))}>×</button>
          </li>
        ))}
      </ul>
      <p className="muted small">전체 길이 {(totalFrames(p) / FPS).toFixed(1)}초</p>
    </div>
  );
}
