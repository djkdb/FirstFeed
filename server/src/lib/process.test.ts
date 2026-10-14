import { describe, expect, it } from 'vitest';
import { runProcess } from './process.ts';

describe('하위 프로세스 실행', () => {
  it('표준 입력을 넘기고 출력을 받는다', async () => {
    const r = await runProcess('node', ['-e', 'process.stdin.pipe(process.stdout)'], { stdin: '안녕' });
    expect(r).toMatchObject({ code: 0, stdout: '안녕', timedOut: false, aborted: false });
  });

  it('없는 명령은 notFound 로 알린다', async () => {
    const r = await runProcess('firstfeed-없는-명령', []);
    expect(r.notFound).toBe(true);
  });

  it('시간 제한을 넘기면 프로세스를 끝낸다', async () => {
    const started = Date.now();
    const r = await runProcess('node', ['-e', 'setTimeout(() => {}, 60000)'], { timeoutMs: 200 });
    expect(r.timedOut).toBe(true);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('취소하면 자식이 띄운 손자 프로세스까지 끝낸다', async () => {
    const ac = new AbortController();
    // 자식이 손자를 띄우고 손자 pid 를 알려 준다
    const script = `
      const { spawn } = require('node:child_process');
      const g = spawn('node', ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
      console.log(g.pid);
      setTimeout(() => {}, 60000);`;
    const p = runProcess('node', ['-e', script], { signal: ac.signal });
    await new Promise((r) => setTimeout(r, 500));
    ac.abort();
    const r = await p;
    expect(r.aborted).toBe(true);
    const grandchild = Number(r.stdout.trim());
    expect(grandchild).toBeGreaterThan(0);
    // 여러 테스트가 동시에 돌면 신호 처리가 늦을 수 있어 고정 대기 대신 최대 3초까지 확인한다
    const alive = () => {
      try {
        process.kill(grandchild, 0); // 살아 있으면 throw 하지 않는다
        return true;
      } catch {
        return false;
      }
    };
    for (let i = 0; i < 30 && alive(); i++) await new Promise((r) => setTimeout(r, 100));
    expect(alive()).toBe(false);
  });
});

describe('다른 프로세스 그룹의 손자가 출력 파이프를 쥐고 있을 때', () => {
  // 자식이 detached 로(다른 그룹) 손자를 띄우고, 손자가 stdout 을 물려받아 오래 쥐고 있는다
  const holder = (ms: number, then: string) => `
    const { spawn } = require('node:child_process');
    spawn('node', ['-e', 'setTimeout(() => {}, ${ms})'], { stdio: ['ignore', 'inherit', 'inherit'], detached: true }).unref();
    ${then}`;

  it('시간 초과면 손자를 기다리지 않고 바로 돌아온다', async () => {
    const started = Date.now();
    const r = await runProcess('node', ['-e', holder(10_000, 'setTimeout(() => {}, 60000);')], { timeoutMs: 300 });
    expect(r.timedOut).toBe(true);
    expect(Date.now() - started).toBeLessThan(4000);
  });

  it('정상 종료면 출력을 받고, 손자 때문에 오래 기다리지 않는다', async () => {
    const started = Date.now();
    const r = await runProcess('node', ['-e', holder(10_000, "console.log('결과'); process.exit(0);")]);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe('결과');
    expect(Date.now() - started).toBeLessThan(4000);
  });
});
