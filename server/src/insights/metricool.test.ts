// Metricool 연결(OAuth · MCP · 결과 읽기) — 실제 Metricool 은 부르지 않는다. 가짜 fetch 가 2026-11-22 에 확인한 메타데이터 모양을 흉내 낸다
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { memoryKeychain } from '../secrets/keychain.ts';
import { SecretStore } from '../secrets/store.ts';
import { McpClient, parseSse } from './metricool/mcp.ts';
import { decodeTokens, encodeTokens, MetricoolAuth, pkcePair, KEYCHAIN_NAME } from './metricool/oauth.ts';
import { isoInZone, num, parseBrands, parseRows, parseStamp } from './metricool/tools.ts';
import { Metricool } from './fetch.ts';

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
    const t = { clientId: 'c', tokenEndpoint: 'https://x/token', accessToken: 'a b"c', refreshToken: 'r', expiresAt: 5 };
    const enc = encodeTokens(t);
    expect(enc).not.toMatch(/[\s"'\\]/);
    expect(decodeTokens(enc)).toEqual(t);
    const long = encodeTokens({ ...t, accessToken: 'x'.repeat(5000) });
    expect(long.length).toBeLessThanOrEqual(4096);
    expect(decodeTokens(long)).toMatchObject({ accessToken: null, refreshToken: 'r' });
    expect(decodeTokens('엉뚱한 값')).toBeNull();
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
    await auth.finishConnect('code-1', q.get('state')!);
    const form = new URLSearchParams(String(calls.at(-1)!.init.body));
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(createHash('sha256').update(form.get('code_verifier')!).digest('base64url')).toBe(q.get('code_challenge'));
    expect(decodeTokens(secrets.get(KEYCHAIN_NAME))).toMatchObject({ clientId: 'client-abc', accessToken: 'acc-1', refreshToken: 'ref-1' });
    expect(auth.status()).toEqual({ connected: true, needsReconnect: false });
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

  it('날짜: YYYYMMDDHHMMSS 는 브랜드 시간대 시각 → UTC ISO. 모르는 모양은 null', () => {
    expect(parseStamp('20261118092331', 'Asia/Seoul')).toBe('2026-11-18T00:23:31.000Z');
    expect(parseStamp('20260705120000', 'America/New_York')).toBe('2026-07-05T16:00:00.000Z');
    expect(parseStamp('20261318092331', 'Asia/Seoul')).toBeNull();
    expect(parseStamp('', 'Asia/Seoul')).toBeNull();
    expect(parseStamp(undefined, 'Asia/Seoul')).toBeNull();
    expect(parseStamp('2026-11-18 09:23', 'Asia/Seoul')).toBeNull();
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
        ],
      },
      fields,
      'Asia/Seoul',
      null,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ externalId: '1789', url: 'https://www.instagram.com/p/x/', type: 'FEED_CAROUSEL_ALBUM', publishedAt: '2026-11-18T00:23:31.000Z', content: '캡션', reach: 500, saved: 25, shares: null, views: 900, likes: 40, comments: 3 });
    expect(rows[1]).toMatchObject({ externalId: '1790', reach: null, saved: null, type: null });
    expect(parseRows({ nope: 1 }, fields, 'Asia/Seoul', null)).toEqual([]);
  });

  it('불러오기: 브랜드가 하나면 그것으로 · 피드와 릴스 두 번 부르고 DB 에 넣는다 · 다시 부르면 덮어쓴다', async () => {
    const db = openDb(':memory:');
    const secrets = new SecretStore(memoryKeychain());
    await secrets.load();
    await secrets.set(KEYCHAIN_NAME, encodeTokens({ clientId: 'c', tokenEndpoint: 'https://app.metricool.com/oauth/token', accessToken: 'tok', refreshToken: 'r', expiresAt: null }));
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
