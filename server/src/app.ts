// HTTP 라우트 정의. 화면(app)은 여기서 내보내는 AppType 으로 요청·응답 타입을 그대로 가져다 쓴다 (Hono RPC).
import { Hono } from 'hono';
import type { Db } from './db/index.ts';
import { localOnly } from './lib/local-only.ts';
import { detectProviders, type DetectResult } from './ai/detect.ts';

export interface AppDeps {
  db: Db;
  /** 테스트에서 실제 CLI 대신 가짜 결과를 넣을 수 있게 주입받는다 */
  detect?: () => Promise<DetectResult>;
}

export function createApp(deps: AppDeps) {
  const app = new Hono()
    .use('*', localOnly)
    .get('/api/health', (c) => {
      const brand = deps.db.prepare('SELECT id, name FROM brands WHERE user_id = 1 ORDER BY id LIMIT 1').get() as
        | { id: number; name: string }
        | undefined;
      return c.json({ ok: true as const, brand: brand ?? null });
    })
    .get('/api/ai/providers', async (c) => c.json(await (deps.detect ?? detectProviders)()));
  return app;
}

export type AppType = ReturnType<typeof createApp>;
