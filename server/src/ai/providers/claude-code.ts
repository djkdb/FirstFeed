// Claude Code CLI 공급자. 사용자 본인의 구독(로그인)으로 `claude -p` 를 비대화형으로 실행한다.
// 옵션은 모두 `claude --help`(2.1.296)로 확인한 것만 쓴다.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runProcess } from '../../lib/process.ts';
import { AiError, type AiProvider, type ProviderRunInput, type ProviderRunOutput, type ProviderStatus } from '../types.ts';

export interface ClaudeCodeOptions {
  /** 실행 파일 이름(테스트·다른 설치 위치용) */
  bin?: string;
  /**
   * 개발용 지침(CLAUDE.md)·훅·MCP 가 앱 프롬프트에 섞이지 않게 하는 장치들.
   * 기본은 모두 켠다. 끄는 것은 대조 실험(scripts/ai-context-probe.ts)에서만.
   */
  isolation?: { safeMode: boolean; tempCwd: boolean; cwd?: string };
}

const DETECT_TIMEOUT_MS = 15_000;

/**
 * 구독(claude.ai 로그인) 대신 쓰이는 인증·접속 변수. 셸에 하나라도 있으면 `claude` 는 구독보다 이것을 먼저 쓴다
 * (2026-10-13 확인: ANTHROPIC_API_KEY → authMethod "api_key", ANTHROPIC_AUTH_TOKEN → "oauth_token" 으로 바뀌고
 * 가짜 값이면 401, ANTHROPIC_BASE_URL 은 그 주소로 접속을 시도 — devlog 2026-10-13-03).
 * 사용자가 다른 개발 작업용으로 셸에 키를 넣어 둔 경우, 앱이 모르게 API 요금으로 돌지 않도록 구독 경로에서는 뺀다.
 * API 키 경로는 11월 API 어댑터에서 키체인 값을 명시적으로 넘긴다.
 */
export const NON_SUBSCRIPTION_ENV = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'] as const;

/** 구독 경로로 실행할 환경 변수: 지금 환경에서 구독을 우회하는 변수만 뺀다 */
export function subscriptionEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = { ...base };
  for (const key of NON_SUBSCRIPTION_ENV) delete env[key];
  return env;
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

  constructor(opts: ClaudeCodeOptions = {}) {
    this.bin = opts.bin ?? 'claude';
    this.isolation = opts.isolation ?? { safeMode: true, tempCwd: true };
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
    const auth = await runProcess(this.bin, ['auth', 'status', '--json'], { timeoutMs: DETECT_TIMEOUT_MS, env: subscriptionEnv() });
    let parsed: { loggedIn?: boolean; authMethod?: string; subscriptionType?: string } | null;
    try {
      parsed = JSON.parse(auth.stdout);
    } catch {
      parsed = null;
    }
    if (!parsed) {
      return {
        ...base,
        installed: true,
        version,
        hint: '로그인 상태를 확인하지 못했습니다. 터미널에서 `claude auth status` 를 실행해 오류가 없는지 본 뒤 [다시 확인]을 누르세요.',
      };
    }
    const loggedIn = parsed.loggedIn === true;
    // 키 변수를 뺐는데도 구독이 아닌 방식으로 잡히면(예: 설정 파일의 apiKeyHelper) 구독 경로가 아니므로 알린다
    const nonSubscription = loggedIn && parsed.authMethod !== undefined && parsed.authMethod !== 'claude.ai';
    return {
      ...base,
      installed: true,
      version,
      loggedIn,
      authMethod: parsed.authMethod ?? null,
      subscription: parsed.subscriptionType ?? null,
      hint: !loggedIn
        ? 'Claude Code 에 로그인되어 있지 않습니다. 터미널에서 `claude` 를 실행해 로그인한 뒤 [다시 확인]을 누르세요.'
        : nonSubscription
          ? `Claude Code 가 구독(claude.ai)이 아닌 방식(${parsed.authMethod})으로 인증되어 있습니다. 구독 요금이 아닌 API 요금이 나갈 수 있으니, 터미널에서 \`claude auth status\` 로 확인하세요.`
          : null,
    };
  }

  async run(input: ProviderRunInput): Promise<ProviderRunOutput> {
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
        '--tools',
        tools.join(','),
        '--strict-mcp-config', // 사용자 컴퓨터에 설정된 MCP 서버(메일·노션 등)를 불러오지 않는다
        '--no-session-persistence', // 앱 호출이 사용자의 대화 기록에 쌓이지 않게
        ...(tools.length > 0 ? ['--allowedTools', tools.join(',')] : []),
        ...(this.isolation.safeMode ? ['--safe-mode'] : []),
      ];
      if (imageNames.length > 0) args.push('--add-dir', tmp);

      const started = Date.now();
      const r = await runProcess(this.bin, args, { cwd, stdin: prompt, timeoutMs: input.timeoutMs, signal: input.signal, env: subscriptionEnv() });
      const durationMs = Date.now() - started;

      if (r.notFound) {
        throw new AiError('not_installed', 'Claude Code 를 찾지 못했습니다.', 'Claude Code 를 설치한 뒤 설정의 「AI 연결」에서 [다시 확인]을 누르세요.');
      }
      if (r.aborted) throw new AiError('cancelled', 'AI 호출을 취소했습니다.', '필요하면 다시 실행하세요.');
      if (r.timedOut) {
        throw new AiError(
          'timeout',
          `AI 응답이 제한 시간(${Math.round(input.timeoutMs / 1000)}초) 안에 오지 않았습니다.`,
          '잠시 뒤 다시 시도하세요. 계속 반복되면 설정에서 제한 시간을 늘리거나 더 빠른 모델(sonnet)을 고르세요.',
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
