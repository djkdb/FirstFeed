// 첫 실행·설정 화면에서 쓰는 공급자 확인 (FR-AI-1).
import { ClaudeCodeProvider, detectUnsupported } from './providers/claude-code.ts';
import type { ProviderStatus } from './types.ts';

export interface DetectResult {
  providers: ProviderStatus[];
  /** 지금 쓸 수 있는 공급자가 하나도 없을 때의 안내 */
  hint: string | null;
}

export async function detectProviders(claude = new ClaudeCodeProvider()): Promise<DetectResult> {
  const providers = await Promise.all([
    claude.detect(),
    detectUnsupported('codex', 'Codex CLI', 'codex'),
    detectUnsupported('gemini', 'Gemini CLI', 'gemini'),
  ]);
  const usable = providers.some((p) => p.supported && p.installed && p.loggedIn);
  return {
    providers,
    hint: usable
      ? null
      : '지금 쓸 수 있는 AI 가 없습니다. Claude Code 를 설치·로그인하거나, Anthropic API 키를 입력하세요 (API 키 입력은 곧 추가됩니다).',
  };
}
