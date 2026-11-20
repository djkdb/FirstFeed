// 카드 세트 → 티스토리 자동 발행 (사용자 결정 2026-11-20 — 완전 자동). 버튼을 누르면 이 컴퓨터에 브라우저 창이 열리고, 사용자가 그 창에서 로그인하면
// 앱이 제목 · 카드 그림 · 글 · 태그를 넣고 고른 공개 범위로 발행한다. 비밀번호는 앱이 받지 않는다. 공식 API 가 없어 티스토리 화면이 바뀌면 멈출 수 있다
import { useCallback, useEffect, useState } from 'react';
import { localTime } from '../time.ts';
import { blogCall, JobSteps, useBlogJob } from './useBlogJob.tsx';

interface Settings {
  tistory: string | null;
  visibility: 'public' | 'private';
}
interface Post {
  id: number;
  title: string;
  url: string | null;
  visibility: string;
  createdAt: string;
}

export function TistoryPanel({ setId, unchecked }: { setId: number; unchecked: number }) {
  const [s, setS] = useState<Settings | null>(null);
  const [name, setName] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [again, setAgain] = useState(false);
  const load = useCallback(() => {
    void blogCall<Settings>('GET', '/api/blog/settings').then((r) => r.ok && setS(r.data));
    void blogCall<{ posts: Post[] }>('GET', `/api/blog/sets/${setId}`).then((r) => r.ok && setPosts(r.data.posts));
  }, [setId]);
  useEffect(() => load(), [load]);
  const job = useBlogJob(jobId, () => load());

  const saveSettings = async (patch: Partial<Settings>) => {
    const r = await blogCall<Settings>('PUT', '/api/blog/settings', patch);
    setMsg(r.ok ? null : (r.data.error ?? '저장하지 못했어요.'));
    if (r.ok) setS(r.data);
  };
  const publish = async (force = false) => {
    if (!s?.tistory) return;
    if (!force && !window.confirm(`이 컴퓨터에 브라우저 창이 열려요. 그 창에서 티스토리에 로그인하면 「${s.tistory}.tistory.com」에 ${s.visibility === 'public' ? '공개' : '비공개'}로 바로 발행돼요. 시작할까요?`)) return;
    setMsg(null);
    setAgain(false);
    const r = await blogCall<{ jobId: string }>('POST', `/api/blog/sets/${setId}/tistory`, { again: force });
    if (r.ok) setJobId(r.data.jobId);
    else {
      setMsg(r.data.error ?? '시작하지 못했어요.');
      if (r.status === 409 && /이미 티스토리에/.test(r.data.error ?? '')) setAgain(true);
    }
  };
  if (!s) return null;
  const running = job?.phase === 'running';
  return (
    <section className="publish tistory">
      <h3>티스토리에 올리기</h3>
      <p className="muted small">카드 그림 전부와 카드 글 · 캡션 첫 줄 · 해시태그(태그로)를 블로그 글 한 편으로 올려요. 버튼을 누르면 이 컴퓨터에 브라우저 창이 열리고, 그 창에서 로그인하면 끝까지 자동으로 진행돼요. 로그인은 이 앱 전용 창에만 남아요.</p>
      {s.tistory ? (
        <div className="actions">
          <span>
            블로그 <b>{s.tistory}.tistory.com</b>
          </span>
          <button type="button" className="link" onClick={() => void saveSettings({ tistory: null })}>
            바꾸기
          </button>
          <label className="small">
            공개 범위{' '}
            <select value={s.visibility} onChange={(e) => void saveSettings({ visibility: e.target.value as Settings['visibility'] })}>
              <option value="public">공개</option>
              <option value="private">비공개</option>
            </select>
          </label>
        </div>
      ) : (
        <form
          className="actions"
          onSubmit={(e) => {
            e.preventDefault();
            void saveSettings({ tistory: name });
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="블로그 주소 또는 이름 (예: myblog.tistory.com)" aria-label="티스토리 블로그 주소" style={{ maxWidth: 360 }} />
          <button type="submit">저장</button>
        </form>
      )}
      {unchecked > 0 && <p className="status error small">확인하지 않은 소재 밖 설명이 {unchecked}곳 있어요 — 위에서 「확인했어요」를 누른 뒤 발행할 수 있어요.</p>}
      <div className="actions">
        <button type="button" className="primary" disabled={!s.tistory || running || unchecked > 0} onClick={() => void publish(false)}>
          {running ? '발행하는 중…' : '티스토리에 발행'}
        </button>
        {again && (
          <button type="button" onClick={() => void publish(true)}>
            한 번 더 올리기
          </button>
        )}
      </div>
      {msg && <p className="status error small">{msg}</p>}
      <JobSteps job={job} onCancel={() => void blogCall('POST', `/api/blog/jobs/${jobId}/cancel`)} />
      {posts.length > 0 && (
        <ul className="small blog-posts">
          {posts.map((p) => (
            <li key={p.id}>
              {localTime(p.createdAt)} · {p.visibility === 'public' ? '공개' : '비공개'} ·{' '}
              {p.url ? (
                <a href={p.url} target="_blank" rel="noreferrer">
                  {p.url}
                </a>
              ) : (
                '주소 모름(블로그 글 목록에서 확인)'
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">티스토리 공식 글쓰기 API 가 없어서(2024년 종료) 화면을 대신 채워요. 티스토리 화면이 바뀌면 멈출 수 있고, 그때는 어디서 멈췄는지 알려 드려요 — 열린 창에서 마무리하면 돼요.</p>
    </section>
  );
}
