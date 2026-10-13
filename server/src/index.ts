// 로컬 서버 시작점: DB 를 열고 127.0.0.1 에서만 듣는다.
import path from 'node:path';
import { serve } from '@hono/node-server';
import { env } from './config.ts';
import { openDb } from './db/index.ts';
import { createApp } from './app.ts';
import { AiService } from './ai/adapter.ts';
import { ClaudeCodeProvider } from './ai/providers/claude-code.ts';

const db = openDb(path.join(env.dataDir, 'firstfeed.sqlite'));
const ai = new AiService({ db, provider: new ClaudeCodeProvider() });
const app = createApp({ db, ai });

const server = serve({ fetch: app.fetch, hostname: env.host, port: env.port }, (info) => {
  console.log(`[서버] http://${env.host}:${info.port} 에서 실행 중 (데이터: ${env.dataDir})`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[서버] 포트 ${env.port} 를 이미 다른 프로그램이 쓰고 있습니다. 실행 중인 퍼스트피드를 끄거나, FIRSTFEED_PORT 환경 변수로 다른 포트를 지정해 다시 실행하세요.`,
    );
    process.exit(1);
  }
  throw err;
});
