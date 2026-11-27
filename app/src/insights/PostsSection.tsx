// 「게시물」 묶음 — 직접 입력 폼과 게시물 목록
import { clip, draftFrom, emptyDraft, FORMATS, NUMS, type Draft, type View } from './insightsShared.tsx';
import { PostRow } from './PostRow.tsx';

type Act = (method: string, url: string, body?: unknown, done?: string) => Promise<true | undefined>;

export function PostsSection({ view, draft, setDraft, editing, setEditing, saveDraft, setTitle, act }: { view: View; draft: Draft | null; setDraft: (d: Draft | null) => void; editing: number | null; setEditing: (id: number | null) => void; saveDraft: () => Promise<void>; setTitle: (id: number | null) => string | null; act: Act }) {
  return (
  <section className="card">
    <div className="card-head">
      <h2>게시물</h2>
      {!draft && (
        <button type="button" className="small" onClick={() => (setEditing(null), setDraft(emptyDraft()))}>
          직접 입력
        </button>
      )}
    </div>
    <p className="muted small">Metricool 에 없는 게시물만 직접 입력해요. 모르는 수치는 비워 두면 「입력 안 됨」으로 남고 계산에서 빠져요(0 으로 치지 않아요).</p>
    {draft && (
      <form
        className="panel ins-form"
        onSubmit={(e) => {
          e.preventDefault();
          void saveDraft();
        }}
      >
        <div className="ins-form-row">
          <label>
            게시한 때
            <input type="datetime-local" required value={draft.publishedAt} onChange={(e) => setDraft({ ...draft, publishedAt: e.target.value })} />
          </label>
          <label>
            형식
            <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              {FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          {!editing && (
            <label>
              이은 세트
              <select value={draft.setId} onChange={(e) => setDraft({ ...draft, setId: e.target.value })}>
                <option value="">잇지 않음</option>
                {view.sets
                  .filter((x) => !x.linked || String(x.id) === draft.setId)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {clip(x.title, 30)}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
        <div className="ins-nums">
          {NUMS.map(({ k, label }) => (
            <label key={k}>
              {label}
              <input inputMode="numeric" placeholder="모름" value={draft.nums[k]} onChange={(e) => setDraft({ ...draft, nums: { ...draft.nums, [k]: e.target.value } })} />
            </label>
          ))}
        </div>
        <label>
          게시물 주소(선택)
          <input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://www.instagram.com/p/…" />
        </label>
        <label>
          캡션 첫 줄 · 메모(선택)
          <input value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
        </label>
        <div className="set-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="submit" className="primary small">
            {editing ? '고친 것 저장' : '넣기'}
          </button>
          <button type="button" className="small ghost" onClick={() => (setDraft(null), setEditing(null))}>
            취소
          </button>
        </div>
      </form>
    )}
    {view.posts.length === 0 ? (
      <p className="empty-state">아직 게시물이 없어요. Metricool 에서 불러오거나 직접 입력하세요.</p>
    ) : (
      <ul className="ins-posts">
        {view.posts.map((p) => (
          <PostRow
            key={p.id}
            p={p}
            sets={view.sets}
            setTitle={setTitle(p.setId)}
            onLink={(setId) => void act('PUT', `/api/insights/posts/${p.id}/link`, { setId })}
            onEdit={() => (setEditing(p.id), setDraft(draftFrom(p)))}
            onDelete={() => window.confirm('이 직접 입력 게시물을 지울까요?') && void act('DELETE', `/api/insights/posts/${p.id}`)}
          />
        ))}
      </ul>
    )}
  </section>
  );
}
