// 설정 「AI 연결」: 공급자별 설치·로그인 상태와 다음 행동 안내 (FR-AI-1)
import { useEffect, useState } from 'react';
import type { InferResponseType } from 'hono/client';
import { api } from './api.ts';

type Detect = InferResponseType<typeof api.api.ai.providers.$get>;

async function fetchProviders(): Promise<Detect> {
  const res = await api.api.ai.providers.$get();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function yesNo(v: boolean | null): string {
  return v === null ? '—' : v ? '예' : '아니오';
}

export function AiConnection() {
  const [data, setData] = useState<Detect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [round, setRound] = useState(0);

  // 상태 변경은 응답이 온 뒤의 콜백에서만 한다 — effect 본문에서 바로 바꾸면 연쇄 렌더링이 생긴다
  useEffect(() => {
    let stale = false;
    fetchProviders()
      .then((d) => {
        if (stale) return;
        setData(d);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!stale) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!stale) setChecking(false);
      });
    return () => {
      stale = true;
    };
  }, [round]);

  const recheck = () => {
    setChecking(true);
    setRound((r) => r + 1);
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>AI 연결</h2>
        <button type="button" onClick={recheck} disabled={checking}>
          {checking ? '확인 중…' : '다시 확인'}
        </button>
      </div>
      {error && <p className="status error">상태를 불러오지 못했습니다 ({error}). 서버가 켜져 있는지 확인한 뒤 [다시 확인]을 누르세요.</p>}
      {data && (
        <>
          <table className="providers">
            <thead>
              <tr>
                <th>공급자</th>
                <th>설치</th>
                <th>로그인</th>
                <th>구독</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {data.providers.map((p) => {
                const ready = p.supported && p.installed && p.loggedIn === true;
                return (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      {p.version && <span className="muted"> {p.version}</span>}
                    </td>
                    <td>{yesNo(p.installed)}</td>
                    <td>{yesNo(p.loggedIn)}</td>
                    <td>{p.subscription ?? '—'}</td>
                    <td className={ready ? 'ok' : 'muted'}>{ready ? '사용 가능' : (p.hint ?? '사용 불가')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.hint && <p className="status error">{data.hint}</p>}
        </>
      )}
    </section>
  );
}
