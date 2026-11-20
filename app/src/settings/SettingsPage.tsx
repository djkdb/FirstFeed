// 설정 탭 (사용자 지시 2026-11-20 「설정탭에서 로그인 토큰 저장해놓기, ui도 실제 서비스 수준으로」).
// 묶음: AI 연결(Claude 구독 토큰) · 연결된 계정(티스토리 · 리틀리 로그인 유지) · API 키(Fish Audio) · 업로드 · 화면.
// 키 · 토큰은 서버가 OS 키체인에 저장하고 화면에는 끝 4자리만 돌아온다. 이 화면은 값을 들고 있지 않는다(보내고 나면 칸을 비운다)
import { useCallback, useEffect, useState } from 'react';
import { blogCall, JobSteps, useBlogJob } from '../blog/useBlogJob.tsx';
import type { ThemeChoice } from '../theme.ts';
import { localTime } from '../time.ts';

interface SecretItem {
  name: 'claude.oauthToken' | 'fish.apiKey';
  label: string;
  saved: boolean;
  tail: string | null;
}
interface Secrets {
  keychain: { kind: 'macos' | 'windows' | 'linux'; ok: boolean; hint?: string };
  items: SecretItem[];
}
interface Claude {
  installed: boolean;
  version: string | null;
  loggedIn: boolean | null;
  authMethod: string | null;
  subscription: string | null;
  supported: boolean;
  hint: string | null;
}
interface LoginSite {
  site: 'tistory' | 'litly';
  label: string;
  saved: boolean;
  savedAt: string | null;
  needs: string | null;
}

const KEYCHAIN_NAME = { macos: 'macOS 키체인', windows: 'Windows 자격 증명 관리자', linux: '로그인 키링(libsecret)' } as const;
const SECTIONS = [
  { id: 'set-ai', label: 'AI 연결' },
  { id: 'set-accounts', label: '연결된 계정' },
  { id: 'set-keys', label: 'API 키' },
  { id: 'set-publish', label: '업로드' },
  { id: 'set-look', label: '화면' },
];

function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'off'; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/** 키 · 토큰 한 줄 — 저장된 상태 / 입력 / 저장 · 지우기 */
function SecretRow({ item, hint, placeholder, onSaved, extra }: { item: SecretItem; hint: React.ReactNode; placeholder: string; onSaved: (s: Secrets & { claude?: Claude | null }) => void; extra?: React.ReactNode }) {
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(!item.saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    setBusy(true);
    setMsg(null);
    const r = await blogCall<Secrets & { claude?: Claude | null }>('PUT', `/api/settings/secrets/${item.name}`, { value });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.data.error ?? '저장하지 못했어요.' });
    setValue('');
    setEditing(false);
    setMsg({ ok: true, text: '키체인에 저장했어요.' });
    onSaved(r.data);
  };
  const remove = async () => {
    if (!window.confirm(`${item.label}을(를) 키체인에서 지울까요?`)) return;
    setBusy(true);
    const r = await blogCall<Secrets>('DELETE', `/api/settings/secrets/${item.name}`);
    setBusy(false);
    if (r.ok) {
      setEditing(true);
      setMsg({ ok: true, text: '지웠어요.' });
      onSaved(r.data);
    }
  };
  return (
    <div className="set-row">
      <div className="set-label">
        <div className="set-title">
          {item.label} {item.saved ? <Badge tone="ok">저장됨 · {item.tail}</Badge> : <Badge tone="off">없음</Badge>}
        </div>
        <div className="set-desc">{hint}</div>
      </div>
      <div className="set-control">
        {editing ? (
          <form
            className="secret-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="secret-input">
              <input type={show ? 'text' : 'password'} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} autoComplete="off" spellCheck={false} aria-label={`${item.label} 붙여 넣기`} />
              <button type="button" className="secret-eye" onClick={() => setShow((x) => !x)} aria-label={show ? '가리기' : '보기'}>
                {show ? '가리기' : '보기'}
              </button>
            </div>
            <div className="set-actions">
              <button type="submit" className="primary small" disabled={busy || !value.trim()}>
                {busy ? '저장하는 중…' : '저장'}
              </button>
              {item.saved && (
                <button type="button" className="small ghost" onClick={() => (setEditing(false), setValue(''))}>
                  취소
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="set-actions">
            <button type="button" className="small" onClick={() => setEditing(true)}>
              바꾸기
            </button>
            <button type="button" className="small ghost" disabled={busy} onClick={() => void remove()}>
              지우기
            </button>
            {extra}
          </div>
        )}
        {msg && <p className={`status small ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</p>}
      </div>
    </div>
  );
}

function ClaudeStatus({ c }: { c: Claude | null }) {
  if (!c) return <Badge tone="off">확인하는 중…</Badge>;
  if (!c.installed) return <Badge tone="warn">설치 안 됨</Badge>;
  // 토큰은 `claude auth status` 가 겉모양만 본다(가짜 토큰도 「로그인됨」 — 2026-11-20 실제로 확인) → 「설정됨」까지만 말하고 실제 호출은 시험 호출로
  if (c.loggedIn && c.supported && c.authMethod === 'oauth_token') return <Badge tone="warn">토큰 설정됨 · 시험 호출 전</Badge>;
  if (c.loggedIn && c.supported) return <Badge tone="ok">연결됨 · 구독{c.subscription ? ` ${c.subscription}` : ''}</Badge>;
  if (c.loggedIn) return <Badge tone="warn">구독이 아닌 방식이라 막음</Badge>;
  return <Badge tone="warn">로그인 필요</Badge>;
}

/** 티스토리 · 리틀리 한 줄 — 로그인 기록 / 지금 로그인 / 로그아웃 */
function LoginRow({ s, onChanged, children }: { s: LoginSite; onChanged: () => void; children?: React.ReactNode }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const job = useBlogJob(jobId, () => onChanged());
  const login = async () => {
    setMsg(null);
    const r = await blogCall<{ jobId: string }>('POST', `/api/blog/logins/${s.site}`);
    if (r.ok) setJobId(r.data.jobId);
    else setMsg(r.data.error ?? '시작하지 못했어요.');
  };
  const logout = async () => {
    if (!window.confirm(`${s.label} 로그인 기록을 이 앱에서 지울까요? 다음 발행 때 다시 로그인해야 해요.`)) return;
    await blogCall('DELETE', `/api/blog/logins/${s.site}`);
    onChanged();
  };
  const running = job?.phase === 'running';
  return (
    <div className="set-row">
      <div className="set-label">
        <div className="set-title">
          {s.label} {s.saved ? <Badge tone="ok">로그인 저장됨{s.savedAt ? ` · ${localTime(s.savedAt)}` : ''}</Badge> : <Badge tone="off">로그인 기록 없음</Badge>}
        </div>
        <div className="set-desc">{s.site === 'tistory' ? '「티스토리에 발행」에서 쓰는 로그인이에요.' : '「리틀리 열어 채우기」에서 쓰는 로그인이에요.'} 로그인은 이 앱 전용 창에만 남고, 비밀번호는 앱이 받지 않아요.</div>
        {children}
      </div>
      <div className="set-control">
        <div className="set-actions">
          <button type="button" className="small" disabled={running || !!s.needs} onClick={() => void login()}>
            {running ? '로그인 기다리는 중…' : s.saved ? '다시 로그인' : '지금 로그인'}
          </button>
          {s.saved && (
            <button type="button" className="small ghost" disabled={running} onClick={() => void logout()}>
              로그아웃
            </button>
          )}
        </div>
        {s.needs && <p className="muted small">{s.needs}</p>}
        {msg && <p className="status error small">{msg}</p>}
        <JobSteps job={job} onCancel={() => void blogCall('POST', `/api/blog/jobs/${jobId}/cancel`)} />
      </div>
    </div>
  );
}

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
