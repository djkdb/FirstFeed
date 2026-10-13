// Claude Code 대화 기록(jsonl)을 제출용 마크다운으로 바꾸는 순수 함수.
// 심사 제출물 「AI 대화 기록」용이라 사람이 읽을 대화(요청·답·도구 사용 요약)만 남기고,
// 모든 글은 가리기 함수(redact)를 거친다.
import { redact, type FindingKind } from '../server/src/lib/redact.ts';

export interface RenderOptions {
  /** 도구 결과(파일 내용·명령 출력)까지 넣을지. 기본은 빼고 도구 이름과 대상만 남긴다 — 길고, 개인정보가 섞이기 쉬워서 */
  withToolResults?: boolean;
}

export interface RenderStats {
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  redacted: Partial<Record<FindingKind, number>>;
  firstAt: string | null;
  lastAt: string | null;
}

type Block = { type: string; text?: string; name?: string; input?: Record<string, unknown>; content?: unknown };
interface Line {
  type?: string;
  isMeta?: boolean;
  isSidechain?: boolean;
  timestamp?: string;
  message?: { content?: string | Block[] };
}

// 하네스가 끼워 넣는 안내문은 사람이 쓴 대화가 아니므로 뺀다
const INJECTED = /<(system-reminder|local-command-caveat|local-command-stdout|command-name|command-message|command-args)>[\s\S]*?<\/\1>/g;
// 붙여넣은 글을 감싸는 표시 태그는 읽기에 방해만 되므로 태그만 지우고 내용은 남긴다
const PASTE_TAG = /<\/?pasted_content[^>]*>/g;
const RESULT_LIMIT = 2000;

function toolSummary(b: Block): string {
  const input = b.input ?? {};
  const target =
    (typeof input.description === 'string' && input.description) ||
    (typeof input.file_path === 'string' && input.file_path) ||
    (typeof input.url === 'string' && input.url) ||
    (typeof input.query === 'string' && input.query) ||
    JSON.stringify(input).slice(0, 120);
  return `🔧 **${b.name ?? '도구'}** — ${target}`;
}

function resultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((c: Block) => (c.type === 'text' ? (c.text ?? '') : `[${c.type}]`)).join('\n');
  }
  return '';
}

export function renderTranscript(sessionId: string, jsonl: string, opts: RenderOptions = {}): { markdown: string; stats: RenderStats } {
  const stats: RenderStats = { userMessages: 0, assistantMessages: 0, toolCalls: 0, redacted: {}, firstAt: null, lastAt: null };
  const parts: string[] = [];

  const safe = (s: string): string => {
    const r = redact(s);
    for (const f of r.findings) stats.redacted[f.kind] = (stats.redacted[f.kind] ?? 0) + 1;
    return r.text;
  };

  for (const raw of jsonl.split('\n')) {
    if (!raw.trim()) continue;
    let line: Line;
    try {
      line = JSON.parse(raw) as Line;
    } catch {
      continue; // 쓰다 만 마지막 줄 등
    }
    if ((line.type !== 'user' && line.type !== 'assistant') || line.isMeta || line.isSidechain) continue;
    if (line.timestamp) {
      stats.firstAt ??= line.timestamp;
      stats.lastAt = line.timestamp;
    }
    const content = line.message?.content;
    const blocks: Block[] = typeof content === 'string' ? [{ type: 'text', text: content }] : (content ?? []);

    if (line.type === 'user') {
      for (const b of blocks) {
        if (b.type === 'text') {
          const text = (b.text ?? '').replace(INJECTED, '').replace(PASTE_TAG, '').trim();
          if (!text) continue;
          stats.userMessages++;
          parts.push(`### 🙋 사람\n\n${safe(text)}`);
        } else if (b.type === 'tool_result' && opts.withToolResults) {
          let text = resultText(b.content);
          if (text.length > RESULT_LIMIT) text = `${text.slice(0, RESULT_LIMIT)}\n… (${text.length - RESULT_LIMIT}자 생략)`;
          parts.push(`<details><summary>도구 결과</summary>\n\n\`\`\`\n${safe(text)}\n\`\`\`\n</details>`);
        }
      }
    } else {
      for (const b of blocks) {
        if (b.type === 'text' && b.text?.trim()) {
          stats.assistantMessages++;
          parts.push(`### 🤖 Claude\n\n${safe(b.text.trim())}`);
        } else if (b.type === 'tool_use') {
          stats.toolCalls++;
          parts.push(safe(toolSummary(b)));
        }
        // thinking 블록은 넣지 않는다 (내부 추론, 제출물로서 읽을 대화가 아님)
      }
    }
  }

  const redactedTotal = Object.values(stats.redacted).reduce((a, b) => a + (b ?? 0), 0);
  const header = [
    `# AI 대화 기록 · 세션 ${sessionId}`,
    '',
    '| 항목 | 내용 |',
    '|---|---|',
    `| 기간 | ${stats.firstAt ?? '?'} ~ ${stats.lastAt ?? '?'} |`,
    `| 사람 메시지 | ${stats.userMessages} |`,
    `| Claude 답 | ${stats.assistantMessages} |`,
    `| 도구 사용 | ${stats.toolCalls} |`,
    `| 가린 값 | ${redactedTotal}건 ${JSON.stringify(stats.redacted)} |`,
    '',
    '> 이메일·전화번호·API 키·토큰·비밀 값은 `[… 가림]` 으로 바꿨다. 도구 사용은 이름과 대상만 남겼다.',
    '',
    '---',
    '',
  ];
  return { markdown: header.join('\n') + parts.join('\n\n') + '\n', stats };
}
