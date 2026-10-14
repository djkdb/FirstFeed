// 컴퓨터 잠자기(덮개 닫힘·유휴 잠자기)가 낀 시간 재기.
// 벽시계(Date.now)는 잠든 동안에도 흐르고, 단조 시계(process.hrtime)와 타이머는 macOS 에서 잠든 동안 멈춘다.
// 실측 정황: 제한 360초 타이머가 벽시계로 4172초 뒤에 울렸다(2026-10-14, pmset 로그의 Clamshell Sleep 과 겹침).
// 둘의 차이가 잠든 시간이다 — 이것을 모르고 "AI 가 느리다"로 읽은 적이 있어서 기록에 따로 보인다.

export interface Stopwatch {
  /** 벽시계 기준 걸린 시간 */
  wallMs(): number;
  /** 그중 컴퓨터가 잠들어 있던 시간 (오차를 빼고 5초 넘을 때만, 아니면 0) */
  sleptMs(): number;
}

const SLEEP_NOISE_MS = 5000;

export function startStopwatch(now = Date.now, mono = () => Number(process.hrtime.bigint() / 1_000_000n)): Stopwatch {
  const wall0 = now();
  const mono0 = mono();
  return {
    wallMs: () => now() - wall0,
    sleptMs: () => {
      const gap = now() - wall0 - (mono() - mono0);
      return gap > SLEEP_NOISE_MS ? gap : 0;
    },
  };
}

export const sleptNote = (ms: number) => (ms > 0 ? ` · 컴퓨터 잠자기 약 ${Math.round(ms / 1000)}초 포함` : '');
