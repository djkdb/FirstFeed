// 배경: 지금 장면 / 전체 장면 · 원래 배경으로 · 브랜드 팔레트 · 단색 · 그라데이션 · 무늬 · 사진(흐림 · 어둡게) · 올리기.
// 팔레트 · 그라데이션 · 무늬는 색 대신 이름으로 저장 — 브랜딩 키트 팔레트를 바꾸면 이미 고른 배경도 따라간다(결정 2026-11-06)
import { useState } from 'react';
import { shade, tint } from '../../../../server/src/reels/color.ts';
import { sceneAt, type Bg, type PaletteRole } from '../../../../server/src/reels/model.ts';
import { PATTERNS, THEMED_LOOKS } from '../../../../server/src/reels/themed.ts';
import { bgStyle } from '../video/Reel.tsx';
import { useCtx } from '../context.ts';
import { useUpload } from './FilesTab.tsx';

const ROLES: Array<[PaletteRole, string]> = [
  ['background', '바탕'],
  ['primary', '주색'],
  ['secondary', '보조'],
  ['accent', '강조'],
  ['text', '글자'],
];
const NEUTRALS = ['#ffffff', '#f3f3f5', '#d9d9de', '#8f949c', '#3a3a42', '#17181c', '#000000'];

export function BgTab() {
  const c = useCtx();
  const { p } = c;
  const pal = c.brand.palette;
  const [scope, setScope] = useState<'now' | 'all'>('now');
  const [set, setSet] = useState<'carousel' | 'cover' | 'mine'>('carousel');
  const { upload, busy, err } = useUpload();
  const now = sceneAt(p, c.frame);
  const current: Bg = scope === 'now' && now?.bg ? now.bg : p.bg;
  const tones = [tint(pal.primary, 0.9), tint(pal.primary, 0.7), tint(pal.primary, 0.45), shade(pal.primary, 0.4), shade(pal.primary, 0.7), shade(pal.primary, 0.85)];

  const apply = (bg: Bg | null, history = true) =>
    c.ed.update((q) => {
      if (scope === 'now' && now) return { ...q, scenes: q.scenes.map((s) => (s.id === now.id ? { ...s, bg } : s)) };
      // 전체: 기본 배경을 바꾸고 장면마다 따로 고른 배경은 지운다
      return { ...q, bg: bg ?? q.bg, scenes: q.scenes.map((s) => ({ ...s, bg: null })) };
    }, history);

  const images = p.assets.filter((a) => a.kind === 'image');
  const photo = current.kind === 'image' || current.kind === 'pattern' ? current : null;
  const keep = { blur: photo?.blur ?? 0, dim: photo?.dim ?? 0 };

  return (
    <div className="tab-body">
      <div className="seg">
        <button className={scope === 'now' ? 'on' : ''} onClick={() => setScope('now')} disabled={!now}>
          지금 장면{now ? ` · ${now.name}` : ''}
        </button>
        <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>
          전체 장면
        </button>
      </div>
      <button className="wide" onClick={() => apply(null)} disabled={scope === 'now' && !now?.bg}>
        원래 배경으로
      </button>
      <div className="list-head">브랜드 팔레트 · 브랜딩 키트를 따라가요</div>
      <div className="swatches">
        {ROLES.map(([role, label]) => (
          <button key={role} className={`swatch${current.kind === 'brand' && current.role === role ? ' on' : ''}`} style={{ background: pal[role] }} title={label} onClick={() => apply({ kind: 'brand', role })} />
        ))}
      </div>
      <div className="list-head">단색</div>
      <div className="swatches">
        {[...tones, ...NEUTRALS].map((col, i) => (
          <button key={i} className="swatch" style={{ background: col }} title={col} onClick={() => apply({ kind: 'solid', color: col })} />
        ))}
      </div>
      <label className="slider">
        직접 고르기 <input type="color" value={current.kind === 'solid' ? current.color : pal.primary} onChange={(e) => apply({ kind: 'solid', color: e.target.value })} />
      </label>
      <div className="list-head">그라데이션 · 주색을 따라가요</div>
      <div className="grads">
        {THEMED_LOOKS.map((g) => (
          <button key={g.look} className={`grad${current.kind === 'themed' && current.look === g.look ? ' on' : ''}`} style={bgStyle({ kind: 'themed', look: g.look }, '', pal)} onClick={() => apply({ kind: 'themed', look: g.look })}>
            {g.label}
          </button>
        ))}
      </div>
      <div className="list-head">무늬 · 사진</div>
      <label className="slider">
        흐림 <input type="range" min={0} max={40} value={keep.blur} disabled={!photo} onPointerDown={() => c.ed.checkpoint()} onChange={(e) => photo && apply({ ...photo, blur: Number(e.target.value) }, false)} />
      </label>
      <label className="slider">
        어둡게 <input type="range" min={0} max={0.85} step={0.05} value={keep.dim} disabled={!photo} onPointerDown={() => c.ed.checkpoint()} onChange={(e) => photo && apply({ ...photo, dim: Number(e.target.value) }, false)} />
      </label>
      <div className="seg">
        <button className={set === 'carousel' ? 'on' : ''} onClick={() => setSet('carousel')}>캐러셀</button>
        <button className={set === 'cover' ? 'on' : ''} onClick={() => setSet('cover')}>커버</button>
        <button className={set === 'mine' ? 'on' : ''} onClick={() => setSet('mine')}>+ 올리기</button>
      </div>
      <div className="photos">
        {set !== 'mine' &&
          PATTERNS.filter((x) => x.set === set).map((pt) => (
            <button key={pt.id} className={`photo${current.kind === 'pattern' && current.id === pt.id ? ' on' : ''}`} title={pt.name} style={{ backgroundImage: `url("${pt.draw(pal.primary)}")` }} onClick={() => apply({ kind: 'pattern', id: pt.id, ...keep })} />
          ))}
        {set === 'mine' &&
          images.map((a) => (
            <button key={a.file} className="photo" style={{ backgroundImage: `url(${c.media(a.file)})` }} onClick={() => apply({ kind: 'image', src: c.media(a.file), ...keep })} />
          ))}
        {set === 'mine' && (
          <label className="photo add">
            <input type="file" accept="image/*" hidden onChange={(e) => void upload([...(e.target.files ?? [])])} />+ 올리기
          </label>
        )}
      </div>
      {busy && <p className="small">올리는 중…</p>}
      {err && <p className="error small">{err}</p>}
      {set !== 'mine' && <p className="muted small">무늬는 이 앱이 브랜드 주색으로 그린 것이에요.</p>}
    </div>
  );
}
