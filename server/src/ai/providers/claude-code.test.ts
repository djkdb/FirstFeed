// 실제 claude 대신, 실제 동작(2026-10-13 확인)을 흉내 내는 가짜 실행 파일로 환경 변수 처리를 시험한다:
// ANTHROPIC_API_KEY 가 있으면 auth status 가 api_key 로 바뀌고, -p 는 그 키를 쓴다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ClaudeCodeProvider, NON_SUBSCRIPTION_ENV, subscriptionEnv } from './claude-code.ts';

const FAKE_CLAUDE = `#!/usr/bin/env node
const leaked = ${JSON.stringify(NON_SUBSCRIPTION_ENV)}.filter((k) => process.env[k] !== undefined);
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('9.9.9 (Claude Code)'); process.exit(0); }
if (args[0] === 'auth') {
  const viaKey = process.env.ANTHROPIC_API_KEY !== undefined;
  console.log(JSON.stringify({ loggedIn: true, authMethod: viaKey ? 'api_key' : 'claude.ai', subscriptionType: viaKey ? null : 'max' }));
  process.exit(0);
}
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  console.log(JSON.stringify({ type: 'result', is_error: false, result: '', structured_output: { leaked, cwd: process.cwd() } }));
});
`;

let dir: string;
let bin: string;
const saved: Record<string, string | undefined> = {};

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firstfeed-fake-claude-'));
  bin = path.join(dir, 'claude');
  fs.writeFileSync(bin, FAKE_CLAUDE, { mode: 0o755 });
  // 사용자가 셸에 키를 넣어 둔 상황을 만든다 (가짜 값)
  for (const k of NON_SUBSCRIPTION_ENV) {
    saved[k] = process.env[k];
    process.env[k] = `firstfeed-test-${k}`;
  }
});

afterAll(() => {
  for (const k of NON_SUBSCRIPTION_ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('구독 경로의 환경 변수', () => {
  it('구독을 우회하는 변수 3개만 빼고 나머지는 그대로 둔다', () => {
    const env = subscriptionEnv({ ANTHROPIC_API_KEY: 'x', ANTHROPIC_AUTH_TOKEN: 'y', ANTHROPIC_BASE_URL: 'z', PATH: '/bin', HOME: '/h' });
    expect(env).toEqual({ PATH: '/bin', HOME: '/h' });
  });

  it('셸에 키가 있어도 claude -p 에는 넘기지 않는다', async () => {
    const out = await new ClaudeCodeProvider({ bin }).run({
      prompt: 'p',
      jsonSchema: {},
      model: 'sonnet',
      images: [],
      web: false,
      timeoutMs: 10_000,
    });
    expect(out.structured).toMatchObject({ leaked: [] });
  });

  it('셸에 키가 있어도 로그인 확인은 구독(claude.ai) 기준으로 한다', async () => {
    const status = await new ClaudeCodeProvider({ bin }).detect();
    expect(status).toMatchObject({ installed: true, loggedIn: true, authMethod: 'claude.ai', subscription: 'max', hint: null });
  });
});
