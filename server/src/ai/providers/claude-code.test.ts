// 실제 claude 대신, 실제 동작(devlog 2026-10-13-03·04 에서 확인)을 흉내 내는 가짜 실행 파일로 시험한다:
//  - ANTHROPIC_API_KEY → api_key / CLAUDE_CODE_USE_* → third_party / CLAUDE_CODE_OAUTH_TOKEN → oauth_token / 없으면 claude.ai
//  - FAKE_AUTH_METHOD 로 설정 파일(apiKeyHelper 등) 때문에 생기는 경우를 흉내 낸다
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeAll, afterAll, describe, expect, it } from 'vitest';
import { ClaudeCodeProvider, NON_SUBSCRIPTION_ENV, isSubscriptionAuth, subscriptionEnv } from './claude-code.ts';
import type { ProviderRunInput } from '../types.ts';

const FAKE_CLAUDE = `#!/usr/bin/env node
const fs = require('node:fs');
const log = (line) => process.env.FAKE_LOG && fs.appendFileSync(process.env.FAKE_LOG, line + '\\n');
const leaked = ${JSON.stringify(NON_SUBSCRIPTION_ENV)}.filter((k) => process.env[k] !== undefined);
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('9.9.9 (Claude Code)'); process.exit(0); }
if (args[0] === 'auth') {
  log('auth');
  const e = process.env;
  const third = ['BEDROCK', 'VERTEX', 'FOUNDRY', 'ANTHROPIC_AWS', 'MANTLE'].find((p) => e['CLAUDE_CODE_USE_' + p]);
  const authMethod = e.FAKE_AUTH_METHOD ?? (e.ANTHROPIC_API_KEY ? 'api_key' : third ? 'third_party' : e.ANTHROPIC_AUTH_TOKEN || e.CLAUDE_CODE_OAUTH_TOKEN ? 'oauth_token' : 'claude.ai');
  const apiProvider = third ? third.toLowerCase() : 'firstParty';
  console.log(JSON.stringify({ loggedIn: true, authMethod, apiProvider, subscriptionType: authMethod === 'claude.ai' ? 'max' : null }));
  process.exit(0);
}
log('run');
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  console.log(JSON.stringify({ type: 'result', is_error: false, result: '', structured_output: { leaked } }));
});
`;

let dir: string;
let bin: string;
let logFile: string;
const touched = [...NON_SUBSCRIPTION_ENV, 'CLAUDE_CODE_OAUTH_TOKEN', 'FAKE_AUTH_METHOD', 'FAKE_LOG'];
const saved: Record<string, string | undefined> = {};
const input: ProviderRunInput = { prompt: 'p', jsonSchema: {}, model: 'sonnet', images: [], web: false, timeoutMs: 10_000 };
const calls = () => (fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean) : []);

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firstfeed-fake-claude-'));
  bin = path.join(dir, 'claude');
  fs.writeFileSync(bin, FAKE_CLAUDE, { mode: 0o755 });
  for (const k of touched) saved[k] = process.env[k];
});

afterEach(() => {
  for (const k of touched) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

function freshLog() {
  logFile = path.join(dir, `log-${Math.random().toString(36).slice(2)}.txt`);
  process.env.FAKE_LOG = logFile;
}

describe('구독 경로의 환경 변수', () => {
  it('구독을 우회하는 변수만 빼고 나머지(구독 토큰 포함)는 그대로 둔다', () => {
    const base = Object.fromEntries(NON_SUBSCRIPTION_ENV.map((k) => [k, 'x']));
    const env = subscriptionEnv({ ...base, PATH: '/bin', CLAUDE_CODE_OAUTH_TOKEN: 'sub' });
    expect(env).toEqual({ PATH: '/bin', CLAUDE_CODE_OAUTH_TOKEN: 'sub' });
  });

  it('셸에 키·공급자 전환 변수가 있어도 claude 에 넘기지 않고, 구독으로 실행한다', async () => {
    freshLog();
    for (const k of NON_SUBSCRIPTION_ENV) process.env[k] = `firstfeed-test-${k}`;
    const p = new ClaudeCodeProvider({ bin });
    expect(await p.detect()).toMatchObject({ loggedIn: true, authMethod: 'claude.ai', subscription: 'max', supported: true, hint: null });
    const out = await p.run(input);
    expect(out.structured).toEqual({ leaked: [] });
  });
});

describe('구독 판정', () => {
  it.each([
    [{ loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty' }, {}, true],
    [{ loggedIn: true, authMethod: 'oauth_token', apiProvider: 'firstParty' }, { CLAUDE_CODE_OAUTH_TOKEN: 't' }, true],
    [{ loggedIn: true, authMethod: 'oauth_token', apiProvider: 'firstParty' }, {}, false],
    [{ loggedIn: true, authMethod: 'api_key', apiProvider: 'firstParty' }, {}, false],
    [{ loggedIn: true, authMethod: 'third_party', apiProvider: 'bedrock' }, {}, false],
    [{ loggedIn: true, authMethod: 'claude.ai', apiProvider: 'vertex' }, {}, false],
    [{ loggedIn: false, authMethod: 'claude.ai' }, {}, false],
  ])('%j + env %j → %s', (auth, env, expected) => {
    expect(isSubscriptionAuth(auth, env)).toBe(expected);
  });
});

describe('실행 직전 차단', () => {
  it('구독이 아니면(예: 설정 파일의 apiKeyHelper) 호출을 막고 claude -p 는 실행하지 않는다', async () => {
    freshLog();
    process.env.FAKE_AUTH_METHOD = 'api_key';
    const p = new ClaudeCodeProvider({ bin });
    await expect(p.run(input)).rejects.toMatchObject({ kind: 'not_subscription', hint: /claude auth status/ });
    expect(calls()).toEqual(['auth']); // run 은 한 번도 없다
    const status = await p.detect();
    expect(status).toMatchObject({ supported: false });
    expect(status.hint).toMatch(/호출하지 않습니다/);
  });

  it('setup-token 구독 토큰(CLAUDE_CODE_OAUTH_TOKEN)은 막지 않는다', async () => {
    freshLog();
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'firstfeed-test-subscription-token';
    const out = await new ClaudeCodeProvider({ bin }).run(input);
    expect(out.structured).toEqual({ leaked: [] });
    expect(calls()).toEqual(['auth', 'run']);
  });

  it('로그인 확인 결과는 잠깐 기억해, 연속 호출마다 auth status 를 다시 돌리지 않는다', async () => {
    freshLog();
    const p = new ClaudeCodeProvider({ bin, authCacheMs: 60_000 });
    await p.run(input);
    await p.run(input);
    expect(calls()).toEqual(['auth', 'run', 'run']);
  });

  it('기억 시간이 지나면 다시 확인한다 (그사이 인증 방식이 바뀌면 막는다)', async () => {
    freshLog();
    const p = new ClaudeCodeProvider({ bin, authCacheMs: 0 });
    await p.run(input);
    process.env.FAKE_AUTH_METHOD = 'third_party';
    await expect(p.run(input)).rejects.toMatchObject({ kind: 'not_subscription' });
    expect(calls()).toEqual(['auth', 'run', 'auth']);
  });
});
