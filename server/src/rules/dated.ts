// 기준일이 붙은 숫자 (결정 2026-10-18 · B): 소재 원문에서 「(10월 1일 기준)」처럼 기준일이 걸린 숫자를 쓰면,
// 그 숫자가 나오는 곳 중 적어도 한 곳에 기준일이 같이 있어야 한다. 표지 제목·부제는 칸이 좁아 예외(부르는 쪽이 넘기지 않는다).
//
// 원문에서 「숫자 ↔ 기준일」 묶음 찾기: **「날짜 + 기준」이 있는 줄의 같은 줄 숫자**를 그 날짜에 묶는다. 날짜 자체의 숫자는 뺀다.
// 알려진 한계(못 찾거나 더 묶는 모양):
// - 기준일과 숫자가 다른 줄에 있으면 못 묶는다(예: 「10월 1일 기준 현황」 아래 줄마다 숫자 목록)
// - 날짜 없이 「현황판 기준」처럼만 쓴 것은 기준일로 보지 않는다
// - 같은 줄의 숫자는 다 묶는다 — 「최근 7일」의 7 처럼 기간을 뜻하는 숫자도 같이 묶여, 그 숫자만 따로 쓸 때도 기준일을 요구할 수 있다
import { numbersIn } from './grounding.ts';

const DATE = /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?|(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;

export interface DateMark {
  month: number;
  day: number;
  /** 원문에 적힌 그대로 (안내 문구용) */
  text: string;
}

function datesIn(s: string): DateMark[] {
  return [...s.matchAll(DATE)].map((m) => ({ month: Number(m[2] ?? m[4]), day: Number(m[3] ?? m[5]), text: m[0].trim() }));
}

/** 원문 줄마다: 「날짜 … 기준」이 있으면 그 줄의 (날짜를 지운) 숫자들을 그 날짜에 묶는다 */
export function datedNumbers(source: string): Map<string, DateMark> {
  const out = new Map<string, DateMark>();
  for (const line of source.split('\n')) {
    const basis = [...line.matchAll(new RegExp(`(?:${DATE.source})\\s*기준`, 'g'))];
    if (basis.length === 0) continue;
    const date = datesIn(basis[0]![0])[0]!;
    for (const n of numbersIn(line.replace(DATE, ' '))) if (!out.has(n)) out.set(n, date);
  }
  return out;
}

/** 글에 그 기준일(같은 월·일)이 어떤 모양으로든 있는가 — 「10월 1일」·「2026.10.01」·「10/1」 */
export function hasDate(text: string, d: DateMark): boolean {
  if (datesIn(text).some((x) => x.month === d.month && x.day === d.day)) return true;
  return [...text.matchAll(/(?<![\d.])(\d{1,2})\/(\d{1,2})(?![\d/])/g)].some((m) => Number(m[1]) === d.month && Number(m[2]) === d.day);
}

/**
 * 글 묶음(카드들 또는 캡션) 안에서: 기준일 숫자가 나오는 글이 있으면 그중 한 곳에는 기준일이 있어야 한다.
 * skip: 이 숫자는 다른 곳(본문 카드)이 이미 지키니 보지 않는다
 */
export function datedNumberIssues(texts: Array<{ where: string; text: string }>, dated: Map<string, DateMark>, skip: Set<string> = new Set()): Array<{ where: string; number: string; date: DateMark }> {
  const out: Array<{ where: string; number: string; date: DateMark }> = [];
  for (const [n, d] of dated) {
    if (skip.has(n)) continue;
    const using = texts.filter((t) => numbersIn(t.text).includes(n));
    if (using.length > 0 && !using.some((t) => hasDate(t.text, d))) out.push({ where: using[0]!.where, number: n, date: d });
  }
  return out;
}
