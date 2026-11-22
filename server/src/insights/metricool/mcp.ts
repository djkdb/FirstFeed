// 아주 작은 MCP 클라이언트(Streamable HTTP) — Metricool 공식 MCP 서버의 도구를 앱이 직접 부른다(AI 를 거치지 않음, 결정 2026-11-22).
// 새 의존성 없이 필요한 만큼만: initialize → notifications/initialized → tools/call. 응답은 JSON 이거나 SSE(text/event-stream) 둘 다 받는다.
// 401 이면 토큰을 한 번 새로 받아 다시 보내고, 그래도 401 이면 다시 연결하라고 알린다
import { FlowError } from '../../identity/flow.ts';

export const PROTOCOL_VERSION = '2025-06-18';
const RECONNECT = '설정 → 연결된 계정에서 Metricool 을 다시 연결하세요.';

export interface TokenSource {
  accessToken(force?: boolean): Promise<string>;
}

interface RpcMessage {
  jsonrpc: '2.0';
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

/** SSE 본문에서 data 줄을 모아 JSON-RPC 메시지들로 */
export function parseSse(text: string): RpcMessage[] {
  const out: RpcMessage[] = [];
  for (const block of text.replace(/\r\n/g, '\n').split('\n\n')) {
    const data = block
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).replace(/^ /, ''))
      .join('\n');
    if (!data) continue;
    try {
      out.push(JSON.parse(data) as RpcMessage);
    } catch {
      // 다른 이벤트(핑 등)는 건너뛴다
    }
  }
  return out;
}

export class McpClient {
  private readonly url: string;
  private readonly tokens: TokenSource;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private session: string | null = null;
  private initialized = false;
  private nextId = 1;

  constructor(o: { url: string; tokens: TokenSource; fetch?: typeof fetch; timeoutMs: number }) {
    this.url = o.url;
    this.tokens = o.tokens;
    this.fetchImpl = o.fetch ?? fetch;
    this.timeoutMs = o.timeoutMs;
  }

  private async post(body: unknown, retried = false): Promise<Response> {
    const token = await this.tokens.accessToken(retried);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
      'mcp-protocol-version': PROTOCOL_VERSION,
    };
    if (this.session) headers['mcp-session-id'] = this.session;
    let r: Response;
    try {
      r = await this.fetchImpl(this.url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(this.timeoutMs) });
    } catch {
      throw new FlowError('Metricool 에 연결하지 못했어요(응답 없음).', '인터넷 연결을 확인한 뒤 다시 불러오세요.');
    }
    if (r.status === 401) {
      if (retried) throw new FlowError('Metricool 이 연결을 받아 주지 않아요.', RECONNECT);
      return this.post(body, true);
    }
    const sid = r.headers.get('mcp-session-id');
    if (sid) this.session = sid;
    return r;
  }

  private async request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const r = await this.post({ jsonrpc: '2.0', id, method, params });
    if (r.status === 404 && this.session) {
      // 세션이 끝났다(스펙: 404) — 처음부터 다시
      this.session = null;
      this.initialized = false;
      throw new FlowError('Metricool 연결이 중간에 끊겼어요.', '「불러오기」를 다시 누르세요.');
    }
    if (!r.ok) throw new FlowError(`Metricool 이 요청을 거절했어요(${r.status}).`, '잠시 뒤 다시 불러오세요. 계속되면 직접 입력을 쓰세요.');
    const type = r.headers.get('content-type') ?? '';
    const text = await r.text();
    let msgs: RpcMessage[];
    if (type.includes('text/event-stream')) msgs = parseSse(text);
    else {
      try {
        const v = JSON.parse(text) as RpcMessage | RpcMessage[];
        msgs = Array.isArray(v) ? v : [v];
      } catch {
        msgs = [];
      }
    }
    const m = msgs.find((x) => x.id === id);
    if (!m) throw new FlowError('Metricool 응답을 읽지 못했어요.', '잠시 뒤 다시 불러오세요.');
    if (m.error) throw new FlowError(`Metricool 이 오류를 돌려줬어요: ${m.error.message}`, '잠시 뒤 다시 불러오세요.');
    return m.result;
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    await this.request('initialize', { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'FirstFeed', version: '0.1.0' } });
    // 알림은 응답이 없다(202) — 본문은 읽지 않는다
    const r = await this.post({ jsonrpc: '2.0', method: 'notifications/initialized' });
    await r.body?.cancel();
    this.initialized = true;
  }

  /** 도구를 불러 결과 JSON 을 돌려준다 — structuredContent 가 있으면 그것, 없으면 첫 글자 내용(JSON 글) */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    await this.init();
    const res = (await this.request('tools/call', { name, arguments: args })) as {
      content?: Array<{ type: string; text?: string }>;
      structuredContent?: unknown;
      isError?: boolean;
    } | null;
    const text = res?.content?.find((c) => c.type === 'text' && typeof c.text === 'string')?.text ?? '';
    if (res?.isError) throw new FlowError(`Metricool 도구(${name})가 오류를 돌려줬어요: ${text.slice(0, 200) || '이유 없음'}`, '잠시 뒤 다시 불러오세요.');
    if (res?.structuredContent !== undefined) return res.structuredContent;
    try {
      return JSON.parse(text);
    } catch {
      throw new FlowError(`Metricool 도구(${name}) 결과를 읽지 못했어요.`, '앱을 최신으로 바꾼 뒤 다시 불러오세요.');
    }
  }
}
