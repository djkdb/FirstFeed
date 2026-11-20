// OS 키체인 (CLAUDE.md 결정 2026-10-13: 사용자가 앱 화면에서 넣는 키 · 토큰은 OS 키체인 — .env · DB · 파일에 두지 않는다).
// 운영체제가 가진 도구만 쓴다(새 의존성 없음): macOS `security` · Windows PasswordVault(PowerShell) · Linux `secret-tool`(libsecret).
// 값은 늘 표준 입력으로 넘긴다 — 명령줄 인자는 같은 컴퓨터의 다른 프로그램이 프로세스 목록에서 볼 수 있어서.
// 키체인 도구가 없으면 저장하지 않고 알린다(평문 파일로 물러서지 않는다)
import { runProcess } from '../lib/process.ts';

const SERVICE = 'FirstFeed';
const TIMEOUT = 15_000;

export interface Keychain {
  kind: 'macos' | 'windows' | 'linux';
  /** 이 컴퓨터에서 쓸 수 있나 — 못 쓰면 이유와 할 일 */
  check(): Promise<{ ok: true } | { ok: false; hint: string }>;
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  remove(name: string): Promise<void>;
}

export class KeychainError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = 'KeychainError';
    this.hint = hint;
  }
}

/** 이름은 코드가 정한 목록만(./store.ts) — 명령에 그대로 들어가서 모양을 좁힌다 */
const NAME = /^[a-z][A-Za-z0-9.]{1,40}$/;
function checkName(n: string): void {
  if (!NAME.test(n)) throw new Error(`키체인 이름 모양이 아닙니다: ${n}`);
}
/** 값은 한 줄 · 따옴표 · 역슬래시 없음 · 4KB 이하(토큰 · 키 모양). macOS 대화형 명령 한 줄에 넣어서 */
export function checkValue(v: string): string | null {
  if (!v) return '빈 값이에요.';
  if (v.length > 4096) return '너무 길어요(4,096자 이하).';
  if (/[\s"'\\]/.test(v)) return '공백 · 줄바꿈 · 따옴표 · 역슬래시가 들어 있어요. 앞뒤를 다시 복사해 붙여 넣으세요.';
  return null;
}

const fail = (what: string, stderr: string) => new KeychainError(`키체인에 ${what} 못했습니다.`, `운영체제 키체인이 잠겨 있거나 거절했을 수 있어요(${stderr.trim().slice(0, 120) || '자세한 이유 없음'}). 잠금을 풀고 다시 하세요.`);

export const macKeychain: Keychain = {
  kind: 'macos',
  async check() {
    const r = await runProcess('security', ['help'], { timeoutMs: TIMEOUT });
    return r.notFound ? { ok: false, hint: 'macOS 의 security 도구를 찾지 못했어요.' } : { ok: true };
  },
  async get(name) {
    checkName(name);
    const r = await runProcess('security', ['find-generic-password', '-s', SERVICE, '-a', name, '-w'], { timeoutMs: TIMEOUT });
    return r.code === 0 ? r.stdout.replace(/\n$/, '') : null;
  },
  async set(name, value) {
    checkName(name);
    // `security -i` 는 표준 입력의 명령을 한 줄씩 실행한다 — 값이 프로세스 목록에 남지 않게
    const r = await runProcess('security', ['-i'], { timeoutMs: TIMEOUT, stdin: `add-generic-password -U -s "${SERVICE}" -a "${name}" -w "${value}"\n` });
    if (r.code !== 0 || /error/i.test(r.stderr)) throw fail('저장하지', r.stderr);
  },
  async remove(name) {
    checkName(name);
    await runProcess('security', ['delete-generic-password', '-s', SERVICE, '-a', name], { timeoutMs: TIMEOUT });
  },
};

const PS_VAULT = "[void][Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime];$v=New-Object Windows.Security.Credentials.PasswordVault;";
export const winKeychain: Keychain = {
  kind: 'windows',
  async check() {
    const r = await runProcess('powershell', ['-NoProfile', '-NonInteractive', '-Command', `${PS_VAULT}'ok'`], { timeoutMs: TIMEOUT });
    return r.code === 0 ? { ok: true } : { ok: false, hint: 'Windows 자격 증명 보관함(PasswordVault)을 열지 못했어요. Windows PowerShell 이 있는지 확인하세요.' };
  },
  async get(name) {
    checkName(name);
    const r = await runProcess('powershell', ['-NoProfile', '-NonInteractive', '-Command', `${PS_VAULT}try{$c=$v.Retrieve('${SERVICE}','${name}');$c.RetrievePassword();[Console]::Out.Write($c.Password)}catch{exit 3}`], { timeoutMs: TIMEOUT });
    return r.code === 0 ? r.stdout : null;
  },
  async set(name, value) {
    checkName(name);
    const r = await runProcess(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', `${PS_VAULT}$s=[Console]::In.ReadToEnd().Trim();try{$v.Remove($v.Retrieve('${SERVICE}','${name}'))}catch{};$v.Add((New-Object Windows.Security.Credentials.PasswordCredential('${SERVICE}','${name}',$s)))`],
      { timeoutMs: TIMEOUT, stdin: value },
    );
    if (r.code !== 0) throw fail('저장하지', r.stderr);
  },
  async remove(name) {
    checkName(name);
    await runProcess('powershell', ['-NoProfile', '-NonInteractive', '-Command', `${PS_VAULT}try{$v.Remove($v.Retrieve('${SERVICE}','${name}'))}catch{}`], { timeoutMs: TIMEOUT });
  },
};

export const linuxKeychain: Keychain = {
  kind: 'linux',
  async check() {
    const r = await runProcess('secret-tool', ['--version'], { timeoutMs: TIMEOUT });
    if (r.notFound) return { ok: false, hint: '이 컴퓨터에 키체인 도구(secret-tool)가 없어요. 「libsecret-tools」를 설치하고 로그인 키링을 켠 뒤 다시 하세요. 키는 평문 파일로 저장하지 않아요.' };
    return { ok: true };
  },
  async get(name) {
    checkName(name);
    const r = await runProcess('secret-tool', ['lookup', 'service', SERVICE, 'account', name], { timeoutMs: TIMEOUT });
    return r.code === 0 && r.stdout ? r.stdout.replace(/\n$/, '') : null;
  },
  async set(name, value) {
    checkName(name);
    const r = await runProcess('secret-tool', ['store', `--label=${SERVICE} ${name}`, 'service', SERVICE, 'account', name], { timeoutMs: TIMEOUT, stdin: value });
    if (r.code !== 0) throw fail('저장하지', r.stderr);
  },
  async remove(name) {
    checkName(name);
    await runProcess('secret-tool', ['clear', 'service', SERVICE, 'account', name], { timeoutMs: TIMEOUT });
  },
};

export function systemKeychain(platform: NodeJS.Platform = process.platform): Keychain {
  return platform === 'darwin' ? macKeychain : platform === 'win32' ? winKeychain : linuxKeychain;
}

/** 테스트용 — 메모리에만 */
export function memoryKeychain(): Keychain & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { kind: 'linux', data, check: async () => ({ ok: true }), get: async (n) => data.get(n) ?? null, set: async (n, v) => void data.set(n, v), remove: async (n) => void data.delete(n) };
}
