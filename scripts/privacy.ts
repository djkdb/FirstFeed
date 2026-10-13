// 공개 레포 개인정보 검사의 판정 부분. 실행·git 처리는 check-privacy.ts 가 맡고, 여기는 테스트할 수 있는 순수 함수만 둔다.
import { findSensitive, labelOf, type Finding } from '../server/src/lib/redact.ts';

/** 오탐 허용 항목. 경로(파일 전체) 또는 값(그 문자열만) 중 하나와, 왜 허용하는지 한 줄 이유가 반드시 있어야 한다. */
export type AllowEntry = { path: string; reason: string } | { value: string; reason: string };

export interface Allowlist {
  entries: AllowEntry[];
}

/** 허용 목록 파일을 검사한다. 이유가 없거나 여러 줄이면 허용 목록 자체를 거절한다 — 이유 없는 예외가 쌓이지 않게. */
export function validateAllowlist(raw: unknown): { ok: true; list: Allowlist } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const entries = (raw as { entries?: unknown })?.entries;
  if (!Array.isArray(entries)) {
    return { ok: false, errors: ['허용 목록에 "entries" 배열이 없습니다. { "entries": [] } 형식으로 고치세요.'] };
  }
  entries.forEach((e: Record<string, unknown>, i) => {
    const where = `entries[${i}]`;
    const hasPath = typeof e?.path === 'string' && e.path.length > 0;
    const hasValue = typeof e?.value === 'string' && e.value.length > 0;
    if (hasPath === hasValue) errors.push(`${where}: "path" 와 "value" 중 정확히 하나만 적으세요.`);
    const reason = e?.reason;
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      errors.push(`${where}: "reason"(허용하는 이유 한 줄)이 없습니다. 왜 오탐인지 한 줄로 적으세요.`);
    } else if (/[\r\n]/.test(reason)) {
      errors.push(`${where}: "reason" 은 한 줄이어야 합니다. 줄바꿈을 빼세요.`);
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true, list: { entries: entries as AllowEntry[] } };
}

export interface FileFinding extends Finding {
  path: string;
}

/** 파일 하나를 검사해 허용 목록에 없는 찾기 결과만 돌려준다. */
export function scanFile(path: string, text: string, list: Allowlist): FileFinding[] {
  if (list.entries.some((e) => 'path' in e && e.path === path)) return [];
  const allowedValues = new Set(list.entries.flatMap((e) => ('value' in e ? [e.value] : [])));
  return findSensitive(text)
    .filter((f) => !allowedValues.has(f.match))
    .map((f) => ({ ...f, path }));
}

/** 터미널에 찍을 때도 값 전체를 다시 노출하지 않도록 앞부분만 보여준다. */
export function describeFinding(f: FileFinding): string {
  const shown = f.match.length <= 4 ? '****' : `${f.match.slice(0, 3)}****`;
  return `${f.path}:${f.line}  [${labelOf(f.kind)}] ${shown}`;
}
