// 개인정보·비밀 값 찾기와 가리기.
// 대화 원본 내보내기와 공개 레포 검사(check:privacy)가 같은 규칙을 쓰도록 한 곳에 둔다 —
// 한쪽만 고쳐서 내보낸 기록에는 가려지는데 커밋 검사에는 안 걸리는 일이 없게.

export type FindingKind = 'private_key' | 'api_key' | 'jwt' | 'secret_assignment' | 'email' | 'phone';

export interface Finding {
  kind: FindingKind;
  match: string;
  index: number;
  line: number;
}

interface Rule {
  kind: FindingKind;
  label: string;
  pattern: RegExp;
}

// 순서가 중요하다: 더 구체적인 규칙(키 형식)을 먼저 적용해야 이메일·전화번호 규칙이 키 일부를 잘라 먹지 않는다.
const RULES: Rule[] = [
  {
    kind: 'private_key',
    label: '개인 키',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
  {
    kind: 'api_key',
    label: 'API 키·토큰',
    pattern: new RegExp(
      [
        String.raw`sk-ant-[A-Za-z0-9_-]{20,}`, // Anthropic
        String.raw`sk-(?:proj-)?[A-Za-z0-9_-]{20,}`, // OpenAI
        String.raw`AIza[0-9A-Za-z_-]{35}`, // Google
        String.raw`gh[pousr]_[A-Za-z0-9]{36,}`, // GitHub
        String.raw`github_pat_[A-Za-z0-9_]{22,}`,
        String.raw`xox[abposr]-[A-Za-z0-9-]{10,}`, // Slack
        String.raw`AKIA[0-9A-Z]{16}`, // AWS
        String.raw`EAA[A-Za-z0-9]{30,}`, // Meta(인스타 Graph API) 액세스 토큰
        String.raw`sb_(?:secret|publishable)_[A-Za-z0-9_-]{20,}`, // Supabase
      ].join('|'),
      'g',
    ),
  },
  {
    kind: 'jwt',
    label: '토큰(JWT)',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  },
  {
    // "password: abcd1234" 처럼 이름 붙은 비밀 값. 이름은 남기고 값만 가린다.
    // \b 는 한글 앞에서 경계로 인정되지 않아("앱 비밀번호"를 못 잡음) 영문·숫자가 앞에 없는지로 대신 본다.
    kind: 'secret_assignment',
    label: '비밀 값',
    pattern:
      /(?<=(?<![A-Za-z0-9_])(?:api[_-]?key|secret|token|password|passwd|app[_-]?password|비밀번호|앱 ?비밀번호)\s*["']?\s*[:=]\s*["']?)[^\s"',;]{8,}/gi,
  },
  {
    kind: 'email',
    label: '이메일',
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
  },
  {
    // 한국 전화번호: 휴대폰(010-1234-5678, 01012345678), 지역번호(02-123-4567), 국제(+82 10-1234-5678)
    kind: 'phone',
    label: '전화번호',
    pattern: /(?<![\d.-])(?:\+82[ -]?|0)(?:1[016789]|2|[3-6][1-5]|70)[ .-]?\d{3,4}[ .-]?\d{4}(?![\d-])/g,
  },
];

const LABELS = Object.fromEntries(RULES.map((r) => [r.kind, r.label])) as Record<FindingKind, string>;

function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** 글에서 개인정보·비밀 값을 모두 찾는다. 겹치는 찾기 결과는 먼저 적용된(더 구체적인) 규칙만 남긴다. */
export function findSensitive(text: string): Finding[] {
  const taken: Array<[number, number]> = [];
  const findings: Finding[] = [];
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.pattern)) {
      const start = m.index;
      const end = start + m[0].length;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      taken.push([start, end]);
      findings.push({ kind: rule.kind, match: m[0], index: start, line: lineAt(text, start) });
    }
  }
  return findings.sort((a, b) => a.index - b.index);
}

/** 찾은 값을 "[이메일 가림]" 같은 표시로 바꾼 글을 돌려준다. */
export function redact(text: string): { text: string; findings: Finding[] } {
  const findings = findSensitive(text);
  let out = '';
  let cursor = 0;
  for (const f of findings) {
    out += text.slice(cursor, f.index) + `[${LABELS[f.kind]} 가림]`;
    cursor = f.index + f.match.length;
  }
  out += text.slice(cursor);
  return { text: out, findings };
}

export function labelOf(kind: FindingKind): string {
  return LABELS[kind];
}
