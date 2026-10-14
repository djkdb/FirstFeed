// HTTP 라우트 정의. 화면(app)은 여기서 내보내는 AppType 으로 요청·응답 타입을 그대로 가져다 쓴다 (Hono RPC).
import fs from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import { env } from './config.ts';
import type { Db } from './db/index.ts';
import { localOnly } from './lib/local-only.ts';
import { detectProviders, type DetectResult } from './ai/detect.ts';
import type { AiService } from './ai/adapter.ts';
import { JobStore } from './ai/jobs.ts';
import { runSmokeExtract } from './tasks/smoke-extract.ts';
import { identityRoutes } from './identity/routes.ts';
import { brandRoutes } from './brand/routes.ts';
import { templateRoutes } from './templates/routes.ts';

export interface AppDeps {
  db: Db;
  ai: AiService;
  /** 테스트에서 실제 CLI 대신 가짜 결과를 넣을 수 있게 주입받는다 */
  detect?: () => Promise<DetectResult>;
  /** 올린 그림 등 데이터 폴더 (테스트는 임시 폴더) */
  dataDir?: string;
}

const SmokeBody = z.object({ source: z.string().max(5000).optional() });

/** 스모크 과제의 기본 원문 (AI 생성 예시 자료). 맨 앞 메모 주석은 뺀다 */
export function defaultSmokeSource(): string {
  const file = path.join(env.repoRoot, 'tests/fixtures/generated/smoke/source-01.md');
  return fs.readFileSync(file, 'utf8').replace(/^\s*<!--[\s\S]*?-->\s*/, '').trim();
}

export function createApp(deps: AppDeps) {
  const jobs = new JobStore(deps.ai);
  const app = new Hono()
    .use('*', localOnly)
    .get('/api/health', (c) => {
      const brand = deps.db.prepare('SELECT id, name FROM brands WHERE user_id = 1 ORDER BY id LIMIT 1').get() as
        | { id: number; name: string }
        | undefined;
      return c.json({ ok: true as const, brand: brand ?? null });
    })
    .get('/api/ai/providers', async (c) => c.json(await (deps.detect ?? detectProviders)()))
    // 시험 호출: 어댑터 → 규칙 → 자기 평가 → 재작성 루프를 실제로 돌려 본다
    .post(
      '/api/ai/smoke',
      validator('json', (value, c) => {
        const body = SmokeBody.safeParse(value);
        if (!body.success) return c.json({ error: '원문은 5000자 이내 글이어야 합니다. 줄여서 다시 시도하세요.' }, 400);
        return body.data;
      }),
      async (c) => {
        const source = c.req.valid('json').source?.trim() || defaultSmokeSource();
        const jobId = jobs.start('smoke_extract', (job) => runSmokeExtract(deps.ai, source, job));
        return c.json({ jobId, source });
      },
    )
    .get('/api/ai/jobs/:jobId', (c) => {
      const state = jobs.get(c.req.param('jobId'));
      if (!state) return c.json({ error: '작업을 찾지 못했습니다. 서버가 다시 시작됐다면 시험 호출을 다시 실행하세요.' }, 404);
      return c.json(state);
    })
    .post('/api/ai/jobs/:jobId/cancel', (c) => c.json({ cancelled: jobs.cancel(c.req.param('jobId')) }))
    .route('/api/identity', identityRoutes(deps.ai, jobs))
    .route('/api/brand', brandRoutes(deps.ai, jobs, deps.dataDir))
    .route('/api/templates', templateRoutes(deps.db, deps.dataDir));
  return app;
}

export type AppType = ReturnType<typeof createApp>;
