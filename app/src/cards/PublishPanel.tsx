// 업로드 준비 (FR-PB-1 · 결정 2026-10-18): 최소 캡션 → 표시된 풀이를 모두 확인 → 업로드 폴더 만들기 → 폴더 열기.
// 확인하지 않은 「소재에 없는 설명」이 있으면 폴더를 만들 수 없다 — 지나칠 수 있으면 「사람이 확인한다」는 결정이 의미가 없다
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.ts';
import { useJob } from '../useJob.ts';
import { PhoneShare } from './PhoneShare.tsx';

interface Gloss {
  sentence: string;
  term: string;
  checkedAt?: string | null;
}
interface PublishState {
  caption: { hook: string; lines: string[]; hashtags: string[]; glosses: Gloss[]; edited: boolean; text: string } | null;
  unchecked: number;
  exports: Array<{ id: number; path: string; files: number; createdAt: string }>;
}
interface Settings {
  uploadRoot: string;
  resolved: string | null;
  maxHashtags: number;
}

const post = async (url: string, body: unknown, method = 'POST') => {
  const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const b = (await r.json()) as Record<string, unknown>;
  if (!r.ok || 'error' in b) throw new Error(String(b.error ?? '요청이 실패했습니다.'));
  return b;
};

export function PublishPanel({ setId, cardUnchecked, onChanged }: { setId: number; cardUnchecked: number; onChanged: () => void }) {
  const [st, setSt] = useState<PublishState | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ hook: string; lines: string; hashtags: string } | null>(null);
  const [rootDraft, setRootDraft] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([
        fetch(`/api/publish/sets/${setId}`).then((r) => r.json() as Promise<PublishState>),
        api.api.publish.settings.$get().then((r) => r.json() as Promise<Settings>),
      ]).then(([s, g]) => {
        setSt(s);
        setSettings(g);
      }),
    [setId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const job = useJob(
    jobId,
    (j) => {
      setJobId(null);
      const r = j.result as { status?: string; errors?: string[]; cutHashtags?: string[] } | null;
      if (j.phase !== 'done') setMsg({ ok: false, text: j.phase === 'cancelled' ? '취소했습니다.' : `${j.error?.message ?? '실패했습니다.'} ${j.error?.hint ?? ''}` });
      else if (r?.status !== 'saved') setMsg({ ok: false, text: `캡션이 규칙을 통과하지 못했습니다. 다시 만들어 보세요. ${(r?.errors ?? []).slice(0, 2).join(' / ')}` });
      else setMsg({ ok: true, text: `캡션을 만들었어요${r.cutHashtags?.length ? ` (해시태그 상한을 넘은 ${r.cutHashtags.join(' ')} 는 뺐어요)` : ''}.` });
      void load();
    },
    () => setJobId(null),
  );

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await f();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (!st || !settings) return <p className="muted small">업로드 준비를 불러오는 중…</p>;
  const unchecked = cardUnchecked + (st.caption?.glosses.filter((g) => !g.checkedAt).length ?? 0);
  const cap = st.caption;

  return (
    <section className="publish">
      <h3>업로드 준비</h3>

      <div className="pub-step">
        <strong>1. 캡션</strong>{' '}
        <span className="muted small">첫 줄 + 핵심 몇 줄 + 해시태그 {settings.maxHashtags}개 이내(중간 발표용 최소 캡션 · AI 호출 2번)</span>
        {jobId ? (
          <p className="small">
            캡션을 만드는 중… {job.job?.runs.length ? `(${job.job.runs.length}번째 호출)` : ''}{' '}
            <button type="button" onClick={() => void job.cancel()}>
              취소
            </button>
          </p>
        ) : !cap ? (
          <p>
            <button type="button" className="primary" disabled={busy} onClick={() => void run(async () => setJobId(String((await post(`/api/publish/sets/${setId}/caption`, {})).jobId)))}>
              캡션 만들기
            </button>
          </p>
        ) : editing ? (
          <div className="cap-edit">
            <label className="small">
              첫 줄
              <input value={editing.hook} onChange={(e) => setEditing({ ...editing, hook: e.target.value })} />
            </label>
            <label className="small">
              핵심 줄 (한 줄에 하나)
              <textarea rows={4} value={editing.lines} onChange={(e) => setEditing({ ...editing, lines: e.target.value })} />
            </label>
            <label className="small">
              해시태그 (띄어쓰기로 구분, {settings.maxHashtags}개 넘으면 뒤는 빠져요)
              <input value={editing.hashtags} onChange={(e) => setEditing({ ...editing, hashtags: e.target.value })} />
            </label>
            <p className="actions">
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await post(`/api/publish/sets/${setId}/caption`, { hook: editing.hook, lines: editing.lines.split('\n'), hashtags: editing.hashtags.split(/\s+/).filter(Boolean) }, 'PUT');
                    setEditing(null);
                    await load();
                    setMsg({ ok: true, text: '고친 캡션을 저장했어요(직접 쓴 글이라 「소재에 없는 설명」 표시는 없어요).' });
                  })
                }
              >
                저장
              </button>
              <button type="button" onClick={() => setEditing(null)}>
                그만두기
              </button>
            </p>
          </div>
        ) : (
          <>
            <pre className="caption">{cap.text}</pre>
            {cap.glosses.map((g) => (
              <label key={g.sentence} className="gloss small">
                <input
                  type="checkbox"
                  checked={!!g.checkedAt}
                  disabled={busy}
                  onChange={(e) => void run(async () => setSt((await post(`/api/publish/sets/${setId}/caption/glosses/check`, { sentence: g.sentence, checked: e.target.checked })) as unknown as PublishState))}
                />{' '}
                확인했어요 · <mark>{g.sentence}</mark> <span className="muted">「{g.term}」 풀이 · 소재에 없는 설명이에요</span>
              </label>
            ))}
            <p className="actions">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await navigator.clipboard.writeText(cap.text);
                    setMsg({ ok: true, text: '캡션을 클립보드에 복사했어요. 인스타 업로드 창의 문구 칸에 붙여 넣으세요.' });
                  })
                }
              >
                캡션 복사
              </button>
              <button type="button" disabled={busy} onClick={() => setEditing({ hook: cap.hook, lines: cap.lines.join('\n'), hashtags: cap.hashtags.join(' ') })}>
                직접 고치기
              </button>
              <button type="button" disabled={busy} onClick={() => void run(async () => setJobId(String((await post(`/api/publish/sets/${setId}/caption`, {})).jobId)))}>
                다시 만들기
              </button>
              {cap.edited && <span className="tag">직접 고침</span>}
            </p>
          </>
        )}
      </div>

      <div className="pub-step">
        <strong>2. 소재에 없는 설명 확인</strong>{' '}
        {unchecked > 0 ? (
          <span className="status error small">확인하지 않은 설명 {unchecked}곳 — 위 카드 아래(와 캡션)의 문장을 「확인했어요」로 체크하거나 직접 고쳐 주세요.</span>
        ) : (
          <span className="status ok small">모두 확인했어요.</span>
        )}
      </div>

      <div className="pub-step">
        <strong>3. 업로드 폴더</strong>{' '}
        <span className="muted small">
          저장 위치: <code>{settings.resolved ?? settings.uploadRoot}</code>{' '}
          {rootDraft === null ? (
            <button type="button" className="link" onClick={() => setRootDraft(settings.uploadRoot)}>
              위치 바꾸기
            </button>
          ) : (
            <>
              <input value={rootDraft} onChange={(e) => setRootDraft(e.target.value)} />{' '}
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await post('/api/publish/settings', { uploadRoot: rootDraft }, 'PUT');
                    setRootDraft(null);
                    await load();
                  })
                }
              >
                저장
              </button>
            </>
          )}
        </span>
        <p className="actions">
          <button
            type="button"
            className="primary"
            disabled={busy || unchecked > 0}
            onClick={() =>
              void run(async () => {
                const b = (await post(`/api/publish/sets/${setId}/export`, {})) as { dir: string; files: string[] };
                await load();
                onChanged();
                setMsg({ ok: true, text: `업로드 폴더를 만들었어요: ${b.dir} (${b.files.length}개 파일)` });
              })
            }
          >
            업로드 폴더 만들기
          </button>
          {!cap && <span className="muted small">캡션 없이도 만들 수 있지만, 캡션.txt 가 빠져요.</span>}
        </p>
        {st.exports.map((e) => (
          <p key={e.id} className="small">
            <code>{e.path}</code> · 파일 {e.files}개{' '}
            <button type="button" disabled={busy} onClick={() => void run(async () => void (await post(`/api/publish/exports/${e.id}/open`, {})))}>
              폴더 열기
            </button>{' '}
            <PhoneShare exportId={e.id} />
          </p>
        ))}
        <p className="muted small">업로드 창에서 「업로드」 폴더의 그림을 전체 선택하면 01 → 마지막 순서로 들어가요. 캡션은 위의 「캡션 복사」로. 휴대폰 앱으로 올릴 때는 「폰으로 받기」 — 인스타에서 1번부터 순서대로 탭하세요.</p>
      </div>

      {msg && <p className={`status ${msg.ok ? 'ok' : 'error'} small`}>{msg.text}</p>}
    </section>
  );
}
