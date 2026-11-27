// 게시물 한 줄 — 언제 · 형식 · 출처 · 이은 세트(잇기 · 끊기) · 도달 · 저장 · 공유 · 비율. 직접 입력한 것만 고치기 · 지우기
import { clip, formatName, pct, Val, type Post, type View } from './insightsShared.tsx';
import { isoLocal } from '../time.ts';

export function PostRow({
  p,
  sets,
  setTitle,
  onLink,
  onEdit,
  onDelete,
}: {
  p: Post;
  sets: View['sets'];
  setTitle: string | null;
  onLink: (setId: number | null) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const stats: Array<[string, React.ReactNode]> = [
    ['도달', <Val v={p.reach} />],
    ['저장', <Val v={p.saved} />],
    ['공유', <Val v={p.shares} />],
    ['저장률', pct(p.saveRate) ?? <span className="muted small">계산 안 됨</span>],
    ['공유율', pct(p.shareRate) ?? <span className="muted small">계산 안 됨</span>],
  ];
  return (
    <li className="ins-post">
      <div className="ins-post-head">
        <span className="ins-post-when">{p.publishedAt ? isoLocal(p.publishedAt) : <span className="muted">날짜 모름</span>}</span>
        <span className="small muted">{formatName(p.type)}</span>
        <span className="badge badge-off">{p.source === 'metricool' ? 'Metricool' : '직접 입력'}</span>
        {!p.mature && p.publishedAt && <span className="badge badge-warn">집계 중</span>}
        {p.source === 'manual' && (
          <span className="ins-post-actions">
            <button type="button" className="small ghost" onClick={onEdit}>
              고치기
            </button>
            <button type="button" className="small ghost" onClick={onDelete}>
              지우기
            </button>
          </span>
        )}
      </div>
      <div className="ins-post-text">
        {p.url ? (
          <a href={p.url} target="_blank" rel="noreferrer noopener">
            {clip(p.content, 80) ?? '게시물 열기'}
          </a>
        ) : (
          (clip(p.content, 80) ?? <span className="muted">글 없음</span>)
        )}
      </div>
      <div className="ins-post-set small">
        {setTitle ? (
          <>
            <span className="muted">이은 세트</span> <b>{clip(setTitle, 40)}</b>{' '}
            <button type="button" className="link small" onClick={() => onLink(null)}>
              끊기
            </button>
          </>
        ) : (
          <select aria-label="세트 잇기" value="" onChange={(e) => e.target.value && onLink(Number(e.target.value))}>
            <option value="">세트 잇기…</option>
            {sets
              .filter((x) => !x.linked)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {clip(x.title, 30)}
                </option>
              ))}
          </select>
        )}
      </div>
      <dl className="ins-stats">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}
