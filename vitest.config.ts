import { defineConfig } from 'vitest/config';

// 실제 AI 호출 테스트(*.live.test.ts)는 기본 실행에서 빼고 따로 돌린다 (구독 사용량·시간이 들어서)
// 실제 브라우저로 그리는 테스트(*.browser.test.ts)는 단위 테스트가 끝난 뒤 파일 하나씩 돌린다 —
// 같이 돌리면 Chromium 여러 개가 CPU 를 잡아서 상관없는 테스트까지 5초 제한에 걸렸다(3번 중 1번, 2026-10-15)
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['server/**/*.test.ts', 'scripts/**/*.test.ts', 'app/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/*.live.test.ts', '**/*.browser.test.ts'],
        },
      },
      {
        test: {
          name: 'browser',
          include: ['server/**/*.browser.test.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
