// 표지의 개수 표현 ↔ 본문 카드 수 (구조 규칙, 결정 2026-10-15 · FR-MK-1).
// 개수 표현(N가지·N개·N단계·N곳·N팁 …)에만 건다 — "3분 만에"·"2026년"·"1,500명"처럼 개수가 아닌 숫자는 보지 않는다.
// 한글 수사(한 가지~열두 가지)도 여기서는 확인한다: 근거 규칙의 알려진 한계였지만 카드 수와 맞추는 일이라 코드로 확실히 잰다
const KOREAN: Record<string, number> = {
  한: 1, 하나: 1, 두: 2, 둘: 2, 세: 3, 셋: 3, 석: 3, 네: 4, 넷: 4, 넉: 4,
  다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 열한: 11, 열하나: 11, 열두: 12, 열둘: 12,
};
// 개수 단위. "개월"·"개년"은 기간이라 뺀다
const UNIT = '(?:가지|단계|곳|팁|스텝|개(?![월년]))';
const NUMERAL = Object.keys(KOREAN).sort((a, b) => b.length - a.length).join('|');
const DIGIT_COUNT = new RegExp(`(?<![\\d.,])(\\d{1,2})\\s?${UNIT}`, 'g');
const KOREAN_COUNT = new RegExp(`(?<![가-힣])(${NUMERAL})\\s?${UNIT}`, 'g');

export interface CountClaim {
  value: number;
  text: string;
}

/** 글 속 개수 표현 — 숫자("5가지")와 한글 수사("다섯 가지") 모두 */
export function countClaims(text: string): CountClaim[] {
  const plain = text.replace(/\*\*/g, '');
  return [
    ...[...plain.matchAll(DIGIT_COUNT)].map((m) => ({ value: Number(m[1]), text: m[0] })),
    ...[...plain.matchAll(KOREAN_COUNT)].map((m) => ({ value: KOREAN[m[1]!]!, text: m[0] })),
  ];
}

/** 표지 제목·부제의 개수 표현이 본문 카드 수와 다르면 문제 문구 (없으면 null) */
export function countMismatch(texts: string[], bodyCount: number): string | null {
  const claims = texts.flatMap(countClaims);
  const wrong = claims.filter((c) => c.value !== bodyCount);
  if (wrong.length === 0) return null;
  return `표지의 개수 표현 ${wrong.map((c) => `"${c.text.trim()}"`).join(', ')} 이 본문 카드 수(${bodyCount}장)와 다릅니다. 개수를 카드 수에 맞추거나 개수 표현을 빼세요.`;
}
