// 판 이력과 되돌리기 (FR-ID-5 수용 기준: 수정 이력이 남고 이전 판으로 되돌릴 수 있다)
import { useEffect, useState } from 'react';
import type { InferResponseType } from 'hono/client';
import { api } from '../api.ts';
import { localTime } from '../time.ts';
import { PremadeBadge } from '../premade.tsx';

type History = InferResponseType<typeof api.api.identity.profiles.$get>;
const REASON: Record<string, string> = { interview: '인터뷰로 만든 초안', edit: '직접 수정', alternative: '다른 방향에서 고름', rollback: '되돌림' };

export function ProfileHistory({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [h, setH] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    api.api.identity.profiles
      .$get()
      .then((r) => r.json())
      .then((b) => {
        if (!stale) setH(b);
      })
      .catch((e: unknown) => {
        if (!stale) setError(String(e));
      });
    return () => {
      stale = true;
    };
  }, [refreshKey]);

  const rollback = async (id: number) => {
    const r = await api.api.identity.profiles[':id'].rollback.$post({ param: { id: String(id) } });
    const b = await r.json();
    if ('error' in b) setError(b.error);
    else onChanged();
  };

  if (error) return <p className="status error">{error}</p>;
  if (!h) return null;
  return (
    <details className="history">
      <summary>판 이력 ({h.versions.length})</summary>
      <ol>
        {h.versions.map((v) => (
          <li key={v.id}>
            <strong>v{v.version}</strong> · {REASON[v.reason] ?? v.reason}
            {v.basedOn !== null && <span className="muted"> (판 {h.versions.find((x) => x.id === v.basedOn)?.version ?? '?'}에서)</span>} ·{' '}
            <span className="muted small">{localTime(v.createdAt)}</span> <PremadeBadge createdAt={v.createdAt} />
            {v.isActive ? (
              <span className="tag">지금 적용 중</span>
            ) : (
              <button type="button" onClick={() => void rollback(v.id)}>
                이 판으로 되돌리기
              </button>
            )}
            <div className="small">
              {v.accountLine} — {v.pillarNames.join(' · ')}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
