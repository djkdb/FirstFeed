import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 개발 중에는 화면(5173)이 /api 요청을 로컬 서버(4317)로 넘긴다.
// 서버 포트는 server/src/config.ts 의 기본값과 같아야 한다 — 바꾸면 FIRSTFEED_PORT 를 양쪽에 같이 준다.
const serverPort = Number(process.env.FIRSTFEED_PORT ?? 4317);

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${serverPort}` },
  },
});
