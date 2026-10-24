// 「오늘 올릴 것」 예정일 계산 (FR-HM-1 · 결정 2026-10-24). 코드만 — AI 없음. 날짜는 그 컴퓨터의 날짜(YYYY-MM-DD)로 센다.
// - 간격: every3 = 3일마다, twice = 주 2회(3일 · 4일 번갈아 → 일주일에 두 번), thrice = 주 3회(2 · 2 · 3일)
// - 「하루 미루기」: 그 칸의 미룬 날 수가 그 칸과 **뒤의 모든 칸**에 더해진다(한 칸만 밀면 다음 칸과 겹치니까)
// - 올린 칸은 예정일과 상관없이 끝난 칸. 오늘 할 칸 = 안 올린 칸 중 예정일이 오늘이거나 지난 가장 앞 칸
export type Cadence = 'every3' | 'twice' | 'thrice';
export const CADENCES: Cadence[] = ['every3', 'twice', 'thrice'];

const STEPS: Record<Cadence, number[]> = { every3: [3], twice: [3, 4], thrice: [2, 2, 3] };

/** 'YYYY-MM-DD' 에 날 수를 더한다(시간대 영향 없게 UTC 정오로 계산) */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 칸마다 예정일. delays[i] = i번 칸에서 「하루 미루기」를 누른 횟수 */
export function dueDates(start: string, count: number, cadence: Cadence, delays: number[] = []): string[] {
  const steps = STEPS[cadence];
  const out: string[] = [];
  let offset = 0;
  let pushed = 0;
  for (let i = 0; i < count; i++) {
    if (i > 0) offset += steps[(i - 1) % steps.length]!;
    pushed += delays[i] ?? 0;
    out.push(addDays(start, offset + pushed));
  }
  return out;
}

export interface SlotDay {
  due: string;
  posted: boolean;
}

/** 오늘 할 칸(없으면 null)과 그다음 칸(예정일이 아직 안 온 첫 안 올린 칸) */
export function pickToday(slots: SlotDay[], today: string): { today: number | null; next: number | null } {
  const open = slots.map((s, i) => ({ ...s, i })).filter((s) => !s.posted);
  const due = open.find((s) => s.due <= today);
  const next = open.find((s) => s.due > today && s.i !== due?.i);
  return { today: due?.i ?? null, next: next?.i ?? null };
}

/** 그 컴퓨터의 오늘 날짜 */
export const localToday = (now: Date = new Date()) => now.toLocaleDateString('sv-SE');
