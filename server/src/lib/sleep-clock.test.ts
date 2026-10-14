import { describe, expect, it } from 'vitest';
import { createSleepMeter, sleptNote, startStopwatch } from './sleep-clock.ts';

describe('잠자기가 낀 시간 재기 (심장 박동 간격)', () => {
  it('박동이 기대보다 크게 벌어진 시간이 잠든 시간이다 — 시계 성질에 기대지 않는다', () => {
    let now = 1_000_000;
    const m = createSleepMeter(now);
    const sw = startStopwatch(() => now, m);
    for (let i = 0; i < 3; i++) m.tick((now += 1000)); // 깨어 있음
    expect(sw.sleptMs()).toBe(0);
    now += 646_000; // 덮개 닫힘 — 그 사이 박동이 없다 (2026-10-15 실제 pmset 의 646초 잠자기)
    m.tick(now);
    for (let i = 0; i < 3; i++) m.tick((now += 1000));
    expect(sw.wallMs()).toBe(652_000);
    expect(sw.sleptMs()).toBe(645_000); // 첫 1초는 정상 박동 간격
    expect(sleptNote(sw.sleptMs())).toBe(' · 컴퓨터 잠자기 약 645초 포함');
  });

  it('작은 지연(5초 이하)은 잠자기로 보지 않는다 — CPU 가 바쁜 순간', () => {
    let now = 0;
    const m = createSleepMeter(now);
    const sw = startStopwatch(() => now, m);
    m.tick((now += 4000));
    expect(sw.sleptMs()).toBe(0);
  });

  it('스톱워치보다 앞선 잠자기는 세지 않는다', () => {
    let now = 0;
    const m = createSleepMeter(now);
    m.tick((now += 60_000)); // 시작 전 잠
    const sw = startStopwatch(() => now, m);
    m.tick((now += 1000));
    expect(sw.sleptMs()).toBe(0);
  });
});
