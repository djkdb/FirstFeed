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

export interface UngroundedClaim {
  kind: 'number' | 'english';
  value: string;
}

/** 허용 출처 어디에도 없는 숫자·영문 이름을 찾는다 */
export function findUngrounded(text: string, sources: GroundingSources): UngroundedClaim[] {
  const texts = [...sources.source, ...(sources.brand ?? []), ...(sources.userInput ?? [])];
  const allowedNumbers = new Set([...texts.flatMap(numbersIn), ...(sources.structural ?? []).map(String)]);
  const haystack = texts.join('\n').toLowerCase();
  const out: UngroundedClaim[] = [];
  const seen = new Set<string>();
  for (const n of numbersIn(text)) {
    if (!allowedNumbers.has(n) && !seen.has(`n:${n}`)) {
      seen.add(`n:${n}`);
      out.push({ kind: 'number', value: n });
    }
  }
  for (const t of englishTermsIn(text)) {
    if (!haystack.includes(t.toLowerCase()) && !seen.has(`e:${t}`)) {
      seen.add(`e:${t}`);
      out.push({ kind: 'english', value: t });
    }
  }
  return out;
}
