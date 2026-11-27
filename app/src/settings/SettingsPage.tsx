// 설정 탭 (사용자 지시 2026-11-20 「설정탭에서 로그인 토큰 저장해놓기, ui도 실제 서비스 수준으로」).
// 묶음: AI 연결(Claude 구독 토큰) · 연결된 계정(Metricool 성과 · 티스토리 · 리틀리 로그인 유지) · API 키(Fish Audio) · 업로드 · 화면.
// 키 · 토큰은 서버가 OS 키체인에 저장하고 화면에는 끝 4자리만 돌아온다. 이 화면은 값을 들고 있지 않는다(보내고 나면 칸을 비운다)
import { useCallback, useEffect, useState } from 'react';
import { blogCall } from '../blog/useBlogJob.tsx';
import type { ThemeChoice } from '../theme.ts';
import type { Claude, LoginSite, SecretItem, Secrets } from './settingsTypes.ts';
import { ClaudeStatus, LoginRow, SecretRow } from './settingsRows.tsx';
import { MetricoolRow } from './MetricoolRow.tsx';

const KEYCHAIN_NAME = { macos: 'macOS 키체인', windows: 'Windows 자격 증명 관리자', linux: '로그인 키링(libsecret)' } as const;
const SECTIONS = [
  { id: 'set-ai', label: 'AI 연결' },
  { id: 'set-accounts', label: '연결된 계정' },
  { id: 'set-keys', label: 'API 키' },
  { id: 'set-publish', label: '업로드' },
  { id: 'set-look', label: '화면' },
];

export function SettingsPage({ theme, setTheme }: { theme: ThemeChoice; setTheme: (t: ThemeChoice) => void }) {
  const [secrets, setSecrets] = useState<Secrets | null>(null);
  const [claude, setClaude] = useState<Claude | null>(null);
  const [checking, setChecking] = useState(false);
  const [logins, setLogins] = useState<LoginSite[]>([]);
  const [blog, setBlog] = useState<{ tistory: string | null; visibility: 'public' | 'private' } | null>(null);
  const [blogInput, setBlogInput] = useState('');
  const [upload, setUpload] = useState<{ uploadRoot: string; resolved: string | null } | null>(null);
  const [uploadInput, setUploadInput] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const checkClaude = useCallback(async () => {
    setChecking(true);
    const r = await blogCall<{ claude: Claude }>('POST', '/api/settings/claude/verify');
    setChecking(false);
    if (r.ok) setClaude(r.data.claude);
  }, []);
  const loadLogins = useCallback(() => void blogCall<{ sites: LoginSite[] }>('GET', '/api/blog/logins').then((r) => r.ok && setLogins(r.data.sites)), []);
  useEffect(() => {
    void blogCall<Secrets>('GET', '/api/settings/secrets').then((r) => r.ok && setSecrets(r.data));
    void blogCall<{ claude: Claude }>('POST', '/api/settings/claude/verify').then((r) => r.ok && setClaude(r.data.claude));
    loadLogins();
    void blogCall<{ tistory: string | null; visibility: 'public' | 'private' }>('GET', '/api/blog/settings').then((r) => r.ok && setBlog(r.data));
    void blogCall<{ uploadRoot: string; resolved: string | null }>('GET', '/api/publish/settings').then((r) => {
      if (r.ok) {
        setUpload(r.data);
        setUploadInput(r.data.uploadRoot);
      }
    });
  }, [loadLogins]);

  const saveBlog = async (patch: { tistory?: string | null; visibility?: 'public' | 'private' }) => {
    const r = await blogCall<{ tistory: string | null; visibility: 'public' | 'private' }>('PUT', '/api/blog/settings', patch);
    if (r.ok) {
      setBlog(r.data);
      setBlogInput('');
      loadLogins();
    }
    setMsg(r.ok ? { ok: true, text: '저장했어요.' } : { ok: false, text: r.data.error ?? '저장하지 못했어요.' });
  };
  const saveUpload = async () => {
    const r = await blogCall<{ resolved: string }>('PUT', '/api/publish/settings', { uploadRoot: uploadInput });
    if (r.ok) setUpload({ uploadRoot: uploadInput, resolved: r.data.resolved });
    setMsg(r.ok ? { ok: true, text: '업로드 위치를 바꿨어요.' } : { ok: false, text: r.data.error ?? '바꾸지 못했어요.' });
  };
  const item = (n: SecretItem['name']) => secrets?.items.find((i) => i.name === n);

  return (
    <div className="settings">
      <header className="settings-head">
        <h1>설정</h1>
        <p className="muted">AI 연결 · 계정 로그인 · 키를 한 곳에서. 키와 토큰은 이 컴퓨터의 {secrets ? KEYCHAIN_NAME[secrets.keychain.kind] : '키체인'}에만 저장돼요.</p>
        <nav className="settings-nav" aria-label="설정 묶음">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} onClick={(e) => (e.preventDefault(), document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))}>
              {s.label}
            </a>
          ))}
        </nav>
      </header>
      {secrets && !secrets.keychain.ok && <p className="status error">키체인을 쓸 수 없어 키 · 토큰을 저장할 수 없어요. {secrets.keychain.hint}</p>}
      {msg && <p className={`status small ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</p>}

      <section id="set-ai" className="card set-group">
        <h2>AI 연결</h2>
        <div className="set-row">
          <div className="set-label">
            <div className="set-title">
              Claude Code <ClaudeStatus c={claude} />
            </div>
            <div className="set-desc">
              {claude?.version ? `버전 ${claude.version}` : '버전 확인 중'}
              {claude?.authMethod ? ` · 인증 ${claude.authMethod === 'claude.ai' ? 'claude.ai 로그인' : claude.authMethod === 'oauth_token' ? 'OAuth 토큰' : claude.authMethod}` : ''}
              {claude?.hint ? <span className="block">{claude.hint}</span> : null}
            </div>
          </div>
          <div className="set-actions">
            <button type="button" className="small" disabled={checking} onClick={() => void checkClaude()}>
              {checking ? '확인하는 중…' : '다시 확인'}
            </button>
          </div>
        </div>
        {item('claude.oauthToken') && (
          <SecretRow
            item={item('claude.oauthToken')!}
            placeholder="sk-ant-oat01-…"
            hint={
              <>
                터미널에서 <code>claude setup-token</code> 을 실행하면 나오는 구독 토큰이에요. 넣어 두면 터미널에서 따로 로그인하지 않아도 이 앱이 내 구독으로 AI 를 불러요. 구독이 아닌 요금으로 나갈 수 있는 키(API 키)는 받지 않아요.
                <span className="block">
                  토큰이 맞는지는 실제로 한 번 불러 봐야 알 수 있어요 — 저장한 뒤 <a href="#/check">점검 → AI 시험 호출</a>로 확인하세요.
                </span>
              </>
            }
            onSaved={(s) => {
              setSecrets(s);
              if (s.claude) setClaude(s.claude);
              else void checkClaude();
            }}
          />
        )}
      </section>

      <section id="set-accounts" className="card set-group">
        <h2>연결된 계정</h2>
        <MetricoolRow />
        {logins.map((s) => (
          <LoginRow key={s.site} s={s} onChanged={loadLogins}>
            {s.site === 'tistory' && blog && (
              <div className="set-inline">
                {blog.tistory ? (
                  <>
                    <span>
                      블로그 <b>{blog.tistory}.tistory.com</b>
                    </span>
                    <button type="button" className="link" onClick={() => void saveBlog({ tistory: null })}>
                      바꾸기
                    </button>
                    <label className="small">
                      공개 범위{' '}
                      <select value={blog.visibility} onChange={(e) => void saveBlog({ visibility: e.target.value as 'public' | 'private' })}>
                        <option value="public">공개</option>
                        <option value="private">비공개</option>
                      </select>
                    </label>
                  </>
                ) : (
                  <form
                    className="set-inline"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveBlog({ tistory: blogInput });
                    }}
                  >
                    <input value={blogInput} onChange={(e) => setBlogInput(e.target.value)} placeholder="블로그 주소 또는 이름" aria-label="티스토리 블로그 주소" />
                    <button type="submit" className="small">
                      저장
                    </button>
                  </form>
                )}
              </div>
            )}
          </LoginRow>
        ))}
      </section>

      <section id="set-keys" className="card set-group">
        <h2>API 키</h2>
        {item('fish.apiKey') && (
          <SecretRow item={item('fish.apiKey')!} placeholder="Fish Audio API 키" hint="릴스 음성(문장별 읽기)에 쓰는 키예요. 키는 이 컴퓨터 밖으로는 Fish Audio 에만 보내요. 키가 맞는지는 첫 음성 만들기 때 확인해요." onSaved={setSecrets} />
        )}
      </section>

      <section id="set-publish" className="card set-group">
        <h2>업로드</h2>
        <div className="set-row">
          <div className="set-label">
            <div className="set-title">업로드 폴더 위치</div>
            <div className="set-desc">카드 그림 · 캡션을 담을 폴더를 만드는 곳이에요. 「~」 는 내 홈 폴더.{upload?.resolved ? <span className="block">지금: {upload.resolved}</span> : null}</div>
          </div>
          <div className="set-control">
            <form
              className="set-inline"
              onSubmit={(e) => {
                e.preventDefault();
                void saveUpload();
              }}
            >
              <input value={uploadInput} onChange={(e) => setUploadInput(e.target.value)} aria-label="업로드 폴더 위치" />
              <button type="submit" className="small" disabled={!uploadInput.trim() || uploadInput === upload?.uploadRoot}>
                바꾸기
              </button>
            </form>
          </div>
        </div>
      </section>

      <section id="set-look" className="card set-group">
        <h2>화면</h2>
        <div className="set-row">
          <div className="set-label">
            <div className="set-title">바탕</div>
            <div className="set-desc">「시스템」은 컴퓨터 설정을 따라가요. 이 브라우저에만 저장돼요.</div>
          </div>
          <div className="set-control">
            <div className="seg" role="radiogroup" aria-label="바탕">
              {(['system', 'light', 'dark'] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={theme === t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>
                  {t === 'system' ? '시스템' : t === 'light' ? '밝게' : '어둡게'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="set-row">
          <div className="set-label">
            <div className="set-title">점검</div>
            <div className="set-desc">로컬 서버 · Claude Code · AI 시험 호출을 한 번에 확인해요.</div>
          </div>
          <div className="set-control">
            <a className="button small" href="#/check">
              점검 열기
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
