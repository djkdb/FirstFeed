// 설정 화면이 서버에서 받는 모양 — 키 · 토큰 줄, Claude 연결 상태, 티스토리 · 리틀리 로그인 기록
export interface SecretItem {
  name: 'claude.oauthToken' | 'fish.apiKey';
  label: string;
  saved: boolean;
  tail: string | null;
}
export interface Secrets {
  keychain: { kind: 'macos' | 'windows' | 'linux'; ok: boolean; hint?: string };
  items: SecretItem[];
}
export interface Claude {
  installed: boolean;
  version: string | null;
  loggedIn: boolean | null;
  authMethod: string | null;
  subscription: string | null;
  supported: boolean;
  hint: string | null;
}
export interface LoginSite {
  site: 'tistory' | 'litly';
  label: string;
  saved: boolean;
  savedAt: string | null;
  needs: string | null;
}
