// 설정 화면의 줄들 — 상태 배지 · 키 · 토큰 한 줄(저장 · 지우기) · Claude 연결 상태 · 티스토리 · 리틀리 로그인 한 줄
import { useState } from 'react';
import { blogCall, JobSteps, useBlogJob } from '../blog/useBlogJob.tsx';
import { localTime } from '../time.ts';
import type { Claude, LoginSite, SecretItem, Secrets } from './settingsTypes.ts';

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'off'; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/** 키 · 토큰 한 줄 — 저장된 상태 / 입력 / 저장 · 지우기 */
export function SecretRow({ item, hint, placeholder, onSaved, extra }: { item: SecretItem; hint: React.ReactNode; placeholder: string; onSaved: (s: Secrets & { claude?: Claude | null }) => void; extra?: React.ReactNode }) {
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

export function ClaudeStatus({ c }: { c: Claude | null }) {
  if (!c) return <Badge tone="off">확인하는 중…</Badge>;
  if (!c.installed) return <Badge tone="warn">설치 안 됨</Badge>;
  // 토큰은 `claude auth status` 가 겉모양만 본다(가짜 토큰도 「로그인됨」 — 2026-11-20 실제로 확인) → 「설정됨」까지만 말하고 실제 호출은 시험 호출로
  if (c.loggedIn && c.supported && c.authMethod === 'oauth_token') return <Badge tone="warn">토큰 설정됨 · 시험 호출 전</Badge>;
  if (c.loggedIn && c.supported) return <Badge tone="ok">연결됨 · 구독{c.subscription ? ` ${c.subscription}` : ''}</Badge>;
  if (c.loggedIn) return <Badge tone="warn">구독이 아닌 방식이라 막음</Badge>;
  return <Badge tone="warn">로그인 필요</Badge>;
}

/** 티스토리 · 리틀리 한 줄 — 로그인 기록 / 지금 로그인 / 로그아웃 */
export function LoginRow({ s, onChanged, children }: { s: LoginSite; onChanged: () => void; children?: React.ReactNode }) {
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
