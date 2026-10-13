// AI 출력에서 JSON 꺼내기. 공급자마다 출력 모양이 달라도(구조화 칸이 있거나, 글 속에 섞이거나) 여기서 한 번에 처리한다.
import { jsonrepair } from 'jsonrepair';

export type ExtractVia = 'structured' | 'plain' | 'fence' | 'balanced' | 'repaired';
export type ExtractResult = { ok: true; value: unknown; via: ExtractVia } | { ok: false; error: string };

function tryParse(s: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch {
    return { ok: false };
  }
}

/** 글에서 처음 나오는 완결된 {…} 또는 […] 덩어리를 찾는다. 문자열 안의 괄호는 세지 않는다. */
export function firstBalanced(text: string): string | null {
  const start = text.search(/[{[]/);
  if (start < 0) return null;
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
    else if (ch === '}' || ch === ']') {
      if (stack.pop() !== ch) return null;
      if (stack.length === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * 순서: 구조화 결과 → 글 전체 → 코드 블록 → 첫 완결 괄호 → 깨진 JSON 복구(jsonrepair).
 * 앞 단계일수록 확실하므로 먼저 시도한다. 복구는 마지막 수단 — 어떤 경로로 꺼냈는지 로그에 남긴다.
 */
export function extractJson(structured: unknown, text: string): ExtractResult {
  if (structured !== undefined && structured !== null) return { ok: true, value: structured, via: 'structured' };
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: '응답이 비어 있습니다.' };

  const plain = tryParse(trimmed);
  if (plain.ok) return { ok: true, value: plain.value, via: 'plain' };

  const fence = /```(?:json)?\s*\n([\s\S]*?)```/.exec(trimmed)?.[1];
  if (fence) {
    const r = tryParse(fence.trim());
    if (r.ok) return { ok: true, value: r.value, via: 'fence' };
  }

  const balanced = firstBalanced(fence ?? trimmed);
  if (balanced) {
    const r = tryParse(balanced);
    if (r.ok) return { ok: true, value: r.value, via: 'balanced' };
  }

  // 복구는 JSON 처럼 보이는 부분에만 시도한다 — 일반 문장을 억지로 JSON 문자열로 만들지 않게
  const candidate = balanced ?? fence ?? trimmed.slice(Math.max(0, trimmed.search(/[{[]/)));
  if (/^[{[]/.test(candidate)) {
    try {
      return { ok: true, value: JSON.parse(jsonrepair(candidate)), via: 'repaired' };
    } catch {
      /* 아래에서 실패로 */
    }
  }
  return { ok: false, error: `응답에서 JSON 을 찾지 못했습니다. 응답 앞부분: ${trimmed.slice(0, 120)}` };
}
