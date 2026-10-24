// 대기 중에 지금 단계를 한 줄로 (결정 2026-10-24). 서버가 단계를 아직 모르면(루프 밖 · 시작 직후) 아무것도 보이지 않는다
import { stageText, type Stage } from './jobStage.ts';

export function StageLine({ stage }: { stage: Stage | null | undefined }) {
  const t = stageText(stage);
  if (!t) return null;
  return (
    <div className="stage" role="status" aria-live="polite">
      <span className="stage-dot" aria-hidden="true" />
      <span>{t.text}</span>
      {t.reasons.length > 0 && (
        <ul className="stage-reasons">
          {t.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
