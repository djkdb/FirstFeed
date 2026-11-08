// 모션 제안(AI) — 결정 2026-11-08. 제안은 편집 내용을 바꾸지 않고, 전 · 후를 같은 컴포지션으로 보여 준 뒤 「적용」해야 들어간다.
// 적용은 편집 되돌리기(⌘Z) 한 번으로 되돌릴 수 있다. 진행 단계는 서버가 알려 준 실제 단계만(StageLine)
import { Player } from '@remotion/player';
import { useMemo, useState } from 'react';
import { FPS, H, totalFrames, W } from '../../../server/src/reels/model.ts';
import { applyMotion, type MotionPlan } from '../../../server/src/reels/motionCheck.ts';
import { StageLine } from '../StageLine.tsx';
import { useJob } from '../useJob.ts';
import { reelApi } from './api.ts';
import { useCtx } from './context.ts';
import { Reel, type ReelProps } from './video/Reel.tsx';

interface Proposal {
  plan: MotionPlan;
  baseUpdatedAt: string;
  warnings: Array<{ code: string; message: string }>;
  calls: number;
  rewrites: number;
}

export function MotionPanel({ onClose }: { onClose: () => void }) {
  const c = useCtx();
  const [jobId, setJobId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'after' | 'before'>('after');
  /** 제안을 부른 때의 편집 내용 — 그 뒤 고쳤으면 알린다 */
  const [askedDoc, setAskedDoc] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const { job, cancel } = useJob(
    jobId,
    (j) => {
      setJobId(null);
      if (j.phase === 'done') setProposal(j.result as unknown as Proposal);
      else if (j.phase === 'cancelled') setError('취소했어요. 다시 하려면 「모션 제안」을 누르세요.');
      else setError(`${j.error?.message ?? '제안하지 못했어요.'} ${j.error?.hint ?? ''}`);
    },
    () => setJobId(null),
  );

  const start = async () => {
    setError(null);
    setProposal(null);
    setApplied(false);
    try {
      // 서버는 저장된 편집 내용을 읽는다 — 아직 저장 안 된 바꿈이 빠지지 않게 먼저 저장
      await reelApi.save(c.reelId, c.p);
      setAskedDoc(JSON.stringify(c.p.texts.map((t) => [t.id, t.text, t.start, t.duration, t.style.y])));
      setJobId((await reelApi.motion(c.reelId)).jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const after = useMemo(() => (proposal ? applyMotion(c.p, proposal.plan) : null), [proposal, c.p]);
  const changedSince = askedDoc != null && askedDoc !== JSON.stringify(c.p.texts.map((t) => [t.id, t.text, t.start, t.duration, t.style.y]));
  const shown = view === 'after' && after ? after : c.p;
  const props: ReelProps = { doc: shown, brand: c.brand, guide: c.guide, mediaBase: '' };

  return (
    <div className="motion-panel" role="dialog" aria-label="모션 제안">
      <div className="motion-head">
        <strong>모션 제안</strong>
        <span className="muted small">AI 가 글자 · 장면마다 정해 둔 움직임 중에서 고르고, 코드가 프레임마다 격자 가이드 · 읽을 틈 · 명암비를 재요. 글자 내용은 바꾸지 않아요.</span>
        <span className="grow" />
        <button className="small" onClick={onClose} aria-label="닫기">닫기</button>
      </div>
      {!jobId && !proposal && (
        <button className="primary" onClick={() => void start()}>
          ✨ 모션 제안 받기
        </button>
      )}
      {jobId && (
        <div className="motion-wait">
          <StageLine stage={job?.stage} />
          <button className="small" onClick={() => void cancel()}>취소</button>
        </div>
      )}
      {error && <p className="status error small">{error}</p>}
      {proposal && after && (
        <div className="motion-result">
          <div className="motion-player">
            <div className="seg">
              <button className={view === 'after' ? 'on' : ''} onClick={() => setView('after')}>제안</button>
              <button className={view === 'before' ? 'on' : ''} onClick={() => setView('before')}>지금</button>
            </div>
            <Player
              key={view}
              component={Reel}
              inputProps={props}
              durationInFrames={Math.max(1, totalFrames(shown))}
              fps={FPS}
              compositionWidth={W}
              compositionHeight={H}
              style={{ width: 216, height: 384 }}
              controls
              loop
              autoPlay
              initiallyMuted
              acknowledgeRemotionLicense
            />
          </div>
          <div className="motion-side">
            <p>{proposal.plan.note}</p>
            <p className="muted small">
              AI 호출 {proposal.calls}번 · 규칙 때문에 다시 쓴 것 {proposal.rewrites}번 · 글자 {proposal.plan.texts.filter((t) => t.enter !== 'none').length}/{proposal.plan.texts.length}개가 움직여요
            </p>
            {proposal.warnings.length > 0 && (
              <ul className="small">
                {proposal.warnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            )}
            {changedSince && <p className="note small">제안을 받은 뒤 글자를 고쳤어요. 적용하면 같은 글자(같은 id)에 모션이 들어가고, 새로 넣은 글자는 그대로예요.</p>}
            <div className="row">
              {applied ? (
                <span className="small">적용했어요 — 되돌리려면 타임라인의 「되돌리기」(⌘Z).</span>
              ) : (
                <button
                  className="primary"
                  onClick={() => {
                    c.ed.update((d) => applyMotion(d, proposal.plan));
                    setApplied(true);
                  }}
                >
                  적용
                </button>
              )}
              <button className="small" onClick={() => void start()}>다시 제안</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
