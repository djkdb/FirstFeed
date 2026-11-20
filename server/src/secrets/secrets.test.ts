import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { linuxKeychain, memoryKeychain, checkValue } from './keychain.ts';
import { settingsRoutes } from './routes.ts';
import { SecretStore } from './store.ts';

const H = { 'content-type': 'application/json' };

describe('키 · 토큰 저장 (설정 탭)', () => {
  it('키체인에 저장하고 끝 4자리만 보인다, 지우면 사라진다, 구독 토큰은 CLI 환경으로', async () => {
    const kc = memoryKeychain();
    const s = new SecretStore(kc);
    await s.load();
    await s.set('claude.oauthToken', '  fake-token-abcdEFGH1234  ');
    expect(kc.data.get('claude.oauthToken')).toBe('fake-token-abcdEFGH1234');
    expect(s.status().items.find((i) => i.name === 'claude.oauthToken')).toMatchObject({ saved: true, tail: '••••1234' });
    expect(JSON.stringify(s.status())).not.toContain('abcdEFGH');
    expect(s.claudeEnv()).toEqual({ CLAUDE_CODE_OAUTH_TOKEN: 'fake-token-abcdEFGH1234' });
    await s.remove('claude.oauthToken');
    expect(s.claudeEnv()).toEqual({});
  });

  it('서버를 다시 켜면 키체인에서 다시 읽는다', async () => {
    const kc = memoryKeychain();
    kc.data.set('fish.apiKey', 'fishkey9876');
    const s = new SecretStore(kc);
    await s.load();
    expect(s.get('fish.apiKey')).toBe('fishkey9876');
  });

  it('공백 · 따옴표가 든 값은 받지 않는다', () => {
    expect(checkValue('abc def')).toMatch(/공백/);
    expect(checkValue('ab"c')).toMatch(/따옴표/);
    expect(checkValue('good-token_123')).toBeNull();
  });

  it('키체인을 못 쓰는 컴퓨터면 저장하지 않고 이유를 알린다(평문으로 물러서지 않음)', async () => {
    const s = new SecretStore({ ...memoryKeychain(), check: async () => ({ ok: false as const, hint: 'secret-tool 없음' }) });
    await s.load();
    await expect(s.set('fish.apiKey', 'abcd1234')).rejects.toThrow(/키체인을 쓸 수 없어/);
  });

  it('API: 저장 → 구독 토큰은 바로 확인, 값은 응답에 없다, 모르는 이름은 404', async () => {
    const s = new SecretStore(memoryKeychain());
    await s.load();
    const app = settingsRoutes(s, async () => ({ id: 'claude', name: 'Claude Code', installed: true, version: '2', loggedIn: true, authMethod: 'oauth_token', subscription: 'max', supported: true, hint: null }));
    const r = await app.request('/secrets/claude.oauthToken', { method: 'PUT', headers: H, body: JSON.stringify({ value: 'fake-token-zzzz5678' }) });
    const b = (await r.json()) as { claude: { supported: boolean }; items: Array<{ tail: string | null }> };
    expect(b.claude.supported).toBe(true);
    expect(JSON.stringify(b)).not.toContain('zzzz5678'.slice(0, 4) + '5');
    expect(b.items[0]!.tail).toBe('••••5678');
    expect((await app.request('/secrets/nope', { method: 'PUT', headers: H, body: JSON.stringify({ value: 'x' }) })).status).toBe(404);
    expect((await app.request('/secrets/fish.apiKey', { method: 'PUT', headers: H, body: JSON.stringify({ value: 'bad key' }) })).status).toBe(400);
  });
});

describe('Linux 키체인(secret-tool) — 가짜 도구로 명령 모양 확인', () => {
  it('값은 표준 입력으로만 넘긴다(명령줄 인자에 없다)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-st-'));
    const store = path.join(dir, 'store');
    const log = path.join(dir, 'argv');
    fs.writeFileSync(
      path.join(dir, 'secret-tool'),
      `#!/bin/sh\necho "$@" >> "${log}"\ncase "$1" in\n --version) echo 0.20;;\n store) cat > "${store}";;\n lookup) [ -f "${store}" ] && cat "${store}" || exit 1;;\n clear) rm -f "${store}";;\nesac\n`,
      { mode: 0o755 },
    );
    const old = process.env.PATH;
    process.env.PATH = `${dir}:${old}`;
    try {
      expect(await linuxKeychain.check()).toEqual({ ok: true });
      await linuxKeychain.set('fish.apiKey', 'secret-VALUE-42');
      expect(await linuxKeychain.get('fish.apiKey')).toBe('secret-VALUE-42');
      expect(fs.readFileSync(log, 'utf8')).not.toContain('secret-VALUE-42');
      await linuxKeychain.remove('fish.apiKey');
      expect(await linuxKeychain.get('fish.apiKey')).toBeNull();
    } finally {
      process.env.PATH = old;
    }
  });
});
