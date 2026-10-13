import { useEffect, useState } from 'react';
import { api } from './api.ts';
import { AiConnection } from './AiConnection.tsx';
import { SmokeTest } from './SmokeTest.tsx';

type ServerState =
  | { kind: 'checking' }
  | { kind: 'ok'; brandName: string | null }
  | { kind: 'error'; message: string };

export function App() {
  const [server, setServer] = useState<ServerState>({ kind: 'checking' });

  useEffect(() => {
    api.api.health
      .$get()
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        setServer({ kind: 'ok', brandName: body.brand?.name ?? null });
      })
      .catch((err: unknown) => {
        setServer({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      });
  }, []);

  return (
    <main className="shell">
      <header>
        <h1>퍼스트피드</h1>
        <p className="tagline">"나는 누구인가"에서 "무엇이 먹혔나"까지</p>
      </header>
      <section className="card" aria-live="polite">
        <h2>로컬 서버</h2>
        {server.kind === 'checking' && <p>연결 확인 중…</p>}
        {server.kind === 'ok' && (
          <p className="status ok">
            서버 연결됨 · 브랜드: <strong>{server.brandName ?? '(없음)'}</strong>
          </p>
        )}
        {server.kind === 'error' && (
          <p className="status error">
            서버에 연결하지 못했습니다 ({server.message}). 터미널에서 <code>npm run dev</code> 가 실행 중인지 확인한 뒤
            새로고침하세요.
          </p>
        )}
      </section>
      <AiConnection />
      <SmokeTest />
    </main>
  );
}
