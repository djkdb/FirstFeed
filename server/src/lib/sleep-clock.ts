// 컴퓨터 잠자기(덮개 닫힘·유휴 잠자기)가 낀 시간 재기.
// 처음(844b11e)엔 "단조 시계(process.hrtime)는 잠든 동안 멈춘다"고 보고 벽시계와의 차이로 쟀는데, 틀렸다:
// 카드 측정(2026-10-15 03:06 덮개 닫힘, pmset 확인) 중 제한 300초 호출이 804초로 기록됐는데 차이는 0 — 이 맥의 Node 에서는
// 두 시계가 다 잠든 시간을 포함하고, 잠든 동안 멈추는 것은 프로세스 자체다(그래서 타이머가 깨어난 뒤에 늦게 울린다).
// 그래서 1초 심장 박동 타이머를 돌려 "박동 사이가 기대보다 크게 벌어진 시간"을 잠든 시간으로 센다 — 시계의 성질에 기대지 않는다
const BEAT_MS = 1000;
const NOISE_MS = 5000;

export interface SleepMeter {
  /** 박동 하나 (now = 지금 벽시계) */
  tick(now: number): void;
  /** [from, to] 사이에 잠든 시간(ms) */
  sleptBetween(from: number, to: number): number;
}

export function createSleepMeter(start: number): SleepMeter {
  let last = start;
  const gaps: Array<{ from: number; to: number }> = [];
  return {
    tick(now) {
      if (now - last > BEAT_MS + NOISE_MS) gaps.push({ from: last + BEAT_MS, to: now });
      last = now;
      if (gaps.length > 1000) gaps.shift();
    },
    sleptBetween(from, to) {
      return gaps.reduce((n, g) => n + Math.max(0, Math.min(g.to, to) - Math.max(g.from, from)), 0);
    },
  };
}

let meter: SleepMeter | null = null;
function globalMeter(): SleepMeter {
  if (!meter) {
    const m = createSleepMeter(Date.now());
    // unref: 이 타이머 때문에 프로세스가 끝나지 않는 일이 없게
    setInterval(() => m.tick(Date.now()), BEAT_MS).unref();
    meter = m;
  }
  return meter;
}

export interface Stopwatch {
  /** 벽시계 기준 걸린 시간 */
  wallMs(): number;
  /** 그중 컴퓨터가 잠들어(프로세스가 멈춰) 있던 시간 */
  sleptMs(): number;
}

export function startStopwatch(now: () => number = Date.now, m: SleepMeter = globalMeter()): Stopwatch {
  const t0 = now();
  return {
    wallMs: () => now() - t0,
    sleptMs: () => {
      // 측정 직전 박동을 한 번 — 깨어난 직후라 아직 박동이 안 돈 경우도 잡게
      const t = now();
      m.tick(t);
      return m.sleptBetween(t0, t);
    },
  };
}

export const sleptNote = (ms: number) => (ms > 0 ? ` · 컴퓨터 잠자기 약 ${Math.round(ms / 1000)}초 포함` : '');
