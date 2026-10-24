// 「오늘 올릴 것」 홈 (FR-HM-1~3 · 결정 2026-10-24). 30일 계획(series_plans 최신 판)의 칸마다 이은 세트 · 올린 날 · 미룬 날을 붙여
// 오늘 할 칸을 고른다. AI 는 부르지 않는다. 「올렸어요」는 사용자 표시일 뿐 — 인스타에 올라갔는지 확인하지 않는다(비공식 자동화 금지).
// 세트를 잇거나 올린 칸은 계획에서 고정한다(editSlot locked) — 계획을 다시 만들어도 같은 번호 칸에 남아 이 표와 어긋나지 않게. SQL 은 이 파일에만
import type { DatabaseSync } from 'node:sqlite';
import { getSet, listSets } from '../cards/store.ts';
import { getSetting, setSetting } from '../config.ts';
import { FlowError } from '../identity/flow.ts';
import { activeProfile } from '../identity/store.ts';
import { editSlot, latestPlan } from '../preview/plan.ts';
import { homeMarks, type HomeMark } from './marks.ts';
import { CADENCES, dueDates, localToday, pickToday, type Cadence } from './schedule.ts';

type Db = DatabaseSync;

type Mark = HomeMark;
const marks = homeMarks;

function upsert(db: Db, brandId: number, idx: number, patch: Partial<Mark>): void {
  const prev = marks(db, brandId).get(idx) ?? { setId: null, postedAt: null, delayDays: 0 };
  const m = { ...prev, ...patch };
  db.prepare(
    `INSERT INTO home_slots (brand_id, slot_idx, set_id, posted_at, delay_days) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(brand_id, slot_idx) DO UPDATE SET set_id = excluded.set_id, posted_at = excluded.posted_at, delay_days = excluded.delay_days, updated_at = datetime('now')`,
  ).run(brandId, idx, m.setId, m.postedAt, m.delayDays);
}

export type SlotState = 'plan' | 'made' | 'posted';

export interface HomeSlot {
  idx: number;
  title: string;
  pillarName: string | null;
  due: string;
  state: SlotState;
  setId: number | null;
  setCover: string | null;
  postedAt: string | null;
  delayDays: number;
}

export interface HomeView {
  ready: boolean;
  today: string;
  start: string | null;
  cadence: Cadence;
  slots: HomeSlot[];
  todayIdx: number | null;
  nextIdx: number | null;
  counts: { posted: number; made: number; plan: number };
  /** 아직 어느 칸에도 잇지 않은 만든 세트 — 「이 칸에 잇기」 목록 */
  freeSets: Array<{ id: number; cover: string; createdAt: string }>;
}

/** 홈 화면 값. 시작일이 없으면 오늘로 정해 저장한다(계획이 있을 때 홈을 처음 연 날) */
export function homeView(db: Db, brandId: number, today: string = localToday()): HomeView {
  const cadence = getSetting(db, 'home.cadence');
  const plan = latestPlan(db, brandId);
  const sets = listSets(db, brandId);
  if (!plan) return { ready: false, today, start: null, cadence, slots: [], todayIdx: null, nextIdx: null, counts: { posted: 0, made: 0, plan: 0 }, freeSets: sets };
  let start = getSetting(db, 'home.startDate');
  if (!start) {
    start = today;
    setSetting(db, 'home.startDate', start);
  }
  const m = marks(db, brandId);
  const names = new Map((activeProfile(db, brandId)?.pillars ?? []).map((p) => [p.id, p.name]));
  const covers = new Map(sets.map((s) => [s.id, s.cover]));
  const dues = dueDates(start, plan.slots.length, cadence, plan.slots.map((_, i) => m.get(i)?.delayDays ?? 0));
  const slots: HomeSlot[] = plan.slots.map((s, i) => {
    const k = m.get(i);
    const setId = k?.setId !== null && k?.setId !== undefined && covers.has(k.setId) ? k.setId : null;
    const postedAt = k?.postedAt ?? null;
    return {
      idx: i,
      title: s.title,
      pillarName: names.get(s.pillarId) ?? null,
      due: dues[i]!,
      state: postedAt ? 'posted' : setId !== null ? 'made' : 'plan',
      setId,
      setCover: setId !== null ? covers.get(setId)! : null,
      postedAt,
      delayDays: k?.delayDays ?? 0,
    };
  });
  const { today: todayIdx, next: nextIdx } = pickToday(slots.map((s) => ({ due: s.due, posted: s.state === 'posted' })), today);
  const linked = new Set(slots.map((s) => s.setId).filter((x): x is number => x !== null));
  return {
    ready: true,
    today,
    start,
    cadence,
    slots,
    todayIdx,
    nextIdx,
    counts: { posted: slots.filter((s) => s.state === 'posted').length, made: slots.filter((s) => s.state === 'made').length, plan: slots.filter((s) => s.state === 'plan').length },
    freeSets: sets.filter((s) => !linked.has(s.id)),
  };
}

function slotOrThrow(db: Db, brandId: number, idx: number) {
  const plan = latestPlan(db, brandId);
  if (!plan) throw new FlowError('아직 30일 계획이 없습니다.', '「30일 뒤 미리보기」에서 첫 9개 게시물 계획을 먼저 만드세요.');
  const slot = plan.slots[idx];
  if (!slot) throw new FlowError(`${idx + 1}번 칸이 없습니다.`, '화면을 새로고침한 뒤 다시 시도하세요.');
  return slot;
}

/** 칸을 계획에서 고정한다 — 이은 · 올린 칸이 계획을 다시 만들 때 바뀌지 않게 */
function lock(db: Db, brandId: number, idx: number): void {
  if (!slotOrThrow(db, brandId, idx).locked) editSlot(db, brandId, idx, { locked: true });
}

/** 만든 세트를 칸에 잇는다(null 이면 끊는다). 한 세트는 한 칸에만 */
export function linkSet(db: Db, brandId: number, idx: number, setId: number | null): void {
  slotOrThrow(db, brandId, idx);
  if (setId !== null) {
    if (!getSet(db, setId)) throw new FlowError('카드 세트를 찾지 못했습니다.', '「만들기」에서 세트가 있는지 확인하세요.');
    const other = [...marks(db, brandId)].find(([i, k]) => k.setId === setId && i !== idx);
    if (other) throw new FlowError(`이 세트는 이미 ${other[0] + 1}번 칸에 이어져 있어요.`, '그 칸에서 먼저 끊은 뒤 다시 이으세요.');
    lock(db, brandId, idx);
  }
  upsert(db, brandId, idx, { setId });
}

/** 「올렸어요」(사용자 표시). date 를 안 주면 오늘 */
export function markPosted(db: Db, brandId: number, idx: number, date: string = localToday()): void {
  slotOrThrow(db, brandId, idx);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new FlowError('날짜 모양이 맞지 않습니다.', 'YYYY-MM-DD 로 적어 주세요.');
  lock(db, brandId, idx);
  upsert(db, brandId, idx, { postedAt: date });
}

export function unmarkPosted(db: Db, brandId: number, idx: number): void {
  slotOrThrow(db, brandId, idx);
  upsert(db, brandId, idx, { postedAt: null });
}

/** 「하루 미루기」 — 그 칸부터 뒤 칸까지 예정일이 하루씩 밀린다(schedule.ts). 올린 칸은 미룰 수 없다 */
export function delayDay(db: Db, brandId: number, idx: number): void {
  slotOrThrow(db, brandId, idx);
  const k = marks(db, brandId).get(idx);
  if (k?.postedAt) throw new FlowError('이미 올린 칸이에요.', '「올렸어요」를 되돌린 뒤 미루세요.');
  upsert(db, brandId, idx, { delayDays: (k?.delayDays ?? 0) + 1 });
}

export function setCadence(db: Db, cadence: string): void {
  if (!CADENCES.includes(cadence as Cadence)) throw new FlowError('올리는 간격을 다시 골라 주세요.', `${CADENCES.join(' · ')} 중 하나`);
  setSetting(db, 'home.cadence', cadence as Cadence);
}
