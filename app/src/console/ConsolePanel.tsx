// 작업 콘솔 (사용자 지시 2026-11-05 · insta_auto 의 오른쪽 칸 참고): 지금 도는 AI 작업과 지금까지 한 일을 한 줄씩.
// 어느 화면에서 시작했든 여기서 보이고, 다른 화면으로 옮겨도 진행 상황 · 취소가 남는다. 줄을 누르면 그 결과가 있는 화면으로.
// 시간은 실제로 흐른 시간만 보인다(남은 시간 짐작 없음 — 결정 2026-10-24)
import { useCallback, useEffect, useRef, useState } from 'react';
import { onChanged } from '../changed.ts';
import type { InferResponseType } from 'hono/client';
import { api } from '../api.ts';
import { stageText, taskLabel, type Stage } from '../jobStage.ts';
import { localTime } from '../time.ts';

export type Feed = InferResponseType<typeof api.api.console.$get>;
type Item = Feed['items'][number];
type Filter = 'all' | 'ai' | 'failed';

const ICON: Record<Item['status'], string> = {
  done: '✓',
  failed: '!',
  cancelled: '■',
  blocked: '!',
  needs_edit: '✎',
};
const STATUS: Record<Item['status'], string> = { done: '완료', failed: '실패', cancelled: '취소함', blocked: '막음', needs_edit: '직접 고칠 것 있음' };
const isProblem = (s: Item['status']) => s === 'failed' || s === 'blocked' || s === 'needs_edit';
const KIND: Record<Item['kind'], string> = {
  ai: 'AI',
  template: '템플릿',
  export: '업로드 폴더',
  chat_apply: '적용',
};

const COLLAPSE_KEY = 'firstfeed.console.collapsed';
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

const secs = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)}초` : `${Math.floor(ms / 60_000)}분 ${Math.round((ms % 60_000) / 1000)}초`);
const kTok = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function meta(it: Item): string {
  const a = it.ai;
  if (!a) return '';
  const parts = [`AI ${a.calls}번`];
  if (a.rewrites > 0) parts.push(`다시 쓰기 ${a.rewrites}번`);
  if (a.durationMs != null) parts.push(secs(a.durationMs));
  if (a.inputTokens != null && a.outputTokens != null) parts.push(`토큰 ${kTok(a.inputTokens)} → ${kTok(a.outputTokens)}`);
  return parts.join(' · ');
}

function Running({ r, now, onCancel }: { r: Feed['running'][number]; now: number; onCancel: (id: string) => void }) {
  const t = stageText(r.stage as Stage | null);
  return (
    <li className="con-run">
      <div className="con-row">
        <span className="stage-dot" aria-hidden="true" />
        <b>{taskLabel(r.task)}</b>
        <span className="con-time">{secs(Math.max(0, now - Date.parse(r.startedAt)))}</span>
      </div>
      {t && <div className="small con-stage">{t.text}</div>}
      {t?.reasons.length ? (
        <ul className="stage-reasons">
          {t.reasons.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="small" onClick={() => onCancel(r.jobId)}>
        취소
      </button>
    </li>
  );
}

export function ConsolePanel({ open, onClose, onRunning, onProgress }: { open: boolean; onClose: () => void; onRunning: (n: number) => void; onProgress: (p: Feed['progress']) => void }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [now, setNow] = useState(() => Date.now());
  // 방금 끝난 작업을 잠깐 표시 — 진행 중이던 것이 사라지면 어디로 갔는지 보이게
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const prevRunning = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const r = await api.api.console.$get();
      if (!r.ok) throw new Error(String(r.status));
      const f = await r.json();
      const nowRunning = new Set(f.running.map((x) => x.jobId));
      const ended = [...prevRunning.current].filter((id) => !nowRunning.has(id)).map((id) => `ai:${id}`);
      prevRunning.current = nowRunning;
      if (ended.length) {
        setFresh((s) => new Set([...s, ...ended]));
        setTimeout(() => setFresh((s) => new Set([...s].filter((k) => !ended.includes(k)))), 8000);
      }
      setFeed(f);
      onProgress(f.progress);
      setError(false);
    } catch {
      setError(true);
    }
  }, [onProgress]);

  const runningCount = feed?.running.length ?? 0;
  useEffect(() => onRunning(runningCount), [onRunning, runningCount]);
  // 도는 작업이 있으면 자주, 없으면 가끔 — 다른 화면에서 시작한 작업도 곧 나타나게
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), runningCount > 0 ? 1500 : 6000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    window.addEventListener('hashchange', onFocus);
    const off = onChanged(onFocus);
    return () => {
      off();
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('hashchange', onFocus);
    };
  }, [load, runningCount]);
  useEffect(() => {
    if (runningCount === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [runningCount]);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* 저장 못 해도 지금 화면에선 접힌다 */
      }
      return !c;
    });
  };
  const cancel = async (jobId: string) => {
    await api.api.ai.jobs[':jobId'].cancel.$post({ param: { jobId } });
    void load();
  };

  const items = (feed?.items ?? []).filter((it) => (filter === 'ai' ? it.kind === 'ai' : filter === 'failed' ? isProblem(it.status) : true));
  const failedCount = (feed?.items ?? []).filter((it) => isProblem(it.status)).length;

  if (collapsed && !open)
    return (
      <aside className="console collapsed" aria-label="작업 콘솔">
        <button type="button" className="con-rail" onClick={toggle} title="작업 콘솔 펼치기">
          <span aria-hidden="true">‹</span>
          <span className="con-rail-label">작업 콘솔</span>
          {runningCount > 0 && <span className="con-count">{runningCount}</span>}
        </button>
      </aside>
    );

  return (
    <aside className={`console${open ? ' open' : ''}`} aria-label="작업 콘솔">
      <div className="con-head">
        <h2>작업 콘솔</h2>
        <button type="button" className="small con-collapse" onClick={open ? onClose : toggle}>
          {open ? '닫기' : '접기 ›'}
        </button>
      </div>
      {error && <p className="status error small">작업 기록을 불러오지 못했어요. 서버가 켜져 있는지 확인하세요.</p>}

      <section aria-live="polite">
        <div className="con-label">지금 도는 것</div>
        {runningCount === 0 ? (
          <p className="muted small con-empty">없음 — AI 작업을 시작하면 어느 화면에서든 여기에 보여요.</p>
        ) : (
          <ul className="con-list">
            {feed!.running.map((r) => (
              <Running key={r.jobId} r={r} now={now} onCancel={(id) => void cancel(id)} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="con-label con-label-row">
          <span>한 일</span>
          <span className="con-filters" role="group" aria-label="거르기">
            {(
              [
                ['all', '전체'],
                ['ai', 'AI'],
                ['failed', `확인 필요 ${failedCount}`],
              ] as const
            ).map(([f, l]) => (
              <button key={f} type="button" className={`chip-toggle${filter === f ? ' on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {l}
              </button>
            ))}
          </span>
        </div>
        {feed && items.length === 0 && <p className="muted small con-empty">{filter === 'failed' ? '확인할 것이 없어요.' : '아직 한 일이 없어요. 정체성부터 시작해 보세요.'}</p>}
        <ul className="con-list">
          {items.map((it) => {
            const body = (
              <>
                <div className="con-row">
                  <span className={`con-icon ${it.status}`} aria-label={STATUS[it.status]}>
                    {ICON[it.status]}
                  </span>
                  <b className="con-title">{it.kind === 'ai' && it.task ? taskLabel(it.task) : KIND[it.kind]}</b>
                  {fresh.has(it.key) && <span className="con-fresh">방금</span>}
                  <span className="con-time">{localTime(it.at).slice(5)}</span>
                </div>
                {it.title && <div className="small con-result">{it.title}</div>}
                {it.detail && <div className={`small con-detail${it.kind === 'export' ? ' mono' : ''}`}>{it.detail}</div>}
                {it.ai && <div className="small muted">{meta(it)}</div>}
                {it.ai?.reasons.length ? (
                  <details className="small con-reasons">
                    <summary>{it.status === 'done' ? '다시 쓴 이유' : '걸린 이유'}</summary>
                    <ul>
                      {it.ai.reasons.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </>
            );
            return (
              <li key={it.key} className={`con-item ${it.status}${fresh.has(it.key) ? ' fresh' : ''}`}>
                {it.href ? (
                  <a href={it.href} className="con-link" onClick={open ? onClose : undefined}>
                    {body}
                  </a>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}

/** 좁은 화면에서 콘솔을 여는 단추 — 도는 작업 수를 같이(숫자는 ConsolePanel 이 읽은 것) */
export function ConsoleFab({ running, onOpen }: { running: number; onOpen: () => void }) {
  return (
    <button type="button" className="console-fab primary" onClick={onOpen}>
      작업 콘솔{running > 0 && <span className="con-count">{running}</span>}
    </button>
  );
}
