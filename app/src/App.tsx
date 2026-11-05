import { useEffect, useState } from 'react';
import { api } from './api.ts';
import { AiConnection } from './AiConnection.tsx';
import { SmokeTest } from './SmokeTest.tsx';
import { DemoMode } from './premade.tsx';
import { IdentityPage } from './identity/IdentityPage.tsx';
import { BrandPage } from './brand/BrandPage.tsx';
import { TemplatePage } from './templates/TemplatePage.tsx';
import { MakePage } from './cards/MakePage.tsx';
import { PreviewPage } from './preview/PreviewPage.tsx';
import { HomePage } from './home/HomePage.tsx';
import { ConsoleFab, ConsolePanel, type Feed } from './console/ConsolePanel.tsx';

type ServerState = { kind: 'checking' } | { kind: 'ok'; brandName: string | null } | { kind: 'error'; message: string };

type Tab = 'home' | 'identity' | 'brand' | 'template' | 'make' | 'preview' | 'check';
const TABS: Tab[] = ['home', 'identity', 'brand', 'template', 'make', 'preview', 'check'];
// 「#/make?slot=3」처럼 뒤에 값이 붙어도 그 탭으로. 첫 화면은 「오늘 올릴 것」(설계서 1장 — 계획이 없으면 그 화면이 할 일을 안내)
const tabFromHash = (): Tab => TABS.find((t) => window.location.hash.split('?')[0] === `#/${t}`) ?? 'home';

// 스크린샷(insta_auto) 처럼 왼쪽 묶음 메뉴 — 순서는 실제 흐름(정체성 → 브랜드 → 템플릿 → 만들기)
const NAV: Array<{
  group: string | null;
  items: Array<{ tab: Tab; label: string; step?: string }>;
}> = [
  { group: null, items: [{ tab: 'home', label: '오늘 올릴 것' }] },
  {
    group: '시작하기',
    items: [
      { tab: 'identity', label: '정체성', step: '1' },
      { tab: 'brand', label: '브랜드', step: '2' },
      { tab: 'template', label: '템플릿', step: '3' },
    ],
  },
  {
    group: '만들기',
    items: [
      { tab: 'make', label: '카드뉴스 만들기', step: '4' },
      { tab: 'preview', label: '30일 뒤 미리보기' },
    ],
  },
  { group: '설정', items: [{ tab: 'check', label: '점검' }] },
];

export function App() {
  const [server, setServer] = useState<ServerState>({ kind: 'checking' });
  const [tab, setTab] = useState<Tab>(tabFromHash);
  // 좁은 화면에서 작업 콘솔을 덮개로 열었는가(넓은 화면에선 늘 오른쪽에 있다)
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [running, setRunning] = useState(0);
  // 단계마다 끝냈는가(작업 콘솔이 같이 읽어 온다) — 끝낸 단계는 번호 대신 ✓
  const [progress, setProgress] = useState<Feed['progress'] | null>(null);
  // 왼쪽 위 계정 칸 — 브랜딩 키트에서 고른 이름 · 아이디 · 프로필 사진(없으면 첫 글자). 탭을 옮길 때마다 다시 읽어 방금 고른 것이 바로 보이게
  const [account, setAccount] = useState<{
    name: string | null;
    handle: string | null;
    image: string | null;
  } | null>(null);
  useEffect(() => {
    api.api.brand
      .$get()
      .then((r) => r.json())
      .then((b) =>
        setAccount({
          name: b.selection.displayName ?? null,
          handle: b.selection.handle ?? null,
          image: b.selection.profileImage ?? null,
        }),
      )
      .catch(() => setAccount(null));
  }, [tab]);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    api.api.health
      .$get()
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        setServer({ kind: 'ok', brandName: body.brand?.name ?? null });
      })
      .catch((err: unknown) => {
        setServer({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      });
  }, []);

  return (
    <div className="layout">
      <aside className="sidebar">
        <a href="#/home" className="account">
          {account?.image ? <img className="account-avatar" src={`/api/brand/assets/${account.image}`} alt="" /> : <span className="account-avatar empty">{(account?.name ?? '퍼').slice(0, 1)}</span>}
          <span className="account-text">
            <b>{account?.name ?? '퍼스트피드'}</b>
            <span className="muted small">{account?.handle ? `@${account.handle}` : '아직 브랜드 없음'}</span>
          </span>
        </a>
        <nav className="side-nav" aria-label="화면">
          {NAV.map((g) => (
            <div key={g.group ?? 'top'} className="side-group">
              {g.group && <div className="side-label">{g.group}</div>}
              {g.items.map((it) => (
                <a key={it.tab} href={`#/${it.tab}`} className={tab === it.tab ? 'on' : ''} aria-current={tab === it.tab ? 'page' : undefined}>
                  {it.step &&
                    (progress?.[it.tab as keyof Feed['progress']] ? (
                      <span className="side-step done" aria-label="끝냄">
                        ✓
                      </span>
                    ) : (
                      <span className="side-step">{it.step}</span>
                    ))}
                  {it.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <p className="side-foot muted small">"나는 누구인가"에서 "무엇이 먹혔나"까지</p>
      </aside>
      <main className="shell">
        {server.kind === 'error' && (
          <p className="status error">
            서버에 연결하지 못했습니다 ({server.message}). 터미널에서 <code>npm run dev</code> 가 실행 중인지 확인한 뒤 새로고침하세요.
          </p>
        )}
        {tab === 'home' && <HomePage />}
        {tab === 'identity' && <IdentityPage />}
        {tab === 'brand' && <BrandPage />}
        {tab === 'template' && <TemplatePage />}
        {tab === 'make' && <MakePage />}
        {tab === 'preview' && <PreviewPage />}
        {tab === 'check' && (
          <>
            <section className="card" aria-live="polite">
              <h2>로컬 서버</h2>
              {server.kind === 'checking' && <p>연결 확인 중…</p>}
              {server.kind === 'ok' && (
                <p className="status ok">
                  서버 연결됨 · 브랜드: <strong>{server.brandName ?? '(없음)'}</strong>
                </p>
              )}
            </section>
            <AiConnection />
            <DemoMode />
            <SmokeTest />
          </>
        )}
      </main>
      <ConsolePanel open={consoleOpen} onClose={() => setConsoleOpen(false)} onRunning={setRunning} onProgress={setProgress} />
      {consoleOpen && <div className="console-scrim" onClick={() => setConsoleOpen(false)} aria-hidden="true" />}
      <ConsoleFab running={running} onOpen={() => setConsoleOpen(true)} />
    </div>
  );
}
