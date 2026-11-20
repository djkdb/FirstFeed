// 설정 탭 — 키 · 토큰 저장 API (사용자 지시 2026-11-20). 값은 받기만 하고 돌려주지 않는다(끝 4자리만)
import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import { ClaudeCodeProvider } from '../ai/providers/claude-code.ts';
import type { ProviderStatus } from '../ai/types.ts';
import { KeychainError } from './keychain.ts';
import { isSecretName, type SecretStore } from './store.ts';

const bad = (error: string) => ({ error });

export function settingsRoutes(secrets: SecretStore, verifyClaude: () => Promise<ProviderStatus> = () => new ClaudeCodeProvider().detect()) {
  return new Hono()
    .get('/secrets', (c) => c.json(secrets.status()))
    .put(
      '/secrets/:name',
      validator('json', (v, c) => {
        const b = z.object({ value: z.string().max(5000) }).safeParse(v);
        return b.success ? b.data : c.json(bad('값을 다시 붙여 넣어 주세요.'), 400);
      }),
      async (c) => {
        const name = c.req.param('name');
        if (!isSecretName(name)) return c.json(bad('저장할 수 없는 이름이에요.'), 404);
        try {
          await secrets.set(name, c.req.valid('json').value);
        } catch (e) {
          if (e instanceof KeychainError) return c.json(bad(`${e.message} ${e.hint}`.trim()), 400);
          throw e;
        }
        // 구독 토큰은 저장 직후 실제로 확인한다 — 「저장됨」이 「쓸 수 있음」은 아니어서
        const claude = name === 'claude.oauthToken' ? await verifyClaude() : null;
        return c.json({ ...secrets.status(), claude });
      },
    )
    .delete('/secrets/:name', async (c) => {
      const name = c.req.param('name');
      if (!isSecretName(name)) return c.json(bad('지울 수 없는 이름이에요.'), 404);
      await secrets.remove(name);
      return c.json(secrets.status());
    })
    .post('/claude/verify', async (c) => c.json({ claude: await verifyClaude() }));
}
