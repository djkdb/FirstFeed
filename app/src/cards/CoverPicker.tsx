// 표지 고르기 — 표지 제목 후보(고정 틀로 그린 PNG)를 누르면 그 표지로 본문 카드를 만든다
import { plain, type CoversResult } from './makeTypes.ts';

export function CoverPicker({ covers, bodyRunning, onChoose }: { covers: CoversResult; bodyRunning: boolean; onChoose: (index: number) => void }) {
  return (
    <section className="card">
      <h2>표지 고르기</h2>
      <p className="muted small">
        표지를 누르면 그 표지로 본문 카드를 만들어요 — 보통 1~2분, 다시 쓰기가 겹치면 5분 넘게 걸리기도 해요.
        <br />
        AI {covers.calls}번 · 다시 쓴 것 {covers.rewrites}번 · 규칙에 걸려 뺀 후보 {covers.dropped.length}개
      </p>
      <div className="frames">
        {covers.candidates.map((c) => (
          <figure key={c.index} className="frame">
            {/* 단추 이름이 비어 화면 읽기 · 자동화가 표지를 고르지 못했고, 그림 설명에 강조 표시(**)가 그대로 보였다(사용자 시뮬레이션 2026-11-09) */}
            <button type="button" className="pick-cover" disabled={bodyRunning} aria-label={`표지 「${plain(c.headline)}」로 본문 만들기`} onClick={() => onChoose(c.index)}>
              <img src={c.png} alt="" />
            </button>
            <figcaption className="small">{plain(c.headline)}</figcaption>
          </figure>
        ))}
      </div>
      {covers.dropped.length > 0 && (
        <details className="small muted">
          <summary>뺀 후보 {covers.dropped.length}개</summary>
          <ul>
            {covers.dropped.map((d, i) => (
              <li key={i}>
                <strong>{d.headline}</strong>
                {d.sub && <span className="muted"> / 부제: {d.sub}</span>} — {d.reasons.join(' / ')}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
