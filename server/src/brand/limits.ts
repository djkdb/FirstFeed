// 인스타 글자 수·아이디 규칙과 명암비. 출처 등급은 CLAUDE.md 결정 2026-10-14 · 브랜딩 키트 설계 참고.

/**
 * 인스타 칸에 들어갈 글자 수 — 엄하게 센다.
 * 인스타가 이모지를 1자로 세는지 2자(UTF-16)로 세는지 확인 전이라, 글자(grapheme) 수와 UTF-16 길이 중 큰 값.
 * 이렇게 세면 우리가 "안 넘친다"고 한 글이 실제 앱에서 잘리는 일은 없다 (사용자가 앱에서 확인하면 결정 기록 후 바꾼다)
 */
export function instagramLength(s: string): number {
  const graphemes = [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(s)].length;
  return Math.max(graphemes, s.length);
}

/**
 * 아이디 규칙 (외부 자료 등급, 공식 원문 아님): 영문 소문자·숫자·마침표·밑줄, 1~max 자, 마침표로 시작·끝 금지, 연속 마침표 금지.
 * 엄한 쪽으로 적용한다 — 실제보다 엄하면 후보 몇 개를 버릴 뿐이지만, 느슨하면 쓸 수 없는 아이디를 제안한다.
 * 문제 목록을 돌려준다 (비어 있으면 통과)
 */
export function handleProblems(handle: string, max: number): string[] {
  const out: string[] = [];
  if (!/^[a-z0-9._]+$/.test(handle)) out.push('영문 소문자·숫자·마침표(.)·밑줄(_)만 쓸 수 있습니다');
  if (handle.length > max) out.push(`${max}자를 넘습니다(${handle.length}자)`);
  if (handle.startsWith('.') || handle.endsWith('.')) out.push('마침표로 시작하거나 끝날 수 없습니다');
  if (handle.includes('..')) out.push('마침표를 연달아 쓸 수 없습니다');
  return out;
}

/** 바이오 안의 주소 (링크는 따로 있는 링크 칸에 — 고정 규칙) */
// 링크 서비스 주소(linktr.ee·bit.ly 등)까지 잡되, "@zun.ai" 같은 아이디는 주소가 아니므로 @ 바로 뒤는 뺀다.
// "Next.js" 같은 기술 이름이 걸리지 않게 끝 이름(TLD)은 목록으로 둔다
export const URL_IN_TEXT =
  /https?:\/\/|www\.|(?<![@\w.])[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|me|co|kr|link|bio|app|dev|ai|ee|ly|gl|to|page|site|xyz|so|tv|gg)\b/i;

/** 글 속 @아이디 */
export function mentionsIn(text: string): string[] {
  return [...text.matchAll(/@([a-z0-9._]+)/gi)].map((m) => m[1]!.toLowerCase());
}

// ── 명암비 (WCAG 2.x 상대 휘도) ──────────────────────────────────────────

export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) throw new Error(`색 값 "${hex}" 이 #RRGGBB 형식이 아닙니다.`);
  const [r, g, b] = rgb.map(channel) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 두 색의 명암비 (1~21) */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
