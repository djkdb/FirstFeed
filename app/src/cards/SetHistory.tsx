// 만든 세트 목록 — 「보기」를 누르면 그 세트를 연다
import type { InferResponseType } from 'hono/client';
import type { api } from '../api.ts';
import { localTime } from '../time.ts';
import { PremadeBadge } from '../premade.tsx';

type Sets = InferResponseType<typeof api.api.cards.$get>['sets'];

export function SetHistory({ sets, onView }: { sets: Sets; onView: (id: number) => void }) {
  return (
    <section className="card history">
      <h2>만든 세트</h2>
      <ul>
        {sets.map((s) => (
          <li key={s.id}>
            #{s.id} · {s.cover.replace(/\*\*/g, '').replace(/\n/g, ' ')} · 본문 {s.bodyCount}장 · {localTime(s.createdAt)} <PremadeBadge createdAt={s.createdAt} />
            <button type="button" onClick={() => onView(s.id)}>
              보기
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
