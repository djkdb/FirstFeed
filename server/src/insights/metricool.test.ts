// Metricool 연결(OAuth · MCP · 결과 읽기) — 실제 Metricool 은 부르지 않는다. 가짜 fetch 가 2026-11-22 에 확인한 메타데이터 모양을 흉내 낸다
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { memoryKeychain } from '../secrets/keychain.ts';
import { SecretStore } from '../secrets/store.ts';
import { McpClient, parseSse } from './metricool/mcp.ts';
import { authServerMetadataUrl, decodeTokens, encodeTokens, MetricoolAuth, pkcePair, protectedResourceMetadataUrls, resourceMetadataFrom, KEYCHAIN_NAME } from './metricool/oauth.ts';
import { isoInZone, num, parseBrands, parseRows, parseStamp } from './metricool/tools.ts';
import { Metricool } from './fetch.ts';
import { getSetting, setSetting } from '../config.ts';

const MCP = 'https://ai.metricool.com/mcp';
type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;
const json = (v: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', ...headers } });

/** 가짜 Metricool — 메타데이터 · 등록 · 토큰 · MCP. calls 에 받은 요청을 남긴다 */
function fakeMetricool(o: { mcp?: Handler; token?: Handler } = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const f: typeof fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === 'https://ai.metricool.com/.well-known/oauth-protected-resource')
      return json({ resource: MCP, authorization_servers: ['https://ai.metricool.com'], scopes_supported: ['mcp:read', 'mcp:write'] });
    if (url === 'https://ai.metricool.com/.well-known/oauth-authorization-server')
      return json({
        issuer: 'https://ai.metricool.com',
        authorization_endpoint: 'https://app.metricool.com/oauth/authorize',
        token_endpoint: 'https://app.metricool.com/oauth/token',
        registration_endpoint: 'https://app.metricool.com/oauth/register',
        code_challenge_methods_supported: ['S256', 'plain'],
      });
    if (url === 'https://app.metricool.com/oauth/register') return json({ client_id: 'client-abc' }, 201);
    if (url === 'https://app.metricool.com/oauth/token') return o.token ? o.token(url, init) : json({ access_token: 'acc-1', refresh_token: 'ref-1', expires_in: 3600 });
    if (url === MCP && o.mcp) return o.mcp(url, init);
    return new Response('없음', { status: 404 });
  };
  return { f, calls };
}

async function setup(o: Parameters<typeof fakeMetricool>[0] = {}, now = () => 1_800_000_000_000) {
  const db = openDb(':memory:');
  const secrets = new SecretStore(memoryKeychain());
  await secrets.load();
  const fake = fakeMetricool(o);
  const auth = new MetricoolAuth({ db, secrets, fetch: fake.f, now });
  return { db, secrets, auth, ...fake };
}

describe('Metricool OAuth (PKCE · state · 토큰)', () => {
  it('PKCE: challenge = base64url(sha256(verifier))', () => {
    const { verifier, challenge } = pkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
  });

  it('토큰 묶음은 키체인 값 규칙(공백 · 따옴표 없음)에 맞게 오가고, 너무 길면 접근 토큰만 뺀다', () => {
    const t = { clientId: 'c', tokenEndpoint: 'https://x/token', accessToken: 'a b"c', refreshToken: 'r', expiresAt: 5, connectedAt: 7 };
    const enc = encodeTokens(t);
    expect(enc).not.toMatch(/[\s"'\\]/);
    expect(decodeTokens(enc)).toEqual(t);
    const long = encodeTokens({ ...t, accessToken: 'x'.repeat(5000) });
    expect(long.length).toBeLessThanOrEqual(4096);
    expect(decodeTokens(long)).toMatchObject({ accessToken: null, refreshToken: 'r' });
    expect(decodeTokens('엉뚱한 값')).toBeNull();
    // 예전에 저장한 값(connectedAt 없음)은 null 로 읽는다
    expect(decodeTokens(Buffer.from(JSON.stringify({ clientId: 'c', tokenEndpoint: 'e' })).toString('base64url'))).toMatchObject({ connectedAt: null });
  });

  it('연결: 메타데이터에서 주소를 읽어 등록 → 로그인 주소(resource · S256 · mcp:read) → 돌아오면 토큰을 키체인에, 상태는 연결됨', async () => {
    const { auth, secrets, calls } = await setup();
    const url = new URL(await auth.startConnect());
    expect(url.origin + url.pathname).toBe('https://app.metricool.com/oauth/authorize');
    const q = url.searchParams;
    expect([q.get('client_id'), q.get('scope'), q.get('code_challenge_method'), q.get('resource'), q.get('response_type')]).toEqual(['client-abc', 'mcp:read', 'S256', MCP, 'code']);
    expect(q.get('redirect_uri')).toBe('http://127.0.0.1:4317/api/insights/metricool/callback');
    const reg = JSON.parse(String(calls.find((c) => c.url.endsWith('/register'))!.init.body));
    expect(reg).toMatchObject({ client_name: 'FirstFeed', token_endpoint_auth_method: 'none', redirect_uris: [q.get('redirect_uri')] });
    // 보호 자원 메타데이터는 401 이 알려 준 주소가 없으면 정해진 주소(경로 붙인 것 → 뿌리) 순서로
    expect(calls.map((c) => c.url).slice(0, 3)).toEqual([MCP, 'https://ai.metricool.com/.well-known/oauth-protected-resource/mcp', 'https://ai.metricool.com/.well-known/oauth-protected-resource']);
    await auth.finishConnect('code-1', q.get('state')!);
    const form = new URLSearchParams(String(calls.at(-1)!.init.body));
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(createHash('sha256').update(form.get('code_verifier')!).digest('base64url')).toBe(q.get('code_challenge'));
    expect(decodeTokens(secrets.get(KEYCHAIN_NAME))).toMatchObject({ clientId: 'client-abc', accessToken: 'acc-1', refreshToken: 'ref-1' });
    expect(auth.status()).toEqual({ connected: true, needsReconnect: false, connectedAt: 1_800_000_000_000, warning: null });
    // 설정 탭 키 목록에는 나오지 않는다
    expect(secrets.status().items.map((i) => i.name)).not.toContain(KEYCHAIN_NAME);
  });

  it('state 는 한 번만 — 같은 state 로 두 번째, 모르는 state, 시간이 지난 state 는 거절', async () => {
    let t = 1_800_000_000_000;
    const { auth } = await setup({}, () => t);
    const state = new URL(await auth.startConnect()).searchParams.get('state')!;
    await auth.finishConnect('c', state);
    await expect(auth.finishConnect('c', state)).rejects.toThrow(/알아보지 못했어요/);
    await expect(auth.finishConnect('c', 'nope')).rejects.toThrow(/알아보지 못했어요/);
    const s2 = new URL(await auth.startConnect()).searchParams.get('state')!;
    t += 11 * 60_000;
    await expect(auth.finishConnect('c', s2)).rejects.toThrow(/알아보지 못했어요/);
  });

  it('접근 토큰이 끝나 가면 새로 받기 토큰으로 바꾼다 — 새 토큰을 저장, 거절되면 다시 연결 안내', async () => {
    let t = 1_800_000_000_000;
    let n = 0;
    const { auth, secrets } = await setup(
      {
        token: (_u, init) => {
          const f = new URLSearchParams(String(init.body));
          if (f.get('grant_type') === 'authorization_code') return json({ access_token: 'acc-1', refresh_token: 'ref-1', expires_in: 3600 });
          n++;
          expect(f.get('refresh_token')).toBe('ref-1');
          return n === 1 ? json({ access_token: 'acc-2', expires_in: 3600 }) : json({ error: 'invalid_grant' }, 400);
        },
      },
      () => t,
    );
    await auth.finishConnect('c', new URL(await auth.startConnect()).searchParams.get('state')!);
    expect(await auth.accessToken()).toBe('acc-1');
    t += 3600_000 - 30_000; // 끝나기 30초 전(여유 60초 안)
    expect(await auth.accessToken()).toBe('acc-2');
    expect(decodeTokens(secrets.get(KEYCHAIN_NAME))).toMatchObject({ accessToken: 'acc-2', refreshToken: 'ref-1' });
    await expect(auth.accessToken(true)).rejects.toThrow(/로그인이 끝났어요/);
    expect(auth.status().needsReconnect).toBe(true);
    await auth.disconnect();
    expect(auth.status().connected).toBe(false);
    expect(secrets.get(KEYCHAIN_NAME)).toBeNull();
  });
});

describe('MCP 클라이언트 (Streamable HTTP)', () => {
  /** initialize · initialized · tools/call 을 받는 가짜 서버. sse 면 SSE 로 답한다 */
  function server(o: { sse?: boolean; unauthorizedOnce?: boolean; isError?: boolean } = {}) {
    const seen: Array<{ method: string; session: string | null; auth: string | null }> = [];
    let left401 = o.unauthorizedOnce ? 1 : 0;
    const handler: Handler = (_u, init) => {
      const h = new Headers(init.headers);
      const body = JSON.parse(String(init.body)) as { id?: number; method: string; params?: { name?: string } };
      seen.push({ method: body.method, session: h.get('mcp-session-id'), auth: h.get('authorization') });
      if (left401 && body.method === 'tools/call') {
        left401--;
        return new Response('', { status: 401 });
      }
      if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
      const result =
        body.method === 'initialize'
          ? { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'x' } }
          : o.isError
            ? { isError: true, content: [{ type: 'text', text: '권한 없음' }] }
            : { content: [{ type: 'text', text: JSON.stringify({ data: [{ id: 7, label: 'L', timezone: 'Asia/Seoul', networksData: { instagramData: 'me' }, owner: { mail: 'owner-mail-marker' } }] }) }] };
      const msg = { jsonrpc: '2.0', id: body.id, result };
      const headers: Record<string, string> = body.method === 'initialize' ? { 'mcp-session-id': 'sess-9' } : {};
      return o.sse
        ? new Response(`event: message\ndata: ${JSON.stringify(msg)}\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream', ...headers } })
        : json(msg, 200, headers);
    };
    return { handler, seen };
  }
  const tokens = () => {
    const asked: boolean[] = [];
    return { asked, accessToken: async (force?: boolean) => (asked.push(!!force), force ? 'tok-new' : 'tok-old') };
  };

  for (const sse of [false, true])
    it(`${sse ? 'SSE' : 'JSON'} 응답: initialize → initialized → tools/call, 세션 머리말을 이어 보낸다`, async () => {
      const s = server({ sse });
      const c = new McpClient({ url: MCP, tokens: tokens(), fetch: async (u, i) => s.handler(String(u), i ?? {}), timeoutMs: 5000 });
      const v = await c.callTool('getBrandSettings', {});
      expect(parseBrands(v)).toEqual([{ id: '7', label: 'L', timezone: 'Asia/Seoul', instagram: 'me' }]);
      expect(s.seen.map((x) => x.method)).toEqual(['initialize', 'notifications/initialized', 'tools/call']);
      expect(s.seen.slice(1).every((x) => x.session === 'sess-9')).toBe(true);
      expect(s.seen[0]!.auth).toBe('Bearer tok-old');
    });

  it('401 이면 토큰을 새로 받아 한 번 다시 보낸다', async () => {
    const s = server({ unauthorizedOnce: true });
    const t = tokens();
    const c = new McpClient({ url: MCP, tokens: t, fetch: async (u, i) => s.handler(String(u), i ?? {}), timeoutMs: 5000 });
    await c.callTool('getBrandSettings', {});
    expect(t.asked).toContain(true);
    expect(s.seen.at(-1)!.auth).toBe('Bearer tok-new');
  });

  it('계속 401 이면 다시 연결하라고 알린다 · isError 결과는 오류로', async () => {
    const c = new McpClient({ url: MCP, tokens: tokens(), fetch: async () => new Response('', { status: 401 }), timeoutMs: 5000 });
    await expect(c.callTool('x', {})).rejects.toThrow(/받아 주지 않아요/);
    const s = server({ isError: true });
    const c2 = new McpClient({ url: MCP, tokens: tokens(), fetch: async (u, i) => s.handler(String(u), i ?? {}), timeoutMs: 5000 });
    await expect(c2.callTool('x', {})).rejects.toThrow(/권한 없음/);
  });

  it('SSE 읽기: data 줄을 모으고 JSON 이 아닌 이벤트는 건너뛴다', () => {
    expect(parseSse(': ping\n\nevent: message\ndata: {"jsonrpc":"2.0","id":3,"result":1}\n\n')).toEqual([{ jsonrpc: '2.0', id: 3, result: 1 }]);
  });
});

describe('Metricool 결과 읽기', () => {
  it('브랜드: id · 이름 · 시간대 · 인스타 아이디만 남긴다(이메일 등은 버린다)', () => {
    const b = parseBrands({ data: [{ id: 7228403, label: '내 브랜드', timezone: 'Asia/Seoul', networksData: { instagramData: 'me' }, userEmail: 'owner-mail-marker' }] });
    expect(b).toEqual([{ id: '7228403', label: '내 브랜드', timezone: 'Asia/Seoul', instagram: 'me' }]);
    expect(JSON.stringify(b)).not.toContain('owner-mail-marker');
  });

  it('날짜: YYYYMMDDHHMMSS 는 UTC 시각 → ISO. 모르는 모양 · 없는 날은 null', () => {
    // 실제 값(2026-11-24 Metricool 응답): 인스타 게시물 ID 4033022858787669966 의 만든 시각 = 2026-11-18 09:23:31 UTC.
    // 브랜드 시간대(Asia/Seoul)로 읽으면 9시간 앞당겨져 48시간 판정 · 잇기 범위가 어긋난다(옛 테스트가 그 가정을 굳혀 놓았었다)
    expect(parseStamp('20261118092331')).toBe('2026-11-18T09:23:31.000Z');
    expect(parseStamp('20260827233708')).toBe('2026-08-27T23:37:08.000Z');
    expect(parseStamp('20261318092331')).toBeNull();
    expect(parseStamp('20260230120000')).toBeNull();
    expect(parseStamp('')).toBeNull();
    expect(parseStamp(undefined)).toBeNull();
    expect(parseStamp('2026-11-18 09:23')).toBeNull();
    expect(isoInZone(Date.parse('2026-11-18T00:23:31Z'), 'Asia/Seoul')).toBe('2026-11-18T09:23:31+09:00');
  });

  it('숫자: 글 · 쉼표 → 숫자, 「""」 · 없음 · 글자 → null (0 으로 바꾸지 않는다)', () => {
    expect([num('12'), num('1,234'), num(5), num(''), num(undefined), num('abc'), num('-3'), num('0')]).toEqual([12, 1234, 5, null, null, null, null, 0]);
  });

  it('행: 요청한 항목 순서대로 읽는다 · ID 없는 행은 버린다 · 빈 값은 null', () => {
    const fields = { publishedAt: 'IGPO02', content: 'IGPO03', id: 'IGPO04', url: 'IGPO06', type: 'IGPO07', comments: 'IGPO08', likes: 'IGPO13', reach: 'IGPO14', saved: 'IGPO15', shares: 'IGPO27', views: 'IGPO28' };
    const rows = parseRows(
      {
        rows: [
          ['20261118092331', '캡션', '1789', 'https://www.instagram.com/p/x/', 'FEED_CAROUSEL_ALBUM', '3', '40', '500', '25', '', '900'],
          ['20261119092331', '아이디 없음', '', 'u', 'FEED_IMAGE', '1', '1', '1', '1', '1', '1'],
          ['20261120100000', '짧은 행', '1790'],
          // 실제 응답 모양: 공유가 JSON null 로 오는 행 · 저장 "0"(진짜 0 — null 이 아니다)
          ['20260909025557', '실제 모양', '1791', 'u', 'FEED_CAROUSEL_ALBUM', '2', '9', '623', '0', null, '1817'],
        ],
      },
      fields,
      null,
    );
    expect(rows).toHaveLength(3);
    expect(rows[2]).toMatchObject({ externalId: '1791', saved: 0, shares: null, reach: 623, publishedAt: '2026-09-09T02:55:57.000Z' });
    expect(rows[0]).toEqual({ externalId: '1789', url: 'https://www.instagram.com/p/x/', type: 'FEED_CAROUSEL_ALBUM', publishedAt: '2026-11-18T09:23:31.000Z', content: '캡션', reach: 500, saved: 25, shares: null, views: 900, likes: 40, comments: 3 });
    expect(rows[1]).toMatchObject({ externalId: '1790', reach: null, saved: null, type: null });
    expect(parseRows({ nope: 1 }, fields, null)).toEqual([]);
  });

  it('불러오기: 브랜드가 하나면 그것으로 · 피드와 릴스 두 번 부르고 DB 에 넣는다 · 다시 부르면 덮어쓴다', async () => {
    const db = openDb(':memory:');
    const secrets = new SecretStore(memoryKeychain());
    await secrets.load();
    await secrets.set(KEYCHAIN_NAME, encodeTokens({ clientId: 'c', tokenEndpoint: 'https://app.metricool.com/oauth/token', accessToken: 'tok', refreshToken: 'r', expiresAt: null, connectedAt: null }));
    let reach = '500';
    const args: Array<Record<string, unknown>> = [];
    const f: typeof fetch = async (_u, init) => {
      const body = JSON.parse(String(init!.body)) as { id?: number; method: string; params: { name: string; arguments: Record<string, unknown> } };
      if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
      if (body.method === 'initialize') return json({ jsonrpc: '2.0', id: body.id, result: {} });
      const { name, arguments: a } = body.params;
      args.push({ name, ...a });
      const data =
        name === 'getBrandSettings'
          ? { data: [{ id: 1, label: 'B', timezone: 'Asia/Seoul', networksData: {} }] }
          : (a.metrics as string[])[0] === 'IGPO02'
            ? { rows: [['20261118092331', '피드', 'p1', 'u', 'FEED_CAROUSEL_ALBUM', '1', '2', reach, '10', '3', '4']] }
            : { rows: [['20261117092331', '릴스', 'r1', 'u2', '1', '2', '300', '6', '1', '700']] };
      return json({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: JSON.stringify(data) }] } });
    };
    const mc = new Metricool({ db, secrets, fetch: f, now: () => Date.parse('2026-11-22T00:00:00Z') });
    const r1 = await mc.fetchPosts(1);
    expect(r1).toMatchObject({ added: 2, updated: 0, received: 2, brand: 'B', warnings: [] });
    const call = args.find((x) => x.name === 'getAnalyticsDataByMetrics')!;
    expect(call).toMatchObject({ brandId: '1', to: '2026-11-22T09:00:00+09:00' });
    expect(String(call.from)).toMatch(/\+09:00$/);
    reach = '800';
    expect(await mc.fetchPosts(1)).toMatchObject({ added: 0, updated: 2 });
    const rows = db.prepare('SELECT external_id, type, reach, fetched_at FROM insight_posts ORDER BY external_id').all();
    expect(rows).toEqual([
      { external_id: 'p1', type: 'FEED_CAROUSEL_ALBUM', reach: 800, fetched_at: '2026-11-22T00:00:00.000Z' },
      { external_id: 'r1', type: 'REELS', reach: 300, fetched_at: '2026-11-22T00:00:00.000Z' },
    ]);
  });
});

describe('Metricool 연결 찾기 (RFC 9728 · RFC 8414)', () => {
  it('주소 만들기: 경로가 있는 issuer 는 호스트와 경로 사이에 끼운다 · WWW-Authenticate 의 resource_metadata(https 만)', () => {
    expect(authServerMetadataUrl('https://ai.metricool.com')).toBe('https://ai.metricool.com/.well-known/oauth-authorization-server');
    expect(authServerMetadataUrl('https://ai.metricool.com/')).toBe('https://ai.metricool.com/.well-known/oauth-authorization-server');
    expect(authServerMetadataUrl('https://auth.example.com/tenant/1/')).toBe('https://auth.example.com/.well-known/oauth-authorization-server/tenant/1');
    expect(protectedResourceMetadataUrls('https://ai.metricool.com')).toEqual(['https://ai.metricool.com/.well-known/oauth-protected-resource']);
    expect(resourceMetadataFrom('Bearer realm="x", resource_metadata="https://ai.metricool.com/.well-known/oauth-protected-resource/mcp"')).toBe(
      'https://ai.metricool.com/.well-known/oauth-protected-resource/mcp',
    );
    expect(resourceMetadataFrom('Bearer resource_metadata=https://a.example/m, error="x"')).toBe('https://a.example/m');
    expect(resourceMetadataFrom('Bearer resource_metadata="http://a.example/m"')).toBeNull();
    expect(resourceMetadataFrom('Bearer realm="x"')).toBeNull();
    expect(resourceMetadataFrom(null)).toBeNull();
  });

  /** 401 이 알려 주는 주소에만 보호 자원 메타데이터가 있고, 인증 서버는 경로가 있는 issuer */
  function hinted(o: { issuer?: string } = {}) {
    const calls: string[] = [];
    const PRM = 'https://ai.metricool.com/meta/prm';
    const f: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url === MCP) return new Response('', { status: 401, headers: { 'www-authenticate': `Bearer resource_metadata="${PRM}"` } });
      if (url === PRM) return json({ resource: MCP, authorization_servers: ['https://login.metricool.com/oauth'] });
      if (url === 'https://login.metricool.com/.well-known/oauth-authorization-server/oauth')
        return json({
          issuer: o.issuer ?? 'https://login.metricool.com/oauth',
          authorization_endpoint: 'https://login.metricool.com/oauth/authorize',
          token_endpoint: 'https://login.metricool.com/oauth/token',
          registration_endpoint: 'https://login.metricool.com/oauth/register',
          code_challenge_methods_supported: ['S256'],
        });
      if (url === 'https://login.metricool.com/oauth/register') return json({ client_id: 'c2' }, 201);
      return new Response('없음', { status: 404 });
    };
    return { f, calls };
  }

  it('401 의 resource_metadata 주소를 먼저 쓰고(정해진 주소는 부르지 않음), 인증 서버 메타데이터는 RFC 8414 주소로', async () => {
    const db = openDb(':memory:');
    const secrets = new SecretStore(memoryKeychain());
    await secrets.load();
    const h = hinted();
    const auth = new MetricoolAuth({ db, secrets, fetch: h.f });
    const url = new URL(await auth.startConnect());
    expect(url.origin + url.pathname).toBe('https://login.metricool.com/oauth/authorize');
    expect(h.calls.filter((u) => u.includes('oauth-protected-resource'))).toEqual([]);
  });

  it('받은 issuer 가 물어본 issuer 와 다르면 연결하지 않는다', async () => {
    const db = openDb(':memory:');
    const secrets = new SecretStore(memoryKeychain());
    await secrets.load();
    const auth = new MetricoolAuth({ db, secrets, fetch: hinted({ issuer: 'https://evil.example.com' }).f });
    await expect(auth.startConnect()).rejects.toThrow(/issuer 다름/);
  });
});

describe('Metricool 토큰 지키기 · 연결 시각 · 끊기', () => {
  it('연결 시각은 로그인 때만 바뀌고 새로 받기로는 그대로 · 다시 연결하면 새 시각', async () => {
    let t = 1_800_000_000_000;
    const { auth } = await setup({}, () => t);
    await auth.finishConnect('c', new URL(await auth.startConnect()).searchParams.get('state')!);
    expect(auth.status().connectedAt).toBe(1_800_000_000_000);
    t += 3600_000;
    await auth.accessToken();
    expect(auth.status().connectedAt).toBe(1_800_000_000_000);
    t += 1000;
    await auth.finishConnect('c', new URL(await auth.startConnect()).searchParams.get('state')!);
    expect(auth.status().connectedAt).toBe(t);
  });

  it('새로 받은 토큰을 키체인에 저장하지 못해도 메모리에 두고 쓴다 · 상태에 안내', async () => {
    let t = 1_800_000_000_000;
    const kc = memoryKeychain();
    let failSet = false;
    const secrets = new SecretStore({ ...kc, set: async (n, v) => (failSet ? Promise.reject(new Error('잠김')) : kc.set(n, v)) });
    await secrets.load();
    let n = 0;
    const fake = fakeMetricool({ token: (_u, init) => (new URLSearchParams(String(init.body)).get('grant_type') === 'refresh_token' ? json({ access_token: `acc-r${++n}`, refresh_token: `ref-r${n}`, expires_in: 3600 }) : json({ access_token: 'acc-1', refresh_token: 'ref-1', expires_in: 3600 })) });
    const auth = new MetricoolAuth({ db: openDb(':memory:'), secrets, fetch: fake.f, now: () => t });
    await auth.finishConnect('c', new URL(await auth.startConnect()).searchParams.get('state')!);
    failSet = true;
    t += 3600_000;
    expect(await auth.accessToken()).toBe('acc-r1');
    expect(auth.status()).toMatchObject({ connected: true, warning: expect.stringMatching(/키체인에 저장하지 못했어요/) });
    // 다음 새로 받기는 메모리의 새 새로 받기 토큰(ref-r1)으로 — 키체인의 옛 것(ref-1)이 아니라
    t += 3600_000;
    expect(await auth.accessToken()).toBe('acc-r2');
    expect(new URLSearchParams(String(fake.calls.at(-1)!.init.body)).get('refresh_token')).toBe('ref-r1');
    failSet = false;
    t += 3600_000;
    await auth.accessToken();
    expect(auth.status().warning).toBeNull();
    expect(decodeTokens(secrets.get(KEYCHAIN_NAME))).toMatchObject({ refreshToken: 'ref-r3' });
  });

  it('새로 받기 도중 연결을 끊으면 받은 토큰을 되써 넣지 않는다 · 끊으면 고른 브랜드도 지운다', async () => {
    let t = 1_800_000_000_000;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { auth, secrets, db } = await setup(
      {
        token: async (_u, init) => {
          if (new URLSearchParams(String(init.body)).get('grant_type') === 'refresh_token') {
            await gate;
            return json({ access_token: 'acc-late', refresh_token: 'ref-late', expires_in: 3600 });
          }
          return json({ access_token: 'acc-1', refresh_token: 'ref-1', expires_in: 3600 });
        },
      },
      () => t,
    );
    await auth.finishConnect('c', new URL(await auth.startConnect()).searchParams.get('state')!);
    setSetting(db, 'insights.metricool.brandId', '7');
    t += 3600_000;
    const pending = auth.accessToken();
    await auth.disconnect();
    release();
    await expect(pending).rejects.toThrow(/연결이 바뀌어/);
    expect(secrets.get(KEYCHAIN_NAME)).toBeNull();
    expect(auth.status()).toMatchObject({ connected: false, connectedAt: null });
    expect(getSetting(db, 'insights.metricool.brandId')).toBeNull();
  });
});

describe('MCP 클라이언트 — 판 · 세션 다시 잇기', () => {
  it('initialize 뒤에는 서버가 고른 판을 MCP-Protocol-Version 으로 · 세션이 끝나 404 면 한 번만 다시 이어 다시 보낸다', async () => {
    const seen: Array<{ method: string; version: string | null; session: string | null }> = [];
    let sessions = 0;
    let expireOnce = true;
    const f: typeof fetch = async (_u, init) => {
      const h = new Headers(init!.headers);
      const body = JSON.parse(String(init!.body)) as { id?: number; method: string };
      seen.push({ method: body.method, version: h.get('mcp-protocol-version'), session: h.get('mcp-session-id') });
      if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
      if (body.method === 'initialize') return json({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-03-26', capabilities: {} } }, 200, { 'mcp-session-id': `s${++sessions}` });
      if (expireOnce && h.get('mcp-session-id') === 's1') {
        expireOnce = false;
        return new Response('', { status: 404 });
      }
      return json({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: '{"ok":1}' }] } });
    };
    const c = new McpClient({ url: MCP, tokens: { accessToken: async () => 'tok' }, fetch: f, timeoutMs: 5000 });
    expect(await c.callTool('x', {})).toEqual({ ok: 1 });
    expect(seen.map((x) => `${x.method}@${x.session}`)).toEqual(['initialize@null', 'notifications/initialized@s1', 'tools/call@s1', 'initialize@null', 'notifications/initialized@s2', 'tools/call@s2']);
    expect(seen[0]!.version).toBe('2025-06-18');
    expect(seen.filter((x) => x.method !== 'initialize').every((x) => x.version === '2025-03-26')).toBe(true);
  });

  it('다시 이은 뒤에도 404 면 다시 누르라고 알린다(끝없이 돌지 않는다)', async () => {
    let n = 0;
    const f: typeof fetch = async (_u, init) => {
      const body = JSON.parse(String(init!.body)) as { id?: number; method: string };
      if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
      if (body.method === 'initialize') return json({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-06-18' } }, 200, { 'mcp-session-id': `s${++n}` });
      return new Response('', { status: 404 });
    };
    const c = new McpClient({ url: MCP, tokens: { accessToken: async () => 'tok' }, fetch: f, timeoutMs: 5000 });
    await expect(c.callTool('x', {})).rejects.toThrow(/중간에 끊겼어요/);
    expect(n).toBe(2);
  });
});

describe('Metricool 브랜드 고르기', () => {
  const brands = (...ids: string[]) => ids.map((id) => ({ id, label: `B${id}`, timezone: null, instagram: null }));
  async function mc() {
    const db = openDb(':memory:');
    const secrets = new SecretStore(memoryKeychain());
    await secrets.load();
    return { db, m: new Metricool({ db, secrets, fetch: async () => new Response('', { status: 599 }) }) };
  }
  it('고른 브랜드가 목록에 없고 하나뿐이면 그것을 쓰고 저장값을 바꾼다 · 여럿이면 다시 고르라고', async () => {
    const { db, m } = await mc();
    setSetting(db, 'insights.metricool.brandId', 'old');
    expect(m.chooseBrand(brands('9')).id).toBe('9');
    expect(getSetting(db, 'insights.metricool.brandId')).toBe('9');
    setSetting(db, 'insights.metricool.brandId', 'old');
    expect(() => m.chooseBrand(brands('1', '2'))).toThrow(/찾지 못했어요/);
    expect(() => m.chooseBrand([])).toThrow(/브랜드가 없어요/);
    setSetting(db, 'insights.metricool.brandId', null);
    expect(() => m.chooseBrand(brands('1', '2'))).toThrow(/여러 개예요/);
    expect(m.chooseBrand(brands('5')).id).toBe('5');
    // 고르지 않았던 것은 저장하지 않는다(브랜드가 늘면 다시 묻게)
    expect(getSetting(db, 'insights.metricool.brandId')).toBeNull();
    setSetting(db, 'insights.metricool.brandId', '2');
    expect(m.chooseBrand(brands('1', '2')).id).toBe('2');
  });
});
