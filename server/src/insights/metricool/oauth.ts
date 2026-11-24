// Metricool 연결 — OAuth 2.1(동적 클라이언트 등록 + PKCE S256, 공개 클라이언트) (사용자 결정 2026-11-22: 앱이 Metricool 공식 MCP 서버에 직접 붙는다).
// 확인한 것(2026-11-22, 인증 없이): MCP 주소에 POST → 401 + WWW-Authenticate resource_metadata, 보호 자원 메타데이터 · 인증 서버 메타데이터.
// 인증 서버 주소(authorize · token · register)는 코드에 적지 않고 실행할 때 메타데이터에서 읽는다 — 바뀌어도 고칠 곳이 없게.
// 토큰은 OS 키체인에만(SecretStore 'metricool.oauth', base64url JSON). 로그 · 화면 · DB 에는 토큰을 남기지 않는다.
// 읽기만 하므로 범위는 mcp:read 하나만 요청한다
import { createHash, randomBytes } from 'node:crypto';
import { env, getSetting, setSetting } from '../../config.ts';
import type { Db } from '../../db/index.ts';
import { FlowError } from '../../identity/flow.ts';
import type { SecretStore } from '../../secrets/store.ts';

export const KEYCHAIN_NAME = 'metricool.oauth' as const;
export const SCOPE = 'mcp:read';
const RECONNECT = '설정 → 연결된 계정에서 Metricool 을 다시 연결하세요.';

export interface MetricoolTokens {
  clientId: string;
  tokenEndpoint: string;
  accessToken: string | null;
  refreshToken: string | null;
  /** 접근 토큰이 끝나는 시각(ms). 모르면 null — 그때는 401 을 받으면 새로 받는다 */
  expiresAt: number | null;
  /** 로그인을 마친 시각(ms) — 새로 받기로는 바뀌지 않는다. 화면이 「다시 연결」이 끝났는지 알아보는 데만 쓴다. 예전에 저장한 값은 null */
  connectedAt: number | null;
}

/** 키체인 값 규칙(공백 · 따옴표 없음, 4,096자 이하)에 맞게 base64url. 너무 길면 접근 토큰은 빼고 저장한다(다음에 새로 받기 토큰으로 다시 받는다) */
export function encodeTokens(t: MetricoolTokens): string {
  const enc = (x: MetricoolTokens) => Buffer.from(JSON.stringify(x), 'utf8').toString('base64url');
  const full = enc(t);
  return full.length <= 4096 ? full : enc({ ...t, accessToken: null, expiresAt: null });
}

export function decodeTokens(s: string | null): MetricoolTokens | null {
  if (!s) return null;
  try {
    const v = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Partial<MetricoolTokens>;
    if (typeof v.clientId !== 'string' || typeof v.tokenEndpoint !== 'string') return null;
    return {
      clientId: v.clientId,
      tokenEndpoint: v.tokenEndpoint,
      accessToken: typeof v.accessToken === 'string' ? v.accessToken : null,
      refreshToken: typeof v.refreshToken === 'string' ? v.refreshToken : null,
      expiresAt: typeof v.expiresAt === 'number' ? v.expiresAt : null,
      connectedAt: typeof v.connectedAt === 'number' ? v.connectedAt : null,
    };
  } catch {
    return null;
  }
}

/** PKCE(RFC 7636) — verifier 는 43자 base64url, challenge = base64url(sha256(verifier)) */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

export function redirectUri(): string {
  return `http://${env.host}:${env.port}/api/insights/metricool/callback`;
}

/** WWW-Authenticate 머리말에서 resource_metadata 주소(RFC 9728 5.1). https 가 아니거나 없으면 null */
export function resourceMetadataFrom(header: string | null): string | null {
  const m = header?.match(/resource_metadata\s*=\s*(?:"([^"]+)"|([^\s,]+))/i);
  const v = m?.[1] ?? m?.[2];
  if (!v) return null;
  try {
    return new URL(v).protocol === 'https:' ? v : null;
  } catch {
    return null;
  }
}

/** 인증 서버 메타데이터 주소(RFC 8414 3.1) — 경로가 있는 issuer 는 호스트와 경로 사이에 /.well-known/oauth-authorization-server 를 끼운다 */
export function authServerMetadataUrl(issuer: string): string {
  const u = new URL(issuer);
  const path = u.pathname.replace(/\/+$/, '');
  return `${u.origin}/.well-known/oauth-authorization-server${path}`;
}

/** 보호 자원 메타데이터의 정해진 주소(RFC 9728 3.1) — 경로가 있는 자원은 경로를 뒤에 붙인 주소 먼저, 그다음 뿌리 */
export function protectedResourceMetadataUrls(resource: string): string[] {
  const u = new URL(resource);
  const path = u.pathname.replace(/\/+$/, '');
  const root = `${u.origin}/.well-known/oauth-protected-resource`;
  return path ? [`${root}${path}`, root] : [root];
}

interface Discovery {
  resource: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint: string;
}

interface Pending {
  verifier: string;
  clientId: string;
  tokenEndpoint: string;
  resource: string;
  createdAt: number;
}

export interface AuthOptions {
  db: Db;
  secrets: SecretStore;
  fetch?: typeof fetch;
  now?: () => number;
}

export class MetricoolAuth {
  private readonly db: Db;
  private readonly secrets: SecretStore;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  /** 로그인 창이 돌아오기를 기다리는 시도 — 메모리에만, 한 번 쓰면 지운다 */
  private readonly pending = new Map<string, Pending>();
  /** 등록만 하고 아직 토큰을 못 받은 클라이언트 — 연결을 다시 눌러도 또 등록하지 않게 */
  private registered: { clientId: string; redirect: string } | null = null;
  private refreshing: Promise<string> | null = null;
  /** 새로 받기가 거절됐다 — 다시 연결해야 한다 */
  private broken = false;
  /** 새로 받은 토큰을 키체인에 저장하지 못했을 때 메모리에만 둔 것 — 새 토큰을 받으면 옛 새로 받기 토큰은 끝날 수 있어서 버리지 않는다 */
  private unsaved: MetricoolTokens | null = null;
  /** 키체인 저장 실패 안내(화면 상태에 보인다) */
  private saveWarning: string | null = null;
  /** 연결 · 끊기마다 1씩 — 새로 받기 도중 끊겼거나 다시 연결했으면 받은 토큰을 되써 넣지 않는다 */
  private generation = 0;

  constructor(o: AuthOptions) {
    this.db = o.db;
    this.secrets = o.secrets;
    this.fetchImpl = o.fetch ?? fetch;
    this.now = o.now ?? Date.now;
  }

  private tokens(): MetricoolTokens | null {
    return this.unsaved ?? decodeTokens(this.secrets.get(KEYCHAIN_NAME));
  }

  status(): { connected: boolean; needsReconnect: boolean; connectedAt: number | null; warning: string | null } {
    const t = this.tokens();
    return { connected: !!t && (!!t.refreshToken || !!t.accessToken), needsReconnect: this.broken, connectedAt: t?.connectedAt ?? null, warning: this.saveWarning };
  }

  private mcpUrl(): string {
    return getSetting(this.db, 'insights.metricool.mcpUrl');
  }

  private async getJson(url: string, init?: RequestInit): Promise<{ status: number; body: Record<string, unknown> | null }> {
    let r: Response;
    try {
      r = await this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(getSetting(this.db, 'insights.fetchTimeoutMs')) });
    } catch {
      throw new FlowError('Metricool 에 연결하지 못했어요.', '인터넷 연결을 확인한 뒤 다시 시도하세요.');
    }
    const body = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    return { status: r.status, body };
  }

  /** MCP 주소에 토큰 없이 한 번 보내 401 의 WWW-Authenticate 에서 보호 자원 메타데이터 주소를 읽는다(MCP 인증 스펙). 못 읽으면 null */
  private async probeResourceMetadata(mcp: string): Promise<string | null> {
    let r: Response;
    try {
      r = await this.fetchImpl(mcp, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'ping' }),
        signal: AbortSignal.timeout(getSetting(this.db, 'insights.fetchTimeoutMs')),
      });
    } catch {
      throw new FlowError('Metricool 에 연결하지 못했어요.', '인터넷 연결을 확인한 뒤 다시 시도하세요.');
    }
    await r.body?.cancel().catch(() => undefined);
    return r.status === 401 ? resourceMetadataFrom(r.headers.get('www-authenticate')) : null;
  }

  /** 보호 자원 메타데이터 → 인증 서버 메타데이터 (RFC 9728 · RFC 8414). 401 이 알려 준 주소를 먼저, 없으면 정해진 주소들 */
  async discover(): Promise<Discovery> {
    const mcp = this.mcpUrl();
    const hinted = await this.probeResourceMetadata(mcp);
    let prm: { status: number; body: Record<string, unknown> | null } = { status: 0, body: null };
    for (const u of hinted ? [hinted] : protectedResourceMetadataUrls(mcp)) {
      prm = await this.getJson(u);
      if (prm.status === 200) break;
    }
    const resource = prm.body?.resource;
    const servers = prm.body?.authorization_servers;
    if (prm.status !== 200 || typeof resource !== 'string' || !Array.isArray(servers) || typeof servers[0] !== 'string') {
      throw new FlowError('Metricool 연결 정보를 읽지 못했어요.', 'Metricool 쪽이 바뀌었을 수 있어요. 잠시 뒤 다시 시도하고, 계속되면 직접 입력을 쓰세요.');
    }
    if (resource !== mcp) throw new FlowError('Metricool 이 알려 준 서버 주소가 설정과 달라요.', '앱을 최신으로 바꾼 뒤 다시 시도하세요.');
    const issuer = String(servers[0]);
    let asUrl: string;
    try {
      asUrl = authServerMetadataUrl(issuer);
    } catch {
      throw new FlowError('Metricool 이 알려 준 로그인 서버 주소를 읽지 못했어요.', '잠시 뒤 다시 시도하고, 계속되면 직접 입력을 쓰세요.');
    }
    const as = await this.getJson(asUrl);
    const b = as.body ?? {};
    // RFC 8414 3.3: 받은 issuer 가 물어본 issuer 와 같아야 한다 — 다르면 다른 서버의 메타데이터일 수 있어 쓰지 않는다(끝의 「/」 하나 차이만 같게 본다)
    const same = (x: string) => x.replace(/\/$/, '');
    if (as.status === 200 && (typeof b.issuer !== 'string' || same(b.issuer) !== same(issuer)))
      throw new FlowError('Metricool 로그인 서버 정보가 맞지 않아 연결하지 않았어요(issuer 다름).', '잠시 뒤 다시 시도하고, 계속되면 앱을 최신으로 바꾼 뒤 다시 연결하세요.');
    const methods = Array.isArray(b.code_challenge_methods_supported) ? b.code_challenge_methods_supported : [];
    if (as.status !== 200 || typeof b.authorization_endpoint !== 'string' || typeof b.token_endpoint !== 'string' || typeof b.registration_endpoint !== 'string') {
      throw new FlowError('Metricool 로그인 정보를 읽지 못했어요.', '잠시 뒤 다시 시도하세요.');
    }
    if (!methods.includes('S256')) throw new FlowError('Metricool 로그인이 안전한 방식(PKCE S256)을 지원하지 않아 연결하지 않았어요.', '앱을 최신으로 바꾼 뒤 다시 시도하세요.');
    return { resource, authorizationEndpoint: b.authorization_endpoint, tokenEndpoint: b.token_endpoint, registrationEndpoint: b.registration_endpoint };
  }

  /** 동적 클라이언트 등록(RFC 7591) — 공개 클라이언트(token_endpoint_auth_method none) */
  private async register(d: Discovery): Promise<string> {
    const redirect = redirectUri();
    if (this.registered?.redirect === redirect) return this.registered.clientId;
    const r = await this.getJson(d.registrationEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client_name: 'FirstFeed',
        redirect_uris: [redirect],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        scope: SCOPE,
      }),
    });
    const id = r.body?.client_id;
    if (r.status >= 300 || typeof id !== 'string') throw new FlowError('Metricool 에 이 앱을 등록하지 못했어요.', '잠시 뒤 다시 시도하세요.');
    this.registered = { clientId: id, redirect };
    return id;
  }

  private sweep(): void {
    const ttl = getSetting(this.db, 'insights.oauthStateMinutes') * 60_000;
    for (const [k, p] of this.pending) if (this.now() - p.createdAt > ttl) this.pending.delete(k);
  }

  /** 「연결」 — 브라우저로 열 로그인 주소를 돌려준다 */
  async startConnect(): Promise<string> {
    const d = await this.discover();
    const clientId = await this.register(d);
    const { verifier, challenge } = pkcePair();
    const state = randomBytes(24).toString('base64url');
    this.sweep();
    this.pending.set(state, { verifier, clientId, tokenEndpoint: d.tokenEndpoint, resource: d.resource, createdAt: this.now() });
    const u = new URL(d.authorizationEndpoint);
    u.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri(),
      scope: SCOPE,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      resource: d.resource,
    }).toString();
    return u.toString();
  }

  private async tokenRequest(endpoint: string, form: Record<string, string>): Promise<{ status: number; body: Record<string, unknown> | null }> {
    return this.getJson(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams(form).toString(),
    });
  }

  private async save(t: MetricoolTokens): Promise<void> {
    try {
      await this.secrets.set(KEYCHAIN_NAME, encodeTokens(t));
    } catch (e) {
      const hint = e instanceof Error && 'hint' in e ? String((e as { hint: unknown }).hint) : '';
      throw new FlowError('Metricool 연결을 키체인에 저장하지 못했어요.', hint || '키체인 잠금을 풀고 다시 연결하세요.');
    }
  }

  private fromTokenResponse(b: Record<string, unknown>, base: Pick<MetricoolTokens, 'clientId' | 'tokenEndpoint' | 'connectedAt'> & { refreshToken: string | null }): MetricoolTokens {
    const access = typeof b.access_token === 'string' ? b.access_token : null;
    const exp = typeof b.expires_in === 'number' && Number.isFinite(b.expires_in) ? this.now() + b.expires_in * 1000 : null;
    return { ...base, accessToken: access, refreshToken: typeof b.refresh_token === 'string' ? b.refresh_token : base.refreshToken, expiresAt: exp };
  }

  /** 로그인 창이 돌아왔을 때 — state 는 한 번만, 정해 둔 시간 안에서만 */
  async finishConnect(code: string | undefined, state: string | undefined): Promise<void> {
    this.sweep();
    const p = state ? this.pending.get(state) : undefined;
    if (!p || !state) throw new FlowError('이 연결 요청을 알아보지 못했어요(오래됐거나 이미 쓴 요청).', 'FirstFeed 설정 탭에서 「연결」을 다시 누르세요.');
    this.pending.delete(state);
    if (!code) throw new FlowError('Metricool 이 로그인 결과를 보내지 않았어요.', 'FirstFeed 설정 탭에서 「연결」을 다시 누르세요.');
    const r = await this.tokenRequest(p.tokenEndpoint, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: p.clientId,
      code_verifier: p.verifier,
      resource: p.resource,
    });
    if (r.status !== 200 || !r.body || typeof r.body.access_token !== 'string') {
      // 응답 본문은 남기지 않는다(토큰이 섞일 수 있어서) — 오류 이름만
      console.warn(`[성과] Metricool 토큰 받기 실패: ${r.status} ${typeof r.body?.error === 'string' ? r.body.error : ''}`);
      throw new FlowError('Metricool 로그인을 마무리하지 못했어요.', 'FirstFeed 설정 탭에서 「연결」을 다시 누르세요.');
    }
    const next = this.fromTokenResponse(r.body, { clientId: p.clientId, tokenEndpoint: p.tokenEndpoint, refreshToken: null, connectedAt: this.now() });
    // 먼저 세대를 올린다 — 저장을 기다리는 사이 끝난 옛 새로 받기가 이 연결을 덮지 않게
    this.generation++;
    // 연결은 키체인에 저장돼야 끝난 것 — 저장을 못 하면 오류로(다음 실행에 연결이 없어서)
    await this.save(next);
    this.unsaved = null;
    this.saveWarning = null;
    this.broken = false;
  }

  /** 쓸 접근 토큰. 끝나 가면(또는 force) 새로 받는다 — 동시에 여러 번 부르면 한 번만 */
  async accessToken(force = false): Promise<string> {
    const t = this.tokens();
    if (!t) throw new FlowError('Metricool 이 연결되어 있지 않아요.', RECONNECT);
    const margin = getSetting(this.db, 'insights.tokenRefreshMarginSec') * 1000;
    const fresh = t.accessToken && (t.expiresAt === null || t.expiresAt - margin > this.now());
    if (fresh && !force) return t.accessToken!;
    if (!t.refreshToken) {
      if (t.accessToken && !force) return t.accessToken;
      this.broken = true;
      throw new FlowError('Metricool 로그인이 끝났어요.', RECONNECT);
    }
    if (!this.refreshing) {
      const p: Promise<string> = this.refresh(t).finally(() => {
        if (this.refreshing === p) this.refreshing = null;
      });
      this.refreshing = p;
    }
    return this.refreshing;
  }

  private async refresh(t: MetricoolTokens): Promise<string> {
    const gen = this.generation;
    const r = await this.tokenRequest(t.tokenEndpoint, { grant_type: 'refresh_token', refresh_token: t.refreshToken!, client_id: t.clientId, resource: this.mcpUrl() });
    // 기다리는 사이 연결을 끊었거나 다시 연결했다 — 받은 토큰을 되써 넣지 않는다(끊은 연결이 되살아나거나 새 연결을 덮지 않게)
    if (gen !== this.generation) throw new FlowError('Metricool 연결이 바뀌어 이번 요청은 그만뒀어요.', '「불러오기」를 다시 누르세요. 연결을 끊었다면 ' + RECONNECT);
    if (r.status !== 200 || !r.body || typeof r.body.access_token !== 'string') {
      console.warn(`[성과] Metricool 토큰 새로 받기 실패: ${r.status} ${typeof r.body?.error === 'string' ? r.body.error : ''}`);
      this.broken = true;
      throw new FlowError('Metricool 로그인이 끝났어요.', RECONNECT);
    }
    const next = this.fromTokenResponse(r.body, { clientId: t.clientId, tokenEndpoint: t.tokenEndpoint, refreshToken: t.refreshToken, connectedAt: t.connectedAt });
    try {
      await this.save(next);
      this.unsaved = null;
      this.saveWarning = null;
    } catch (e) {
      // 새 토큰을 받으면 옛 새로 받기 토큰은 끝날 수 있다 — 저장을 못 해도 이번 실행 동안은 메모리의 새 토큰을 쓴다
      this.unsaved = next;
      const hint = e instanceof FlowError ? e.hint : '';
      this.saveWarning = `새로 받은 Metricool 연결을 키체인에 저장하지 못했어요. 앱을 끄면 다시 연결해야 할 수 있어요. ${hint}`.trim();
      console.warn('[성과] Metricool 새 토큰을 키체인에 저장하지 못해 메모리에만 둠');
    }
    this.broken = false;
    return next.accessToken!;
  }

  /** 연결 끊기 — Metricool 쪽 취소 주소가 메타데이터에 없어서 이 컴퓨터의 토큰만 지운다. 고른 브랜드도 지운다(다른 계정으로 다시 연결하면 맞지 않아서) */
  async disconnect(): Promise<void> {
    this.generation++;
    this.unsaved = null;
    this.saveWarning = null;
    this.refreshing = null;
    await this.secrets.remove(KEYCHAIN_NAME);
    setSetting(this.db, 'insights.metricool.brandId', null);
    this.registered = null;
    this.pending.clear();
    this.broken = false;
  }
}
