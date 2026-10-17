// 화면이 끝난 것을 본 AI 작업 ID 기억 (결정 2026-10-18 · 오래된 작업 ID).
// 서버 작업은 메모리에만 있어서 서버가 다시 시작되면 사라진다. 그때 브라우저에 남은 작업 ID 를 다시 물으면 404 인데,
// 이미 끝난 작업이면 잃은 것이 없으니 조용히 지우고, 진행 중이던 작업이 사라진 경우에만 다시 하라고 알린다.
// 처음엔 둘을 가르지 않아 몇 시간 전에 끝난 작업에도 「진행 중이던 작업을 찾지 못했습니다」가 떴다(devlog 2026-10-15-04)

/** localStorage 와 같은 모양 — 테스트에서 가짜를 넣으려고 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'firstfeed.jobs.finished';
/** 작업 ID 는 계속 쌓이므로 최근 것만 */
const KEEP = 50;

function defaultStore(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function read(store: KeyValueStore | null): string[] {
  try {
    const v = JSON.parse(store?.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberFinished(jobId: string, store: KeyValueStore | null = defaultStore()): void {
  try {
    const ids = read(store).filter((x) => x !== jobId);
    store?.setItem(KEY, JSON.stringify([...ids, jobId].slice(-KEEP)));
  } catch {
    /* 임시 저장 없이 동작 — 그러면 서버 재시작 뒤엔 안내가 뜬다(엄한 쪽) */
  }
}

/** 서버가 모르는 작업 ID: 끝난 것을 본 적 있으면 stale(조용히 지움), 아니면 lost(진행 중이던 작업이 사라짐 — 안내) */
export function missingJobOutcome(jobId: string, store: KeyValueStore | null = defaultStore()): 'stale' | 'lost' {
  return read(store).includes(jobId) ? 'stale' : 'lost';
}
