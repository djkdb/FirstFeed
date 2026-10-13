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
    await new Promise((r) => setTimeout(r, 300));
    expect(() => process.kill(grandchild, 0)).toThrow(); // 살아 있으면 throw 하지 않는다
  });
});
