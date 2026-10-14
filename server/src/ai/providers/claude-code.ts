// Claude Code CLI 공급자. 사용자 본인의 구독(로그인)으로 `claude -p` 를 비대화형으로 실행한다.
// 옵션은 모두 `claude --help`(2.1.296)로 확인한 것만 쓴다.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getSetting } from '../../config.ts';
import { runProcess } from '../../lib/process.ts';
import { AiError, type AiProvider, type ProviderRunInput, type ProviderRunOutput, type ProviderStatus } from '../types.ts';
import { sleptNote, startStopwatch } from '../../lib/sleep-clock.ts';

export interface ClaudeCodeOptions {
  /** 실행 파일 이름(테스트·다른 설치 위치용) */
  bin?: string;
  /**
   * 개발용 지침(CLAUDE.md)·훅·MCP 가 앱 프롬프트에 섞이지 않게 하는 장치들.
   * 기본은 모두 켠다. 끄는 것은 대조 실험(scripts/ai-context-probe.ts)에서만.
   */
  isolation?: { safeMode: boolean; tempCwd: boolean; cwd?: string };
  /** 로그인 확인 결과를 기억하는 시간(ms). 매 호출마다 auth status 를 돌리면 1초 남짓씩 느려져서 */
  authCacheMs?: number;
}

const DETECT_TIMEOUT_MS = 15_000;

const NOT_LOGGED_IN_HINT = 'Claude Code 에 로그인되어 있지 않습니다. 터미널에서 `claude` 를 실행해 로그인한 뒤 [다시 확인]을 누르세요.';

function notSubscriptionHint(auth: AuthStatus): string {
  return (
    `구독 요금이 아닌 다른 요금(${auth.authMethod ?? '알 수 없는 방식'})으로 나갈 수 있어 이 앱은 호출하지 않습니다. ` +
    '터미널에서 `claude auth status` 로 인증 방식을 확인하고, `claude` 로 claude.ai 계정에 로그인하세요. ' +
    '설정 파일(관리자 설정 포함)의 apiKeyHelper·env 가 원인일 수 있습니다.'
  );
}

/**
 * 구독(claude.ai 로그인) 대신 쓰이는 인증·접속·공급자 전환 변수. 셸에 있으면 `claude` 는 구독보다 이것을 먼저 쓴다.
 * 사용자가 다른 개발 작업용으로 셸에 넣어 둔 경우 앱이 모르게 다른 요금으로 돌지 않도록 구독 경로에서는 뺀다.
 * API 키 경로는 11월 API 어댑터에서 키체인 값을 명시적으로 넘긴다.
 * 근거는 모두 실제 확인(devlog 2026-10-13-03·04) + 공식 문서(code.claude.com/docs/en/env-vars):
 *  - ANTHROPIC_API_KEY → authMethod "api_key", 가짜 값이면 401. 문서: "-p 에서는 있으면 항상 쓴다"
 *  - ANTHROPIC_AUTH_TOKEN → "oauth_token", 401 / ANTHROPIC_BASE_URL → 그 주소로 접속 시도
 *  - CLAUDE_CODE_USE_{BEDROCK,VERTEX,FOUNDRY,ANTHROPIC_AWS,MANTLE} → "third_party", apiProvider 가 그 공급자로 바뀜
 *  - ANTHROPIC_FEDERATION_RULE_ID(+ORGANIZATION_ID·WORKSPACE_ID) → "oauth_token". 문서: "/login 자격 증명보다 우선"
 * ANTHROPIC_PROFILE 은 가짜 값으로는 변화가 없어 넣지 않았다 — 실행 직전 구독 판정(isSubscriptionAuth)이 마지막 방어선이다.
 */
export const NON_SUBSCRIPTION_ENV = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  'CLAUDE_CODE_USE_ANTHROPIC_AWS',
  'CLAUDE_CODE_USE_MANTLE',
  'ANTHROPIC_FEDERATION_RULE_ID',
  'ANTHROPIC_ORGANIZATION_ID',
  'ANTHROPIC_WORKSPACE_ID',
] as const;

/** 구독 경로로 실행할 환경 변수: 지금 환경에서 구독을 우회하는 변수만 뺀다 */
export function subscriptionEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = { ...base };
  for (const key of NON_SUBSCRIPTION_ENV) delete env[key];
  return env;
}

/** `claude auth status --json` 중 쓰는 칸 */
export interface AuthStatus {
  loggedIn?: boolean;
  authMethod?: string;
  apiProvider?: string;
  subscriptionType?: string | null;
}

/**
 * 구독 인증인가. 통과하는 경우는 둘뿐:
 *  - authMethod "claude.ai" (로그인)
 *  - authMethod "oauth_token" 이면서 넘기는 env 에 CLAUDE_CODE_OAUTH_TOKEN(setup-token 으로 만든 구독 토큰)이 있을 때.
 *    "oauth_token" 은 비구독 ANTHROPIC_AUTH_TOKEN·federation 에서도 똑같이 나오므로 이름만으로는 못 가린다 —
 *    그 변수들은 subscriptionEnv 에서 이미 뺐으므로, 남은 oauth_token 의 출처는 CLAUDE_CODE_OAUTH_TOKEN 뿐이다.
 * 공급자는 반드시 Anthropic 직접(firstParty)이어야 한다.
 */
export function isSubscriptionAuth(auth: AuthStatus, env: NodeJS.ProcessEnv): boolean {
  if (auth.loggedIn !== true) return false;
  if (auth.apiProvider !== undefined && auth.apiProvider !== 'firstParty') return false;
  if (auth.authMethod === 'claude.ai') return true;
  return auth.authMethod === 'oauth_token' && Boolean(env.CLAUDE_CODE_OAUTH_TOKEN);
}

/** `--output-format json` 의 결과 봉투 중 쓰는 칸. 2026-10-13 실제 호출로 확인 (devlog 2026-10-13-02) */
interface ResultEnvelope {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
  modelUsage?: Record<string, unknown>;
  duration_ms?: number;
}

export class ClaudeCodeProvider implements AiProvider {
  readonly id = 'claude';
  private readonly bin: string;
  private readonly isolation: NonNullable<ClaudeCodeOptions['isolation']>;
  private readonly authCacheMs: number;
  private authCache: { status: AuthStatus | null; at: number } | null = null;

  constructor(opts: ClaudeCodeOptions = {}) {
    this.bin = opts.bin ?? 'claude';
    this.isolation = opts.isolation ?? { safeMode: true, tempCwd: true };
    this.authCacheMs = opts.authCacheMs ?? getSetting(null, 'ai.authCacheMs');
  }

  /** 실제 호출과 같은 환경으로 로그인 상태를 읽는다. fresh 가 아니면 잠깐 기억해 둔 값을 쓴다 */
  private async readAuth(fresh: boolean): Promise<AuthStatus | null> {
    if (!fresh && this.authCache && Date.now() - this.authCache.at < this.authCacheMs) return this.authCache.status;
    const r = await runProcess(this.bin, ['auth', 'status', '--json'], { timeoutMs: DETECT_TIMEOUT_MS, env: subscriptionEnv() });
    let status: AuthStatus | null;
    try {
      status = JSON.parse(r.stdout) as AuthStatus;
    } catch {
      status = null;
    }
    this.authCache = { status, at: Date.now() };
    return status;
  }

  async detect(): Promise<ProviderStatus> {
    const base: ProviderStatus = {
      id: this.id,
      name: 'Claude Code',
      installed: false,
      version: null,
      loggedIn: null,
      authMethod: null,
      subscription: null,
      supported: true,
      hint: null,
    };
    const ver = await runProcess(this.bin, ['--version'], { timeoutMs: DETECT_TIMEOUT_MS, env: subscriptionEnv() });
    if (ver.notFound || ver.code !== 0) {
      return {
        ...base,
        hint: 'Claude Code 가 설치되어 있지 않습니다. https://claude.com/claude-code 의 안내대로 설치한 뒤 [다시 확인]을 누르세요.',
      };
    }
    const version = ver.stdout.trim().split(/\s+/)[0] ?? null;
    // 로그인 확인도 실제 호출과 같은 환경으로 한다 — 셸의 API 키 때문에 "로그인됨"으로 잘못 보이지 않게
    const parsed = await this.readAuth(true);
    if (!parsed) {
      return {
        ...base,
        installed: true,
        version,
        hint: '로그인 상태를 확인하지 못했습니다. 터미널에서 `claude auth status` 를 실행해 오류가 없는지 본 뒤 [다시 확인]을 누르세요.',
      };
    }
    const loggedIn = parsed.loggedIn === true;
    const subscription = isSubscriptionAuth(parsed, subscriptionEnv());
    return {
      ...base,
      installed: true,
      version,
      loggedIn,
      authMethod: parsed.authMethod ?? null,
      subscription: parsed.subscriptionType ?? null,
      // 구독이 아니면 이 앱에서는 쓸 수 없다 (run() 이 막는다)
      supported: loggedIn ? subscription : true,
      hint: !loggedIn ? NOT_LOGGED_IN_HINT : subscription ? null : notSubscriptionHint(parsed),
    };
  }

  async run(input: ProviderRunInput): Promise<ProviderRunOutput> {
    // 실행 직전에 구독인지 확인하고, 아니면 부르지 않는다 — 경고만 하면 그사이 다른 요금으로 돈다
    const auth = await this.readAuth(false);
    if (auth && auth.loggedIn !== true) {
      throw new AiError('not_logged_in', 'Claude Code 에 로그인되어 있지 않습니다.', NOT_LOGGED_IN_HINT);
    }
    if (auth && !isSubscriptionAuth(auth, subscriptionEnv())) {
      throw new AiError(
        'not_subscription',
        `Claude Code 가 구독(claude.ai)이 아닌 방식(${auth.authMethod ?? '알 수 없음'}${auth.apiProvider && auth.apiProvider !== 'firstParty' ? ` · ${auth.apiProvider}` : ''})으로 인증되어 있어 호출을 막았습니다.`,
        notSubscriptionHint(auth),
      );
    }
    // 호출마다 빈 임시 폴더를 작업 폴더로 쓴다 — 이 레포의 CLAUDE.md 같은 파일이 자동으로 읽히지 않게.
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'firstfeed-ai-'));
    const cwd = this.isolation.tempCwd ? tmp : (this.isolation.cwd ?? process.cwd());
    try {
      // 이미지는 작업 폴더 안으로 복사한다 — 읽기 도구는 작업 폴더 안만 읽을 수 있게 둔다
      const imageNames: string[] = [];
      for (const [i, src] of input.images.entries()) {
        const name = `image-${i + 1}${path.extname(src)}`;
        await fs.copyFile(src, path.join(tmp, name));
        imageNames.push(name);
      }
      const prompt =
        imageNames.length > 0
          ? `${input.prompt}\n\n첨부 이미지(작업 폴더의 파일, Read 도구로 읽는다): ${imageNames.join(', ')}`
          : input.prompt;

      // 도구 권한 최소화: 기본은 전부 끈다. 이미지면 읽기만, 웹이면 검색만. 쓰기·명령 실행은 절대 열지 않는다
      const tools = [...(imageNames.length > 0 ? ['Read'] : []), ...(input.web ? ['WebSearch', 'WebFetch'] : [])];
      const args = [
        '-p',
        '--output-format',
        'json',
        '--json-schema',
        JSON.stringify(input.jsonSchema),
        '--model',
        input.model,
        ...(input.effort ? ['--effort', input.effort] : []),
        '--tools',
        tools.join(','),
        '--strict-mcp-config', // 사용자 컴퓨터에 설정된 MCP 서버(메일·노션 등)를 불러오지 않는다
        '--no-session-persistence', // 앱 호출이 사용자의 대화 기록에 쌓이지 않게
        ...(tools.length > 0 ? ['--allowedTools', tools.join(',')] : []),
        ...(this.isolation.safeMode ? ['--safe-mode'] : []),
      ];
      if (imageNames.length > 0) args.push('--add-dir', tmp);

      const sw = startStopwatch();
      const r = await runProcess(this.bin, args, { cwd, stdin: prompt, timeoutMs: input.timeoutMs, signal: input.signal, env: subscriptionEnv() });
      const durationMs = sw.wallMs();

      if (r.notFound) {
        throw new AiError('not_installed', 'Claude Code 를 찾지 못했습니다.', 'Claude Code 를 설치한 뒤 설정의 「AI 연결」에서 [다시 확인]을 누르세요.');
      }
      if (r.aborted) throw new AiError('cancelled', 'AI 호출을 취소했습니다.', '필요하면 다시 실행하세요.');
      if (r.timedOut) {
        const slept = sw.sleptMs();
        throw new AiError(
          'timeout',
          `AI 응답이 제한 시간(${Math.round(input.timeoutMs / 1000)}초) 안에 오지 않았습니다.${sleptNote(slept)}`,
          slept > 0
            ? '중간에 컴퓨터가 잠자기에 들어갔습니다. 덮개를 연 채(전원 연결 권장)로 다시 시도하세요.'
            : '잠시 뒤 다시 시도하세요. 계속 반복되면 설정에서 제한 시간을 늘리거나 더 빠른 모델(sonnet)을 고르세요.',
        );
      }
      let env: ResultEnvelope;
      try {
        env = JSON.parse(r.stdout) as ResultEnvelope;
      } catch {
        const detail = (r.stderr || r.stdout).trim().slice(0, 500);
        if (/log ?in|login|authenticat|로그인/i.test(detail)) {
          throw new AiError('not_logged_in', 'Claude Code 에 로그인되어 있지 않습니다.', '터미널에서 `claude` 를 실행해 로그인한 뒤 다시 시도하세요.');
        }
        throw new AiError(
          'cli_failed',
          `Claude Code 가 예상한 형식으로 답하지 않았습니다 (종료 코드 ${r.code}): ${detail || '출력 없음'}`,
          '터미널에서 `claude -p "안녕"` 이 동작하는지 확인하세요. Claude Code 를 최신으로 업데이트하면 해결되는 경우가 많습니다.',
        );
      }
      if (env.is_error) {
        throw new AiError(
          'cli_failed',
          `Claude Code 가 오류를 돌려줬습니다 (${env.subtype ?? '알 수 없음'}): ${(env.result ?? '').slice(0, 300)}`,
          '사용량 한도에 걸렸다면 잠시 뒤 다시 시도하세요. 그 밖의 경우 오류 내용을 확인한 뒤 다시 실행하세요.',
        );
      }
      return {
        structured: env.structured_output,
        text: env.result ?? '',
        model: env.modelUsage ? Object.keys(env.modelUsage)[0] : undefined,
        durationMs,
      };
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  }
}

/** 아직 지원하지 않는 CLI: 설치 여부만 보여 준다 (11월 어댑터 예정) */
export async function detectUnsupported(id: string, name: string, bin: string): Promise<ProviderStatus> {
  const r = await runProcess(bin, ['--version'], { timeoutMs: DETECT_TIMEOUT_MS });
  const installed = !r.notFound && r.code === 0;
  return {
    id,
    name,
    installed,
    version: installed ? (r.stdout.trim().split(/\s+/).pop() ?? null) : null,
    loggedIn: null,
    authMethod: null,
    subscription: null,
    supported: false,
    hint: '11월에 지원 예정입니다. 지금은 Claude Code 를 사용하세요.',
  };
}
