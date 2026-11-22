// 글자 두 개 묶음(bigram) 유사도. 질문 중복(FR-ID-2)·축 겹침(FR-ID-4) 검사에 쓴다.
// 의미 비교(임베딩)는 API 키가 필요해 "본인 구독으로 돈다" 원칙과 부딪혀서, 코드로 잴 수 있는 글자 유사도를 쓴다
// (CLAUDE.md 결정 7). 기준값은 설정에 두고 테스트 세트로 재서 정한다.
import { normalizeForQuote } from './grounding.ts';

function bigrams(s: string): Set<string> {
  const t = normalizeForQuote(s).toLowerCase();
  const out = new Set<string>();
  if (t.length === 1) out.add(t);
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

/** 0(전혀 다름) ~ 1(같음) */
export function similarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * 짧은 글(a)의 두 글자 묶음이 긴 글(b)에 얼마나 들어 있나 — 0~1. 짧은 표지 제목과 긴 캡션처럼 길이가 크게 다르면
 * 자카드(similarity)는 늘 작게 나와서, 제목이 캡션 안에 있는지를 따로 잰다(성과 잇기 후보, 2026-11-22)
 */
export function containment(a: string, b: string): number {
  const A = bigrams(a);
  if (A.size === 0) return 0;
  const B = bigrams(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / A.size;
}
