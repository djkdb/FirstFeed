// 설정 탭에 저장하는 키 · 토큰 (사용자 지시 2026-11-20). 값은 OS 키체인에만 있고, 서버는 시작할 때 읽어 메모리에만 둔다 — 화면 · 로그 · DB 로 내보내지 않는다(끝 4자리만)
import { claudeEnvChanged } from '../ai/providers/claude-code.ts';
import { checkValue, KeychainError, type Keychain } from './keychain.ts';

export const SECRETS = {
  'claude.oauthToken': { label: 'Claude 구독 토큰', env: 'CLAUDE_CODE_OAUTH_TOKEN' },
  'fish.apiKey': { label: 'Fish Audio API 키', env: null },
} as const;
export type SecretName = keyof typeof SECRETS;
export const isSecretName = (n: string): n is SecretName => n in SECRETS;

export class SecretStore {
  private cache = new Map<SecretName, string>();
  private ready: { ok: true } | { ok: false; hint: string } = { ok: false, hint: '아직 키체인을 확인하지 않았어요.' };
  readonly keychain: Keychain;
  constructor(keychain: Keychain) {
    this.keychain = keychain;
  }

  /** 서버 시작 때 한 번 — 키체인을 못 쓰면 빈 채로(저장 · 읽기 시도 때 이유를 보인다) */
  async load(): Promise<void> {
    this.ready = await this.keychain.check().catch(() => ({ ok: false as const, hint: '키체인 도구를 실행하지 못했어요.' }));
    if (!this.ready.ok) return;
    for (const n of Object.keys(SECRETS) as SecretName[]) {
      const v = await this.keychain.get(n).catch(() => null);
      if (v) this.cache.set(n, v);
    }
    claudeEnvChanged();
  }

  status() {
    return {
      keychain: { kind: this.keychain.kind, ...this.ready },
      items: (Object.keys(SECRETS) as SecretName[]).map((n) => {
        const v = this.cache.get(n);
        return { name: n, label: SECRETS[n].label, saved: !!v, tail: v ? `••••${v.slice(-4)}` : null };
      }),
    };
  }

  get(n: SecretName): string | null {
    return this.cache.get(n) ?? null;
  }

  async set(n: SecretName, value: string): Promise<void> {
    const v = value.trim();
    const bad = checkValue(v);
    if (bad) throw new KeychainError(`${SECRETS[n].label}: ${bad}`, '');
    if (!this.ready.ok) this.ready = await this.keychain.check();
    if (!this.ready.ok) throw new KeychainError('이 컴퓨터의 키체인을 쓸 수 없어 저장하지 않았어요.', this.ready.hint);
    await this.keychain.set(n, v);
    // 다시 읽어 맞는지 본다 — 저장했다고 해 놓고 다음 실행에 없는 일이 없게
    if ((await this.keychain.get(n)) !== v) throw new KeychainError('키체인에 저장했지만 다시 읽어 보니 값이 달라요.', '키체인 잠금을 풀고 다시 저장해 주세요.');
    this.cache.set(n, v);
    if (n === 'claude.oauthToken') claudeEnvChanged();
  }

  async remove(n: SecretName): Promise<void> {
    await this.keychain.remove(n);
    this.cache.delete(n);
    if (n === 'claude.oauthToken') claudeEnvChanged();
  }

  /** Claude CLI 에 넘길 환경 — 저장한 토큰이 있을 때만 */
  claudeEnv(): Record<string, string> {
    const t = this.cache.get('claude.oauthToken');
    return t ? { CLAUDE_CODE_OAUTH_TOKEN: t } : {};
  }
}
