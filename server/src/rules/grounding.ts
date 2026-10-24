// 근거 규칙 (지어내기 방지는 코드로, FR-MK-2·FR-ID-4).
// 1) 인용은 원문에 실제로 있어야 한다  2) 숫자·영문 이름은 허용 출처 4가지 안에 있어야 한다.
// 한글 수사("다섯 가지")는 지금은 검사하지 않는다 — 문제가 생기면 CLAUDE.md 「겪은 오류」에 남기고 추가.

/** 허용 출처 4가지 (CLAUDE.md 「이미 내린 결정」) */
export interface GroundingSources {
  /** 1. 소재 원문 */
  source: string[];
  /** 2. 브랜드 프로필·브랜딩 키트 */
  brand?: string[];
  /** 3. 구조에서 나온 숫자 (카드 장수 등) */
  structural?: number[];
  /** 4. 사용자가 직접 입력한 문장 (인터뷰 답변·메모) */
  userInput?: string[];
}

/** 인용 비교용: 공백·문장부호·기호를 지운다. "원문 그대로"를 띄어쓰기 차이로 놓치지 않으려고 */
export function normalizeForQuote(s: string): string {
  return s.normalize('NFC').replace(/[\s\p{P}\p{S}]/gu, '');
}

export function quoteInSources(quote: string, texts: string[]): boolean {
  const q = normalizeForQuote(quote);
  if (q.length === 0) return false;
  return texts.some((t) => normalizeForQuote(t).includes(q));
}

/** 글 속 숫자를 비교할 수 있는 모양으로: 천 단위 쉼표를 지운다 (1,500 → 1500) */
export function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/,(?=\d{3}(?!\d))/g, ''));
}

/** 글 속 영문 이름·용어 (두 글자 이상). "A/B" 같은 한 글자는 이름이 아닌 경우가 많아 뺀다 */
export function englishTermsIn(text: string): string[] {
  return (text.match(/[A-Za-z][A-Za-z0-9+#.-]*[A-Za-z0-9+#]/g) ?? []).map((t) => t.replace(/\.+$/, ''));
}

/**
 * 목록 번호 빼기(결정 2026-10-25): 줄 첫머리의 목록 표시(「1.」 「2)」)가 1부터 차례로 이어지면 그 번호는 구조에서 나온 숫자(허용 출처 3번)라
 * 근거 대조에서 뺀다 — 그 자리만 공백으로 바꿔 돌려준다. 차례가 깨진 번호(1 다음 3)와 문장 안의 숫자는 그대로 남아 검사된다.
 * 새 「1.」 이 나오면 새 목록으로 본다. 목록 사이의 다른 줄(빈 줄 · 이어 쓴 줄)은 차례를 끊지 않는다.
 * 「①」 같은 동그라미 숫자는 \d 가 아니라서 처음부터 숫자로 세지 않는다
 */
export function stripListMarkers(text: string): string {
  let expected = 1;
  return text
    .split('\n')
    .map((line) => {
      const m = /^(\s*)(\d{1,2})([.)])(?=\s)/.exec(line);
      if (!m) return line;
      const n = Number(m[2]);
      if (n === 1) expected = 1;
      if (n !== expected) return line;
      expected++;
      return `${m[1]}${' '.repeat(m[2]!.length)}${m[3]}${line.slice(m[0].length)}`;
    })
    .join('\n');
}

export interface UngroundedClaim {
  kind: 'number' | 'english';
  value: string;
}

/**
 * 허용 출처 어디에도 없는 숫자·영문 이름을 찾는다.
 * commonTerms: 흔한 영문 약어(설정 grounding.commonEnglish). 일부러 필수 인자로 둬서 새 생성이 빠뜨리지 못하게 한다.
 * 약어는 낱말 전체가 같을 때만 통과(대소문자 무시) — "DM" 이 있다고 "DMV" 가 통과하지 않게
 */
export function findUngrounded(text: string, sources: GroundingSources, commonTerms: readonly string[]): UngroundedClaim[] {
  const common = new Set(commonTerms.map((t) => t.toLowerCase()));
  const texts = [...sources.source, ...(sources.brand ?? []), ...(sources.userInput ?? [])];
  const allowedNumbers = new Set([...texts.flatMap(numbersIn), ...(sources.structural ?? []).map(String)]);
  const haystack = texts.join('\n').toLowerCase();
  const out: UngroundedClaim[] = [];
  const seen = new Set<string>();
  for (const n of numbersIn(stripListMarkers(text))) {
    if (!allowedNumbers.has(n) && !seen.has(`n:${n}`)) {
      seen.add(`n:${n}`);
      out.push({ kind: 'number', value: n });
    }
  }
  for (const t of englishTermsIn(text)) {
    if (!common.has(t.toLowerCase()) && !haystack.includes(t.toLowerCase()) && !seen.has(`e:${t}`)) {
      seen.add(`e:${t}`);
      out.push({ kind: 'english', value: t });
    }
  }
  return out;
}
