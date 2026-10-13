import { describe, expect, it } from 'vitest';
import { ClaudeCodeProvider } from './providers/claude-code.ts';
import { detectProviders } from './detect.ts';

describe('AI 공급자 확인', () => {
  it('Claude Code 가 설치되어 있지 않으면 설치 안내와 대체 경로(API 키)를 알려 준다', async () => {
    const result = await detectProviders(new ClaudeCodeProvider({ bin: 'firstfeed-없는-claude' }));
    const claude = result.providers.find((p) => p.id === 'claude');
    expect(claude).toMatchObject({ installed: false, loggedIn: null });
    expect(claude?.hint).toMatch(/설치/);
    expect(result.hint).toMatch(/API 키/);
  });

  it('Codex·Gemini 는 설치 여부만 보이고 아직 지원하지 않는다고 표시한다', async () => {
    const result = await detectProviders(new ClaudeCodeProvider({ bin: 'firstfeed-없는-claude' }));
    for (const id of ['codex', 'gemini']) {
      expect(result.providers.find((p) => p.id === id)).toMatchObject({ supported: false });
    }
  });
});
