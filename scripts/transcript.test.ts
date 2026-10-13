// 이 파일의 이메일 등은 전부 가짜다. check:privacy 허용 목록에 이 파일 경로가 이유와 함께 올라 있다.
import { describe, expect, it } from 'vitest';
import { renderTranscript } from './transcript.ts';

const jsonl = [
  { type: 'permission-mode', permissionMode: 'auto' },
  { type: 'user', timestamp: '2026-10-13T12:00:00Z', message: { content: '<system-reminder>숨은 안내</system-reminder>안녕, 연락처는 kim@example.com 이야' } },
  { type: 'user', isMeta: true, message: { content: '메타 메시지' } },
  { type: 'assistant', timestamp: '2026-10-13T12:00:05Z', message: { content: [
    { type: 'thinking', thinking: '내부 추론' },
    { type: 'text', text: '확인할게요.' },
    { type: 'tool_use', name: 'Bash', input: { command: 'ls', description: '파일 목록 보기' } },
  ] } },
  { type: 'user', message: { content: [{ type: 'tool_result', content: 'API_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwxyz012345' }] } },
].map((o) => JSON.stringify(o)).join('\n') + '\n{"type":"user", 쓰다 만 줄';

describe('대화 기록 내보내기', () => {
  it('사람·Claude 대화와 도구 요약만 남기고, 안내문·메타·추론은 뺀다', () => {
    const { markdown, stats } = renderTranscript('test-id', jsonl);
    expect(markdown).toContain('안녕, 연락처는 [이메일 가림] 이야');
    expect(markdown).toContain('🔧 **Bash** — 파일 목록 보기');
    expect(markdown).not.toContain('숨은 안내');
    expect(markdown).not.toContain('메타 메시지');
    expect(markdown).not.toContain('내부 추론');
    expect(markdown).not.toContain('kim@example.com');
    expect(stats).toMatchObject({ userMessages: 1, assistantMessages: 1, toolCalls: 1 });
  });

  it('도구 결과는 기본으로 빼고, 넣을 때도 가린다', () => {
    expect(renderTranscript('t', jsonl).markdown).not.toContain('sk-ant');
    const withResults = renderTranscript('t', jsonl, { withToolResults: true });
    expect(withResults.markdown).toContain('[API 키·토큰 가림]');
    expect(withResults.markdown).not.toContain('sk-ant-api03');
    expect(withResults.stats.redacted.api_key).toBe(1);
  });
});
