import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/**/*.test.ts', 'scripts/**/*.test.ts'],
    // 실제 AI 호출 테스트는 기본 실행에서 빼고 따로 돌린다 (구독 사용량·시간이 들어서)
    exclude: ['**/node_modules/**', '**/*.live.test.ts'],
  },
});
