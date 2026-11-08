// 속성 칸의 「움직임」 — 사람이 직접 고르는 모션(결정 2026-11-08). AI 제안과 같은 프리셋 · 같은 규칙(motionCheck)을 바로 보여 준다
import type { Accent, Camera, Emphasis, Enter, Exit, LoopMotion, PaletteRole, TextMotion } from '../../../server/src/reels/model.ts';
import { CAMERA_LABEL, CAMERAS, ENTER_LABEL, ENTERS, EXIT_LABEL, EXITS, noMotion, TRANSITION_LABEL, TRANSITIONS } from '../../../server/src/reels/motion.ts';
import { checkMotion } from '../../../server/src/reels/motionCheck.ts';
import { textTargets, useCtx } from './context.ts';

const ROLES: Array<[PaletteRole, string]> = [
  ['primary', '주색'],
  ['secondary', '보조색'],
  ['accent', '강조색'],
  ['background', '바탕색'],
  ['text', '글자색'],
];
const ACCENT_LABEL: Record<Accent, string> = { none: '없음', bar: '아래 막대', ring: '퍼지는 고리', sweep: '뒤 띠' };
const LOOP_LABEL: Record<LoopMotion, string> = { none: '없음', float: '둥둥', pulse: '숨쉬기' };
const EMPH_LABEL: Record<Emphasis, string> = { highlight: '형광펜', underline: '밑줄', color: '색' };

/** 지금 편집 내용에서 where 가 이 칸인 문제 */
function Issues({ where }: { where: string }) {
  const c = useCtx();
  const issues = checkMotion(c.p, c.brand.palette, c.guide, c.motionLimits).filter((i) => i.where === where || i.where?.startsWith(`${where}.`));
  if (!issues.length) return null;
  return (
    <ul className="motion-issues small">
      {issues.map((i, k) => (
        <li key={k} className={i.level === 'error' ? 'error' : 'warn'}>
          {i.level === 'error' ? '⚠ ' : ''}
          {i.message}
        </li>
      ))}
    </ul>
  );
}

export function TextMotionProps({ id }: { id: string }) {
  const c = useCtx();
  const i = c.p.texts.findIndex((x) => x.id === id);
  const t = c.p.texts[i];
  if (!t) return null;
  const m = t.motion ?? noMotion();
  // 모양처럼 「자막 전체」면 자막 모두에 — 자막은 하나로 맞추는 것이 기본이라
  const set = (patch: Partial<TextMotion>) => {
    const ids = textTargets(c, id);
    c.ed.update((q) => ({ ...q, texts: q.texts.map((x) => (ids.has(x.id) ? { ...x, motion: { ...(x.motion ?? noMotion()), ...patch } } : x)) }));
  };
  const frames = (v: string) => Math.max(0, Math.min(120, Math.round(Number(v) || 0)));
  return (
    <div className="props">
      <div className="props-title">움직임</div>
      <label className="field">
        <span>등장</span>
        <select value={m.enter} onChange={(e) => set({ enter: e.target.value as Enter, enterFrames: m.enterFrames || (t.subtitle ? 6 : 12) })}>
          {ENTERS.map((k) => (
            <option key={k} value={k}>{ENTER_LABEL[k]}</option>
          ))}
        </select>
        <input type="number" className="num-sm" aria-label="등장 프레임" value={m.enterFrames} min={0} max={120} onChange={(e) => set({ enterFrames: frames(e.target.value) })} />
      </label>
      <label className="field">
        <span>퇴장</span>
        <select value={m.exit} onChange={(e) => set({ exit: e.target.value as Exit, exitFrames: m.exitFrames || 6 })}>
          {EXITS.map((k) => (
            <option key={k} value={k}>{EXIT_LABEL[k]}</option>
          ))}
        </select>
        <input type="number" className="num-sm" aria-label="퇴장 프레임" value={m.exitFrames} min={0} max={120} onChange={(e) => set({ exitFrames: frames(e.target.value) })} />
      </label>
      <label className="field">
        <span>머무는 동안</span>
        <select value={m.loop} onChange={(e) => set({ loop: e.target.value as LoopMotion })}>
          {(Object.keys(LOOP_LABEL) as LoopMotion[]).map((k) => (
            <option key={k} value={k}>{LOOP_LABEL[k]}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>장식</span>
        <select value={m.accent} onChange={(e) => set({ accent: e.target.value as Accent })}>
          {(Object.keys(ACCENT_LABEL) as Accent[]).map((k) => (
            <option key={k} value={k}>{ACCENT_LABEL[k]}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>강조 색</span>
        <select value={m.accentColor} onChange={(e) => set({ accentColor: e.target.value as PaletteRole })}>
          {ROLES.map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
        <span className="swatch" style={{ background: c.brand.palette[m.accentColor] }} />
      </label>
      <div className="field">
        <span>강조 낱말</span>
        <div className="emph-list">
          {m.emphasis.map((e, k) => (
            <span key={k} className="chip on">
              {e.word}
              <select aria-label="강조 모양" value={e.style} onChange={(ev) => set({ emphasis: m.emphasis.map((x, j) => (j === k ? { ...x, style: ev.target.value as Emphasis } : x)) })}>
                {(Object.keys(EMPH_LABEL) as Emphasis[]).map((s) => (
                  <option key={s} value={s}>{EMPH_LABEL[s]}</option>
                ))}
              </select>
              <button className="xs" aria-label={`${e.word} 강조 빼기`} onClick={() => set({ emphasis: m.emphasis.filter((_, j) => j !== k) })}>×</button>
            </span>
          ))}
          <input
            placeholder="낱말 넣고 Enter"
            onKeyDown={(e) => {
              const v = e.currentTarget.value.trim();
              if (e.key !== 'Enter' || !v) return;
              set({ emphasis: [...m.emphasis, { word: v, style: 'highlight' }] });
              e.currentTarget.value = '';
            }}
          />
        </div>
      </div>
      {t.motion && <button className="small" onClick={() => c.ed.update((q) => ({ ...q, texts: q.texts.map((x) => (textTargets(c, id).has(x.id) ? { ...x, motion: undefined } : x)) }))}>움직임 빼기</button>}
      <p className="muted small">프레임은 1/30초. {t.subtitle ? '자막은 말과 같이 가도록 짧게.' : ''}</p>
      <Issues where={`texts.${i}`} />
    </div>
  );
}

export function SceneMotionProps({ id }: { id: string }) {
  const c = useCtx();
  const i = c.p.scenes.findIndex((x) => x.id === id);
  const s = c.p.scenes[i];
  if (!s) return null;
  const set = (patch: Partial<typeof s>) => c.ed.update((q) => ({ ...q, scenes: q.scenes.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  return (
    <div className="props">
      <div className="props-title">움직임</div>
      <label className="field">
        <span>들어오기</span>
        <select value={s.transition ?? 'cut'} onChange={(e) => set({ transition: e.target.value as typeof s.transition, transitionFrames: s.transitionFrames || 10 })}>
          {TRANSITIONS.map((k) => (
            <option key={k} value={k}>{TRANSITION_LABEL[k]}</option>
          ))}
        </select>
        <input type="number" className="num-sm" aria-label="전환 프레임" value={s.transitionFrames ?? 0} min={0} max={120} onChange={(e) => set({ transitionFrames: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
      </label>
      <label className="field">
        <span>카메라</span>
        <select value={s.camera ?? 'none'} onChange={(e) => set({ camera: e.target.value as Camera })}>
          {CAMERAS.map((k) => (
            <option key={k} value={k}>{CAMERA_LABEL[k]}</option>
          ))}
        </select>
      </label>
      <Issues where={`scenes.${i}`} />
    </div>
  );
}

export function ProgressProps() {
  const c = useCtx();
  return (
    <div className="props">
      <div className="props-title">진행 막대</div>
      <label className="field">
        <span>아래 막대</span>
        <select value={c.p.progress ?? 'none'} onChange={(e) => c.ed.update((q) => ({ ...q, progress: e.target.value === 'none' ? null : (e.target.value as PaletteRole) }))}>
          <option value="none">없음</option>
          {ROLES.map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </label>
      <Issues where="progress" />
    </div>
  );
}
