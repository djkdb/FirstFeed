// 오른쪽 속성: 고른 것(글자 · 장면 · 얹은 그림 · 소리)의 값을 바꾼다
import { useState } from 'react';
import { fmtTime, FPS, H, STYLE_PRESETS, SUBTITLE_Y, W, type Preset, type TextStyle } from '../../../server/src/reels/model.ts';
import { textColor, toneBehind } from '../../../server/src/reels/textColor.ts';
import { textTargets, useCtx } from './context.ts';
import { ProgressProps, SceneMotionProps, TextMotionProps } from './MotionProps.tsx';

function Num({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  const c = useCtx();
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" value={Math.round(value * 100) / 100} min={min} max={max} step={step} onFocus={() => c.ed.checkpoint()} onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))} />
    </label>
  );
}
function Range({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  const c = useCtx();
  return (
    <label className="field">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onPointerDown={() => c.ed.checkpoint()} onChange={(e) => onChange(Number(e.target.value))} />
      <input type="number" className="num-sm" value={value} onFocus={() => c.ed.checkpoint()} onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))} />
    </label>
  );
}

function TextProps({ id }: { id: string }) {
  const c = useCtx();
  const t = c.p.texts.find((x) => x.id === id);
  if (!t) return null;
  const subCount = c.p.texts.filter((x) => x.subtitle).length;
  /** 글 칸이 아니라 모양 · 위치는 「자막 전체」면 자막 모두에 */
  const setStyle = (patch: Partial<TextStyle>) => {
    const ids = textTargets(c, id);
    c.ed.update((q) => ({ ...q, texts: q.texts.map((x) => (ids.has(x.id) ? { ...x, style: { ...x.style, ...patch } } : x)) }), false);
  };
  const st = t.style;
  return (
    <div className="props">
      <div className="props-title">글자</div>
      <textarea
        rows={3}
        value={t.text}
        onFocus={() => c.ed.checkpoint()}
        onChange={(e) => c.ed.update((q) => ({ ...q, texts: q.texts.map((x) => (x.id === id ? { ...x, text: e.target.value } : x)) }), false)}
      />
      <div className="chips">
        {(Object.keys(STYLE_PRESETS) as Preset[]).map((k) => (
          <button key={k} className={`chip${st.preset === k ? ' on' : ''}`} onClick={() => (c.ed.checkpoint(), setStyle({ ...STYLE_PRESETS[k].style, x: st.x, y: st.y }))}>
            {STYLE_PRESETS[k].label}
          </button>
        ))}
      </div>
      <label className="field">
        <span>글꼴</span>
        <select value={st.font} onChange={(e) => (c.ed.checkpoint(), setStyle({ font: e.target.value }))}>
          <option value="title">브랜드 제목 글꼴</option>
          <option value="body">브랜드 본문 글꼴</option>
          {c.fonts.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </label>
      <Range label="크기" value={st.size} min={20} max={220} onChange={(v) => setStyle({ size: v })} />
      <label className="field">
        <span>굵게</span>
        <button className={`chip${st.bold ? ' on' : ''}`} onClick={() => (c.ed.checkpoint(), setStyle({ bold: !st.bold }))}>{st.bold ? '켬' : '끔'}</button>
      </label>
      <label className="field">
        <span>글자색</span>
        <input type="color" value={textColor(t, c.brand.palette, toneBehind(c.p, t, c.brand.palette))} onFocus={() => c.ed.checkpoint()} onChange={(e) => setStyle({ color: e.target.value })} />
        <button className={`chip${st.color === 'auto' ? ' on' : ''}`} title="스타일 · 개성색에 맞춰 읽히는 색" onClick={() => (c.ed.checkpoint(), setStyle({ color: 'auto' }))}>자동</button>
        <button className="chip" onClick={() => (c.ed.checkpoint(), setStyle({ color: c.brand.palette.primary }))}>브랜드 주색</button>
      </label>
      <div className="field">
        <span>정렬</span>
        <div className="seg">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button key={a} className={st.align === a ? 'on' : ''} onClick={() => (c.ed.checkpoint(), setStyle({ align: a }))}>
              {a === 'left' ? '왼쪽' : a === 'center' ? '가운데' : '오른쪽'}
            </button>
          ))}
        </div>
      </div>
      <div className="props-title">위치</div>
      <div className="seg">
        <button className={c.scope === 'one' ? 'on' : ''} onClick={() => c.setScope('one')}>이 자막만</button>
        <button className={c.scope === 'all' ? 'on' : ''} disabled={!t.subtitle} onClick={() => c.setScope('all')}>
          자막 전체 {subCount}개
        </button>
      </div>
      <p className="muted small">{c.scope === 'all' && t.subtitle ? '모양 · 위치를 바꾸면 자막 모두에 같이 들어가요.' : '이 글자 하나만 바꿔요. 화면에서 끌어도 돼요.'}</p>
      <div className="chips">
        <button className="chip" onClick={() => (c.ed.checkpoint(), setStyle({ y: c.guide.y + st.size }))}>위</button>
        <button className="chip" onClick={() => (c.ed.checkpoint(), setStyle({ y: H / 2 }))}>가운데</button>
        <button className="chip" onClick={() => (c.ed.checkpoint(), setStyle({ y: SUBTITLE_Y }))}>자막 자리</button>
        <button className="chip" onClick={() => (c.ed.checkpoint(), setStyle({ y: c.guide.y + c.guide.h - st.size }))}>아래</button>
        <button className="chip" onClick={() => (c.ed.checkpoint(), setStyle({ x: W / 2 }))}>가로 가운데</button>
      </div>
      <Num label="가로 X" value={st.x} onChange={(v) => setStyle({ x: v })} />
      <Num label="세로 Y" value={st.y} onChange={(v) => setStyle({ y: v })} />
      <label className="field">
        <span>일괄 수정</span>
        <button className={`chip${t.subtitle ? ' on' : ''}`} onClick={() => c.ed.update((q) => ({ ...q, texts: q.texts.map((x) => (x.id === id ? { ...x, subtitle: !x.subtitle } : x)) }))}>
          {t.subtitle ? '자막 전체에 포함' : '포함 안 함'}
        </button>
      </label>
      <Range label="글 폭" value={st.width} min={200} max={W} onChange={(v) => setStyle({ width: v })} />
      <Range label="회전" value={st.rotation} min={-45} max={45} onChange={(v) => setStyle({ rotation: v })} />
      <div className="props-title">시간</div>
      <Num label="시작(초)" value={t.start / FPS} step={0.1} min={0} onChange={(v) => c.ed.update((q) => ({ ...q, texts: q.texts.map((x) => (x.id === id ? { ...x, start: Math.max(0, Math.round(v * FPS)) } : x)) }), false)} />
      <Num label="길이(초)" value={t.duration / FPS} step={0.1} min={0.1} onChange={(v) => c.ed.update((q) => ({ ...q, texts: q.texts.map((x) => (x.id === id ? { ...x, duration: Math.max(3, Math.round(v * FPS)) } : x)) }), false)} />
    </div>
  );
}

function SceneProps({ id }: { id: string }) {
  const c = useCtx();
  const s = c.p.scenes.find((x) => x.id === id);
  if (!s) return null;
  const set = (patch: Partial<typeof s>) => c.ed.update((q) => ({ ...q, scenes: q.scenes.map((x) => (x.id === id ? { ...x, ...patch } : x)) }), false);
  return (
    <div className="props">
      <div className="props-title">장면</div>
      <label className="field">
        <span>이름</span>
        <input value={s.name} onFocus={() => c.ed.checkpoint()} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <Num label="시작(초)" value={s.start / FPS} step={0.1} min={0} onChange={(v) => set({ start: Math.max(0, Math.round(v * FPS)) })} />
      <Num label="길이(초)" value={s.duration / FPS} step={0.1} min={0.1} onChange={(v) => set({ duration: Math.max(3, Math.round(v * FPS)) })} />
      <p className="muted small">{s.media ? `${s.media.kind === 'video' ? '영상' : '사진'} · 원본 ${(s.media.trim / FPS).toFixed(1)}초부터` : '영상 없음 — 배경만'}</p>
      {s.media && <button className="wide" onClick={() => (c.ed.checkpoint(), set({ media: null }))}>영상 빼기(배경만)</button>}
      <p className="muted small">영상 바꾸기는 왼쪽 「장면」 탭의 「내 영상으로」, 배경은 「배경」 탭에서.</p>
    </div>
  );
}

function OverlayProps({ id }: { id: string }) {
  const c = useCtx();
  const o = c.p.overlays.find((x) => x.id === id);
  if (!o) return null;
  const set = (patch: Partial<typeof o>) => c.ed.update((q) => ({ ...q, overlays: q.overlays.map((x) => (x.id === id ? { ...x, ...patch } : x)) }), false);
  return (
    <div className="props">
      <div className="props-title">위에 얹기</div>
      <Num label="가로 X" value={o.x} onChange={(v) => set({ x: v })} />
      <Num label="세로 Y" value={o.y} onChange={(v) => set({ y: v })} />
      <Num label="너비" value={o.w} min={20} onChange={(v) => set({ w: v })} />
      <Num label="높이" value={o.h} min={20} onChange={(v) => set({ h: v })} />
      <p className="muted small">화면에서 끌어 옮길 수 있어요.</p>
    </div>
  );
}

function AudioProps({ id }: { id: string }) {
  const c = useCtx();
  const a = c.p.audio.find((x) => x.id === id);
  if (!a) return null;
  return (
    <div className="props">
      <div className="props-title">소리</div>
      <Range label="음량" value={a.volume} min={0} max={2} step={0.05} onChange={(v) => c.ed.update((q) => ({ ...q, audio: q.audio.map((x) => (x.id === id ? { ...x, volume: v } : x)) }), false)} />
    </div>
  );
}

function GuideProps() {
  const c = useCtx();
  return (
    <div className="props">
      <div className="props-title">가이드</div>
      <p className="muted small">
        점선 안이 프로필 격자(3:4)에 보이는 곳이에요(위아래 {c.guide.y}px 가 잘림 — 실제 계정으로 확인한 값). 인스타 화면의 캡션 · 단추 자리는 아직 재지 않아 선을 긋지 않았어요.
      </p>
    </div>
  );
}

/** 원본 문구 · 색: 처음 모습과 달라진 글자만 보이고 하나씩 · 모두 되돌린다 */
function OriginalTab() {
  const c = useCtx();
  const o = c.p.original;
  const changed = c.p.texts.filter((t) => o[t.id] && (o[t.id]!.text !== t.text || o[t.id]!.color !== t.style.color)).sort((a, b) => a.start - b.start);
  const restore = (ids: Set<string>) =>
    c.ed.update((q) => ({ ...q, texts: q.texts.map((t) => (ids.has(t.id) && o[t.id] ? { ...t, text: o[t.id]!.text, style: { ...t.style, color: o[t.id]!.color } } : t)) }));
  return (
    <div className="props">
      <p className="muted small">처음 모습과 달라진 글자 {changed.length}개. 문구와 글자색만 되돌려요(위치 · 크기는 그대로).</p>
      {changed.length > 1 && <button className="wide" onClick={() => restore(new Set(changed.map((t) => t.id)))}>모두 원래대로</button>}
      {changed.map((t) => (
        <div key={t.id} className="orig">
          <div className="muted small mono">{fmtTime(t.start)}</div>
          <div className="orig-row"><span className="tag">원본</span><span style={{ color: textColor({ ...t, style: { ...t.style, color: o[t.id]!.color } }, c.brand.palette, toneBehind(c.p, t, c.brand.palette)) }}>■</span> {o[t.id]!.text}</div>
          <div className="orig-row"><span className="tag now">지금</span><span style={{ color: textColor(t, c.brand.palette, toneBehind(c.p, t, c.brand.palette)) }}>■</span> {t.text}</div>
          <button className="xs" onClick={() => restore(new Set([t.id]))}>원래대로</button>
        </div>
      ))}
    </div>
  );
}

function MemoTab() {
  const c = useCtx();
  return (
    <div className="props">
      <p className="muted small">이 프로젝트 메모 — 자동으로 저장돼요.</p>
      <textarea rows={16} value={c.p.memo ?? ''} placeholder={'할 일, 쓸 음원, 올릴 시간 등'} onFocus={() => c.ed.checkpoint()} onChange={(e) => c.ed.update((q) => ({ ...q, memo: e.target.value }), false)} />
    </div>
  );
}

export function Inspector() {
  const c = useCtx();
  const s = c.sel;
  const [tab, setTab] = useState<'props' | 'orig' | 'memo'>('props');
  return (
    <aside className="inspector">
      <div className="insp-tabs">
        {(
          [
            ['props', '속성'],
            ['orig', '원본 문구·색'],
            ['memo', '메모'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'orig' && <OriginalTab />}
      {tab === 'memo' && <MemoTab />}
      {tab === 'props' && !s && (
        <>
          <p className="muted small pad">화면이나 타임라인에서 글자 · 장면 · 그림 · 소리를 고르면 여기서 바꿔요.</p>
          <GuideProps />
          <ProgressProps />
        </>
      )}
      {tab === 'props' && s?.track === 'texts' && (
        <>
          <TextProps id={s.id} />
          <TextMotionProps id={s.id} />
        </>
      )}
      {tab === 'props' && s?.track === 'scenes' && (
        <>
          <SceneProps id={s.id} />
          <SceneMotionProps id={s.id} />
        </>
      )}
      {tab === 'props' && s?.track === 'overlays' && <OverlayProps id={s.id} />}
      {tab === 'props' && s?.track === 'audio' && <AudioProps id={s.id} />}
    </aside>
  );
}
