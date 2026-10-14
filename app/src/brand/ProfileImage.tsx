// 프로필 사진 (FR-BR-4): 코드로 그린 글자형 시안 + 만든 그림 올리기.
// 시안은 고른 색·제목 폰트로 1080×1080(결정 2026-10-14) 캔버스에 그려 PNG 로 받거나 바로 적용한다.
// 인스타는 프로필 사진을 원으로 잘라 보여서, 미리보기도 원으로 보인다.
import { useState } from 'react';
import type { InferResponseType } from 'hono/client';
import { api } from '../api.ts';
import { loadBrandFonts } from './loadFonts.ts';

type BrandState = InferResponseType<typeof api.api.brand.$get>;
type Patch = Parameters<typeof api.api.brand.selection.$put>[0]['json'];

const SIZE = 1080;
const FALLBACK = { primary: '#222222', background: '#ffffff', text: '#111111' };

/** 표시 이름(없으면 아이디)의 앞 글자 두 개 — 한글이면 한 글자 */
function initialsOf(s: string | null): string {
  const g = [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment((s ?? '').replace(/[^\p{L}\p{N}]/gu, ''))].map((x) => x.segment);
  if (g.length === 0) return 'A';
  return /\p{Script=Hangul}/u.test(g[0]!) ? g[0]! : g.slice(0, 2).join('').toUpperCase();
}

function lum(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
};

async function drawPng(letters: string, bg: string, fg: string, family: string, weight: number): Promise<Blob> {
  await loadBrandFonts();
  await document.fonts.load(`${weight} 100px "${family}"`, letters);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // 원으로 잘려도 글자가 안 잘리게 지름의 절반 안쪽에 맞춘다
  let px = letters.length > 1 ? 420 : 520;
  ctx.font = `${weight} ${px}px "${family}"`;
  while (ctx.measureText(letters).width > SIZE * 0.6 && px > 120) {
    px -= 20;
    ctx.font = `${weight} ${px}px "${family}"`;
  }
  ctx.fillText(letters, SIZE / 2, SIZE / 2 + px * 0.04);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 를 만들지 못했습니다.'))), 'image/png'));
}

async function upload(blob: Blob): Promise<string> {
  // 본문이 파일 바이트라 RPC 대신 fetch 로 보낸다
  const r = await fetch('/api/brand/assets', { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: blob });
  const b = (await r.json()) as { name?: string; error?: string };
  if (!b.name) throw new Error(b.error ?? '올리지 못했습니다.');
  return b.name;
}

export function ProfileImage({
  selection,
  fonts,
  save,
}: {
  selection: BrandState['selection'];
  fonts: BrandState['fonts'];
  save: (p: Patch) => Promise<boolean>;
}) {
  const [letters, setLetters] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = letters ?? initialsOf(selection.displayName ?? selection.handle);
  const colors = selection.palette?.colors ?? FALLBACK;
  const fg = ratio(colors.text, colors.primary) >= ratio(colors.background, colors.primary) ? colors.text : colors.background;
  const font = fonts.find((f) => f.id === selection.titleFont);
  const family = font?.family ?? 'Pretendard';
  const weight = font?.weights.at(-1) ?? 700;

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await f();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const download = () =>
    run(async () => {
      const blob = await drawPng(shown, colors.primary, fg, family, weight);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `profile-${SIZE}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  const applyDraft = () => run(async () => void (await save({ profileImage: await upload(await drawPng(shown, colors.primary, fg, family, weight)) })));
  const applyFile = (file: File) => run(async () => void (await save({ profileImage: await upload(file) })));

  return (
    <section className="card">
      <h2>프로필 사진</h2>
      <div className="profile-image">
        <div>
          <p className="muted small">지금 적용 중</p>
          {selection.profileImage ? <img className="avatar" src={`/api/brand/assets/${selection.profileImage}`} alt="적용 중인 프로필 사진" /> : <div className="avatar empty">없음</div>}
        </div>
        <div>
          <p className="muted small">
            글자형 시안 · {selection.palette ? `팔레트 「${selection.palette.name}」` : '팔레트를 고르면 그 색으로'} · {font?.name ?? '제목 폰트를 고르면 그 폰트로'}
          </p>
          <svg className="avatar" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="글자형 프로필 사진 시안">
            <rect width={SIZE} height={SIZE} fill={colors.primary} />
            <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fill={fg} fontFamily={family} fontWeight={weight} fontSize={shown.length > 1 ? 420 : 520}>
              {shown}
            </text>
          </svg>
          <div className="actions">
            <label className="small">
              글자 <input value={shown} maxLength={4} size={4} onChange={(e) => setLetters(e.target.value)} />
            </label>
            <button type="button" disabled={busy || !shown.trim()} onClick={() => void download()}>
              PNG 받기 (1080×1080)
            </button>
            <button type="button" className="primary" disabled={busy || !shown.trim()} onClick={() => void applyDraft()}>
              이 시안으로 적용
            </button>
          </div>
        </div>
      </div>
      <div className="actions">
        <label className="small">
          만든 그림 올리기 (PNG·JPG·WEBP):{' '}
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => e.target.files?.[0] && void applyFile(e.target.files[0])} />
        </label>
      </div>
      <p className="muted small">인스타는 프로필 사진을 원으로 잘라 보여요. 가장자리에 중요한 것을 두지 마세요.</p>
      {error && <p className="status error">{error}</p>}
    </section>
  );
}
