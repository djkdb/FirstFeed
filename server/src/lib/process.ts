// 하위 프로세스 실행 (AI CLI 용). 시간 제한·취소 때 자식 프로세스까지 확실히 끝내는 것이 목적이다 —
// CLI 가 다른 프로세스를 띄우면 부모만 죽여서는 구독 사용량을 계속 쓰는 고아 프로세스가 남는다.
import { spawn } from 'node:child_process';

export interface RunProcessOptions {
  cwd?: string;
  stdin?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
}

export interface RunProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
  /** 실행 파일을 찾지 못함 (설치 안 됨) */
  notFound: boolean;
}

const KILL_GRACE_MS = 3000;
/**
 * 프로세스가 끝난(exit) 뒤 남은 출력을 기다리는 시간.
 * 'close' 는 stdout·stderr 를 쥔 모든 프로세스가 끝나야 오는데, CLI 가 다른 프로세스 그룹으로 띄운 손자가 파이프를
 * 물려받아 쥐고 있으면 한참 늦게 온다 (2026-10-13 실측: 제한 180초인 호출이 703초 뒤에야 끝남, 재현 시 8~127초 지연).
 * 그래서 끝남의 기준을 'exit' 로 두고, 정상 종료면 이만큼만 더 출력을 모은 뒤 파이프를 끊는다.
 */
const EXIT_GRACE_MS = 1000;

export function runProcess(cmd: string, args: string[], opts: RunProcessOptions = {}): Promise<RunProcessResult> {
  return new Promise((resolve) => {
    if (opts.signal?.aborted) {
      resolve({ code: null, stdout: '', stderr: '', timedOut: false, aborted: true, notFound: false });
      return;
    }
    // detached: 새 프로세스 그룹을 만들어, 끝낼 때 그룹 전체(-pid)에 신호를 보낸다
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let aborted = false;
    let settled = false;

    const killTree = () => {
      if (child.pid === undefined || child.exitCode !== null) return;
      const target = process.platform === 'win32' ? child.pid : -child.pid;
      try {
        process.kill(target, 'SIGTERM');
      } catch {
        /* 이미 끝남 */
      }
      setTimeout(() => {
        try {
          if (child.exitCode === null) process.kill(target, 'SIGKILL');
        } catch {
          /* 이미 끝남 */
        }
      }, KILL_GRACE_MS).unref();
    };

    const timer =
      opts.timeoutMs !== undefined
        ? setTimeout(() => {
            timedOut = true;
            killTree();
          }, opts.timeoutMs)
        : undefined;
    const onAbort = () => {
      aborted = true;
      killTree();
    };
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    const finish = (result: RunProcessResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
      resolve(result);
    };

    child.stdout.setEncoding('utf8').on('data', (d: string) => (stdout += d));
    child.stderr.setEncoding('utf8').on('data', (d: string) => (stderr += d));
    child.on('error', (err: NodeJS.ErrnoException) => {
      finish({ code: null, stdout, stderr: stderr || err.message, timedOut, aborted, notFound: err.code === 'ENOENT' });
    });
    child.on('close', (code) => finish({ code, stdout, stderr, timedOut, aborted, notFound: false }));
    child.on('exit', (code) => {
      // 시간 초과·취소면 출력은 필요 없으니 바로, 정상 종료면 남은 출력을 조금 더 모은 뒤 끝낸다
      setTimeout(
        () => {
          child.stdout.destroy();
          child.stderr.destroy();
          finish({ code, stdout, stderr, timedOut, aborted, notFound: false });
        },
        timedOut || aborted ? 0 : EXIT_GRACE_MS,
      ).unref();
    });

    // 프롬프트는 명령줄이 아니라 표준 입력으로 넘긴다 — 길이 제한과 따옴표 문제를 피하려고
    child.stdin.on('error', () => {
      /* 프로세스가 먼저 끝나면 EPIPE 가 날 수 있다. 결과는 close 에서 처리 */
    });
    child.stdin.end(opts.stdin ?? '');
  });
}
