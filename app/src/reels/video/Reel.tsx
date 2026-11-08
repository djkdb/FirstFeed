// 릴스 한 편을 그리는 Remotion 컴포지션 — 편집 화면 · 완성 미리보기 · 영상 뽑기가 모두 이것 하나를 쓴다(결정 2026-11-06: 화면 = 영상).
// 색은 브랜딩 키트 팔레트, 글꼴은 브랜딩 키트 + 앱 OFL 목록(서버의 /api/reels/fonts.css)
import { AbsoluteFill, Audio, continueRender, delayRender, Img, OffthreadVideo, Sequence, useCurrentFrame } from 'remotion';
import { useEffect, useState, type CSSProperties } from 'react';
import { mix, themeColors } from '../../../../server/src/reels/color.ts';
import { cameraAt, motionAt, sceneMotionAt, sceneSpan, segmentsFor, splitVisible } from '../../../../server/src/reels/motion.ts';
import { fontFamily, fontIdOf, H, totalFrames, W, type Bg, type Box, type Overlay, type Palette, type ReelBrand, type ReelDoc, type Scene, type TextClip } from '../../../../server/src/reels/model.ts';
import { inkOnAccent, textColor, toneBehind } from '../../../../server/src/reels/textColor.ts';
import { resolveBg } from '../../../../server/src/reels/themed.ts';

export interface ReelProps {
  doc: ReelDoc;
  brand: ReelBrand;
  /** 격자 가림 안전 영역(확인값 render.safeArea.reel) */
  guide: Box;
  /** 미디어 · 글꼴 주소 앞에 붙일 것 — 화면에서는 '', 영상 뽑기에서는 서버 주소 */
  mediaBase: string;
  /** 편집 화면: 가이드 선 · 고른 것 표시 */
  edit?: { guide: boolean; selected: string | null };
  [key: string]: unknown;
}

const url = (base: string, src: string) => (src.startsWith('http') || src.startsWith('data:') ? src : `${base}${src}`);

export function bgStyle(stored: Bg, base: string, palette: Palette): CSSProperties {
  const bg = resolveBg(stored, palette);
  if (bg.kind === 'solid') return { background: bg.color };
  if (bg.kind === 'gradient')
    return bg.aurora
      ? { background: `radial-gradient(60% 45% at 30% 25%, ${bg.from}cc, transparent 70%), radial-gradient(55% 50% at 75% 70%, ${bg.to}cc, transparent 70%), #160c18` }
      : { background: `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})` };
  return { background: '#000' };
}

function Background({ bg: stored, base, palette }: { bg: Bg; base: string; palette: Palette }) {
  const bg = resolveBg(stored, palette);
  if (bg.kind !== 'image') return <AbsoluteFill style={bgStyle(stored, base, palette)} />;
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      {/* 흐림을 주면 가장자리가 비어 보여서 조금 키워 그린다 */}
      <Img src={url(base, bg.src)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: bg.blur ? `blur(${bg.blur}px)` : undefined, transform: bg.blur ? 'scale(1.06)' : undefined }} />
      {bg.dim > 0 && <AbsoluteFill style={{ background: `rgba(0,0,0,${bg.dim})` }} />}
    </AbsoluteFill>
  );
}

function SceneView({ s, doc, base, palette }: { s: Scene; doc: ReelDoc; base: string; palette: Palette }) {
  // 장면 안 프레임(Sequence 기준) — 들어오는 전환 · 느린 카메라. 앞 장면은 그 아래에서 겹치는 만큼 더 그려진다(sceneSpan)
  const f = useCurrentFrame();
  const tr = sceneMotionAt(f, s);
  const cam = cameraAt(f, s.duration, s.camera);
  return (
    <AbsoluteFill
      style={{
        opacity: tr.opacity,
        transform: tr.ty || tr.scale !== 1 ? `translateY(${tr.ty * 100}%) scale(${tr.scale})` : undefined,
        clipPath: tr.reveal < 1 ? `inset(0 ${(1 - tr.reveal) * 100}% 0 0)` : undefined,
        overflow: 'hidden',
      }}
    >
      <AbsoluteFill style={{ transform: cam.scale !== 1 || cam.ty ? `translateY(${cam.ty * 100}%) scale(${cam.scale})` : undefined }}>
        <Background bg={s.bg ?? doc.bg} base={base} palette={palette} />
        {/* 영상은 따로 겹(AbsoluteFill)에 — 위치가 정해진 배경 겹 다음에 그냥 두면 브라우저가 영상을 배경 아래에 그린다(툴에서 겪음) */}
        {s.media && (
          <AbsoluteFill>
            {s.media.kind === 'video' ? (
              <OffthreadVideo src={url(base, s.media.src)} startFrom={s.media.trim} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Img src={url(base, s.media.src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </AbsoluteFill>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function OverlayView({ o, base, selected, accent }: { o: Overlay; base: string; selected: boolean; accent: string }) {
  const box: CSSProperties = { position: 'absolute', left: o.x, top: o.y, width: o.w, height: o.h, outline: selected ? `4px solid ${accent}` : undefined };
  return o.kind === 'video' ? (
    <OffthreadVideo data-clip-id={o.id} src={url(base, o.src)} startFrom={o.trim} style={{ ...box, objectFit: 'cover' }} />
  ) : (
    <Img data-clip-id={o.id} src={url(base, o.src)} style={{ ...box, objectFit: 'contain' }} />
  );
}

export function textCss(t: TextClip, brand: ReelBrand, behind: string | null): CSSProperties {
  const st = t.style;
  const tc = themeColors(brand.palette.primary);
  const color = textColor(t, brand.palette, behind);
  const base: CSSProperties = {
    fontFamily: fontFamily(st.font, brand),
    fontSize: st.size,
    fontWeight: st.bold ? 700 : 400,
    color,
    textAlign: st.align,
    lineHeight: 1.25,
    whiteSpace: 'pre-wrap',
    wordBreak: 'keep-all',
    overflowWrap: 'anywhere',
  };
  const white = color === '#ffffff';
  switch (st.preset) {
    case 'glow':
      return { ...base, textShadow: `0 0 12px ${tc.accent}, 0 0 28px ${tc.accent}${white ? ', 0 2px 4px rgba(0,0,0,.35)' : ''}` };
    case 'stroke':
      return { ...base, WebkitTextStroke: `${Math.max(3, st.size / 14)}px #111`, paintOrder: 'stroke fill' };
    case 'softbox':
      return { ...base, background: tc.soft, padding: `${st.size * 0.18}px ${st.size * 0.4}px`, borderRadius: st.size * 0.3, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' };
    case 'blackbox':
      return { ...base, background: '#000', padding: `${st.size * 0.18}px ${st.size * 0.4}px`, borderRadius: st.size * 0.12 };
    // 진한 글자(밝은 바탕)에는 그림자를 빼야 번져 보이지 않는다
    case 'title':
      return { ...base, letterSpacing: '-0.03em', textShadow: white ? '0 4px 18px rgba(0,0,0,.35)' : undefined };
    default:
      return { ...base, textShadow: white ? '0 2px 6px rgba(0,0,0,.45)' : undefined };
  }
}

export function TextView({ t, brand, selected, behind }: { t: TextClip; brand: ReelBrand; selected: boolean; behind: string | null }) {
  const st = t.style;
  // 글자 클립 안 프레임 — 모션은 motion.ts 의 순수 함수 하나(화면 = 영상 = 규칙 검사, 결정 2026-11-08)
  const f = useCurrentFrame();
  const m = t.motion;
  // 편집 화면에서 고른 글자는 다 보인 모습으로 — 등장 전 프레임이면 투명해서 잡아 끌 수가 없다. 완성 미리보기 · 영상은 그대로(selected 는 편집 화면에만 온다)
  const mf = motionAt(f, t.duration, selected ? undefined : m);
  const css = textCss(t, brand, behind);
  const accent = m ? brand.palette[m.accentColor] : brand.palette.accent;
  const segs = splitVisible(segmentsFor(t.text, m?.emphasis ?? []), mf.chars);
  const sweep = m?.accent === 'sweep';
  const baseColor = sweep ? inkOnAccent(t, accent) : (css.color as string);
  return (
    <div
      style={{
        position: 'absolute',
        left: st.x - st.width / 2,
        top: st.y,
        width: st.width,
        transform: `translateY(-50%) translate(${mf.tx}px, ${mf.ty}px) rotate(${st.rotation}deg) scale(${mf.scale})`,
        opacity: mf.opacity,
        filter: mf.blur > 0.1 ? `blur(${mf.blur}px)` : undefined,
        display: 'flex',
        justifyContent: st.align === 'left' ? 'flex-start' : st.align === 'right' ? 'flex-end' : 'center',
      }}
    >
      <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', isolation: 'isolate', clipPath: mf.reveal < 1 ? `inset(-20% ${(1 - mf.reveal) * 100}% -20% -5%)` : undefined }}>
        {sweep && (
          <div style={{ position: 'absolute', inset: `-${st.size * 0.06}px -${st.size * 0.22}px`, background: accent, borderRadius: st.size * 0.14, transform: `scaleX(${mf.accent})`, transformOrigin: 'left', zIndex: -1 }} />
        )}
        {m?.accent === 'ring' && mf.accent < 1 && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '110%',
              aspectRatio: '1',
              border: `${Math.max(4, st.size * 0.07)}px solid ${accent}`,
              borderRadius: '50%',
              transform: `translate(-50%, -50%) scale(${0.55 + 0.45 * mf.accent})`,
              opacity: 1 - mf.accent,
              zIndex: -1,
            }}
          />
        )}
        {/* 재는 것은 글자가 실제로 차지하는 안쪽 span — 가림 경고 · 끌기에 쓴다 */}
        <span data-text-id={t.id} style={{ ...css, color: baseColor, display: 'inline-block', maxWidth: '100%', outline: selected ? `3px solid ${brand.palette.primary}` : undefined, outlineOffset: 6, cursor: 'move' }}>
          {segs.map((g, i) => {
            const e = g.emph != null ? m!.emphasis[g.emph] : null;
            const hide: CSSProperties = g.hidden ? { visibility: 'hidden' } : {};
            if (!e) return <span key={i} style={hide}>{g.text}</span>;
            if (e.style === 'color') return <span key={i} style={{ ...hide, color: mix(baseColor, accent, mf.emph) }}>{g.text}</span>;
            const under = e.style === 'underline';
            return (
              <span
                key={i}
                style={{
                  ...hide,
                  color: under ? undefined : mf.emph > 0.5 ? inkOnAccent(t, accent) : undefined,
                  backgroundImage: `linear-gradient(${accent}, ${accent})`,
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: `${mf.emph * 100}% ${under ? '0.14em' : '100%'}`,
                  backgroundPosition: under ? 'left 94%' : 'left center',
                  borderRadius: under ? undefined : '0.12em',
                  padding: under ? undefined : '0 0.06em',
                  boxDecorationBreak: 'clone',
                  WebkitBoxDecorationBreak: 'clone',
                }}
              >
                {g.text}
              </span>
            );
          })}
        </span>
        {m?.accent === 'bar' && (
          <div style={{ position: 'absolute', left: st.align === 'right' ? undefined : 0, right: st.align === 'right' ? 0 : undefined, bottom: -st.size * 0.32, height: Math.max(8, st.size * 0.11), width: `${mf.accent * (st.align === 'center' ? 100 : 60)}%`, marginLeft: st.align === 'center' ? `${(1 - mf.accent) * 50}%` : undefined, background: accent, borderRadius: 99 }} />
        )}
      </div>
    </div>
  );
}

/** 아래 진행 막대 — 격자 가이드 안쪽 아래(가려지지 않는 곳), 영상 전체 프레임 기준 */
function Progress({ doc, color, guide }: { doc: ReelDoc; color: string; guide: Box }) {
  const f = useCurrentFrame();
  const p = Math.min(1, f / Math.max(1, totalFrames(doc) - 1));
  return <div style={{ position: 'absolute', left: guide.x + 48, top: guide.y + guide.h - 28, width: (guide.w - 96) * p, height: 8, borderRadius: 4, background: color }} />;
}

/** 글꼴 불러오기 — 다 불러오기 전에는 찍지 않는다(대체 글꼴로 찍힌 영상은 반쯤 만든 결과, 결정 2026-10-15 과 같은 이유) */
function Fonts({ base, ids, families }: { base: string; ids: string[]; families: string[] }) {
  const key = ids.join(',');
  const [handle] = useState(() => delayRender(`글꼴 ${key}`));
  useEffect(() => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        continueRender(handle);
      }
    };
    fetch(`${base}/api/reels/fonts.css?ids=${encodeURIComponent(key)}`)
      .then((r) => r.text())
      .then((css) => {
        const style = document.createElement('style');
        style.dataset.reelFonts = key;
        // 글꼴 주소는 서버 기준 상대 주소 — 영상 뽑기에서는 서버 주소를 붙인다
        style.textContent = base ? css.replaceAll('url(/api/', `url(${base}/api/`) : css;
        document.head.appendChild(style);
        return Promise.all(families.flatMap((f) => ['400', '700'].map((w) => document.fonts.load(`${w} 40px ${f}`, '가나다 ABC'))));
      })
      .then(finish, finish);
    return finish;
    // 처음 한 번 — 글꼴 목록이 바뀌면 key 가 바뀌어 새 컴포넌트가 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function Reel({ doc, brand, guide: g, mediaBase: base, edit }: ReelProps) {
  const ids = [...new Set([brand.titleFont, brand.bodyFont, ...doc.texts.map((t) => fontIdOf(t.style.font, brand))])].sort();
  const families = [...new Set(doc.texts.map((t) => fontFamily(t.style.font, brand)).concat(fontFamily('title', brand), fontFamily('body', brand)))];
  return (
    <AbsoluteFill style={{ width: W, height: H, overflow: 'hidden', ...bgStyle(doc.bg, base, brand.palette) }}>
      <Fonts key={ids.join(',')} base={base} ids={ids} families={families} />
      {resolveBg(doc.bg, brand.palette).kind === 'image' && <Background bg={doc.bg} base={base} palette={brand.palette} />}
      {/* 시작 순서로 그려야 들어오는 장면이 앞 장면 위에 겹친다 */}
      {[...doc.scenes].sort((a, b) => a.start - b.start).map((s) => (
        <Sequence key={s.id} from={s.start} durationInFrames={sceneSpan(doc.scenes, s)} layout="none">
          <SceneView s={s} doc={doc} base={base} palette={brand.palette} />
        </Sequence>
      ))}
      {doc.overlays.map((o) => (
        <Sequence key={o.id} from={o.start} durationInFrames={Math.max(1, o.duration)} layout="none">
          <OverlayView o={o} base={base} selected={edit?.selected === o.id} accent={brand.palette.primary} />
        </Sequence>
      ))}
      {doc.texts.map((t) => (
        <Sequence key={t.id} from={t.start} durationInFrames={Math.max(1, t.duration)} layout="none">
          <TextView t={t} brand={brand} selected={edit?.selected === t.id} behind={toneBehind(doc, t, brand.palette)} />
        </Sequence>
      ))}
      {doc.audio.map((a) => (
        <Sequence key={a.id} from={a.start} durationInFrames={Math.max(1, a.duration)} layout="none">
          <Audio src={url(base, a.src)} startFrom={a.trim} volume={a.volume} />
        </Sequence>
      ))}
      {doc.progress && <Progress doc={doc} color={brand.palette[doc.progress]} guide={g} />}
      {edit?.guide && (
        <>
          {/* 격자(3:4)에서 잘리는 위아래 — 확인값. 인스타 UI 가림은 아직 재지 않아 선을 긋지 않는다(0-9) */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: g.y, background: 'rgba(0,0,0,.28)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: g.y + g.h, bottom: 0, background: 'rgba(0,0,0,.28)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: g.x, top: g.y, width: g.w, height: g.h, border: '4px dashed rgba(255,255,255,.95)', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: -50, left: 16, fontSize: 30, color: '#fff', fontFamily: 'sans-serif', textShadow: '0 1px 3px #000' }}>격자에 보이는 곳 · 인스타 UI 가림은 미확인</div>
          </div>
        </>
      )}
    </AbsoluteFill>
  );
}
