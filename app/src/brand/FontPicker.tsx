// 폰트 직접 고르기 (사용자 시뮬레이션 2026-11-20: 폰트가 19종으로 늘었는데 AI 가 낸 세 짝 말고는 고를 길이 없었다).
// 목록은 서버의 OFL 확인 목록 그대로(server/src/brand/fonts.ts) — 제목 칸에는 제목용, 본문 칸에는 본문용만. 저장은 AI 후보를 누를 때와 같은 길(PUT /selection, 서버가 목록 · 쓰임을 다시 잰다)
import type { InferResponseType } from 'hono/client';
import { api } from '../api.ts';

type Font = InferResponseType<typeof api.api.brand.$get>['fonts'][number];

const STYLE: Record<string, string> = { sans: '고딕', serif: '명조', display: '제목용 개성' };

function Row({ label, fonts, current, sample, pick }: { label: string; fonts: Font[]; current: string | null; sample: string; pick: (id: string) => void }) {
  return (
    <div className="fontpick-row">
      <h4>{label}</h4>
      <div className="fontpick-grid" role="radiogroup" aria-label={label}>
        {fonts.map((f) => (
          <button key={f.id} type="button" role="radio" aria-checked={current === f.id} className={current === f.id ? 'fontpick on' : 'fontpick'} onClick={() => pick(f.id)}>
            <span className="fontpick-sample" style={{ fontFamily: `'${f.family}'`, fontWeight: label.startsWith('제목') ? f.weights.at(-1) : f.weights[0] }}>
              {sample}
            </span>
            <span className="muted small">
              {f.name} · {STYLE[f.style] ?? f.style}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function FontPicker({ fonts, titleFont, bodyFont, sample, save }: { fonts: Font[]; titleFont: string | null; bodyFont: string | null; sample: string; save: (p: { titleFont?: string; bodyFont?: string }) => unknown }) {
  const chosen = [...new Set([titleFont, bodyFont].filter((x): x is string => !!x))].map((id) => fonts.find((f) => f.id === id)).filter((f): f is Font => !!f);
  return (
    <details className="fontpick-box">
      <summary>
        직접 고르기 · {fonts.length}종 <span className="muted small">— 위 짝이 마음에 안 들면 제목 · 본문 글꼴을 따로 골라요</span>
      </summary>
      <Row label="제목 글꼴" fonts={fonts.filter((f) => f.roles.includes('title'))} current={titleFont} sample="일단 발! 가나다 Aa 123" pick={(id) => void save({ titleFont: id })} />
      <Row label="본문 글꼴" fonts={fonts.filter((f) => f.roles.includes('body'))} current={bodyFont} sample={sample} pick={(id) => void save({ bodyFont: id })} />
      {chosen.length > 0 && (
        <p className="muted small">
          라이선스: {chosen.map((f) => `${f.name} — ${f.license.name}${f.license.reservedFontName ? ` (예약 이름 "${f.license.reservedFontName}")` : ''}`).join(' · ')}
          {[...new Set(chosen.map((f) => f.noticeKo).filter(Boolean))].map((n) => (
            <span key={n} className="block">
              {n}
            </span>
          ))}
        </p>
      )}
    </details>
  );
}
