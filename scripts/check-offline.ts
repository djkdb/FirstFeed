// 오프라인 동작 확인 (FR-AC-1 「오프라인에서 AI 호출을 제외한 기능이 동작하는지 확인해야 완료」).
//   npm run check:offline
// macOS 의 sandbox-exec 로 「바깥으로 나가는 네트워크 연결만 막고 이 컴퓨터(localhost) 안은 허용」한 채로
//   1. 정말 막혔는지 먼저 확인(https://example.com 연결이 실패해야 한다)
//   2. 단위 테스트 · 브라우저 테스트(가짜 AI 공급자 — 실제 AI 는 부르지 않는다)
//   3. 로컬 서버와 화면(Vite)을 띄워 주요 API 와 첫 화면이 응답하는지
// 를 돌린다. Wi-Fi 를 끄는 것과 같지는 않다(DNS 조회 자체는 막지 않음) — 바깥 연결을 막은 상태의 확인이다.
// macOS 가 아니면 하지 않고 이유를 알린다(Windows 확인은 최종까지 목표 — PRD v0.2 9장).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROFILE = '(version 1)(allow default)(deny network-outbound (remote ip))(allow network-outbound (remote ip "localhost:*"))';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SERVER_PORT = 4517;
const APP_PORT = 5373;

if (process.platform !== 'darwin' || !fs.existsSync('/usr/bin/sandbox-exec')) {
  console.error('[오프라인 확인] macOS 의 sandbox-exec 로만 확인합니다. 이 컴퓨터에서는 네트워크를 끈 채로 npm test 와 npm run dev 를 직접 확인하세요.');
  process.exit(2);
}

const results: Array<{ step: string; ok: boolean; note: string }> = [];
const sandboxed = (cmd: string, args: string[], extraEnv: Record<string, string> = {}) =>
  spawnSync('/usr/bin/sandbox-exec', ['-p', PROFILE, cmd, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, ...extraEnv } });

// 1. 막혔는지부터 — 막히지 않았다면 아래 결과는 오프라인 확인이 아니다
const probe = sandboxed(process.execPath, ['-e', "fetch('https://example.com').then(() => process.exit(0), () => process.exit(3))"]);
results.push({ step: '바깥 연결 차단(https://example.com)', ok: probe.status === 3, note: probe.status === 3 ? '연결 실패 = 막힘' : `종료 코드 ${probe.status} — 막히지 않음` });
if (probe.status !== 3) finish();

// 2. 테스트 (실제 AI 는 부르지 않는다 — 모든 기능 테스트가 가짜 공급자)
for (const project of ['unit', 'browser']) {
  const r = sandboxed(path.join(root, 'node_modules/.bin/vitest'), ['run', '--project', project]);
  const line = `${r.stdout}${r.stderr}`.split('\n').find((l) => /^\s+Tests\s/.test(l))?.trim() ?? '결과 줄 없음';
  results.push({ step: `테스트 ${project}`, ok: r.status === 0, note: line });
}

// 3. 서버와 화면을 막힌 채로 띄워 응답 확인 (임시 데이터 폴더 — 쓰던 DB 를 건드리지 않는다)
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'firstfeed-offline-'));
const env = { FIRSTFEED_DATA_DIR: dataDir, FIRSTFEED_PORT: String(SERVER_PORT) };
const procs: ChildProcess[] = [];
const start = (cmd: string, args: string[], cwd: string) => {
  const p = spawn('/usr/bin/sandbox-exec', ['-p', PROFILE, cmd, ...args], { cwd, env: { ...process.env, ...env }, stdio: 'ignore', detached: true });
  procs.push(p);
};
start(path.join(root, 'node_modules/.bin/tsx'), ['server/src/index.ts'], root);
start(path.join(root, 'node_modules/.bin/vite'), ['--port', String(APP_PORT)], path.join(root, 'app'));

const get = async (url: string) => {
  try {
    const r = await fetch(url, { headers: { host: new URL(url).host } });
    return { status: r.status, body: await r.text() };
  } catch {
    return null;
  }
};
const until = async (url: string) => {
  for (let i = 0; i < 60; i++) {
    if (await get(url)) return true;
    await new Promise((ok) => setTimeout(ok, 500));
  }
  return false;
};

try {
  const api = `http://127.0.0.1:${SERVER_PORT}`;
  if (!(await until(`${api}/api/health`))) results.push({ step: '로컬 서버 시작', ok: false, note: '30초 안에 응답 없음' });
  else
    for (const p of ['/api/health', '/api/identity/survey', '/api/brand', '/api/templates']) {
      const r = await get(api + p);
      results.push({ step: `API ${p}`, ok: r?.status === 200, note: r ? `HTTP ${r.status}` : '응답 없음' });
    }
  const app = `http://localhost:${APP_PORT}/`;
  if (!(await until(app))) results.push({ step: '화면(Vite) 시작', ok: false, note: '30초 안에 응답 없음' });
  else {
    const r = await get(app);
    results.push({ step: '화면 첫 페이지', ok: r?.status === 200 && r.body.includes('<div id="root">'), note: r ? `HTTP ${r.status}` : '응답 없음' });
    const viaProxy = await get(`${app}api/health`);
    results.push({ step: '화면 → 서버 프록시(/api/health)', ok: viaProxy?.status === 200, note: viaProxy ? `HTTP ${viaProxy.status}` : '응답 없음' });
  }
} finally {
  for (const p of procs) {
    try {
      process.kill(-p.pid!, 'SIGTERM');
    } catch {
      /* 이미 끝난 프로세스 */
    }
  }
  fs.rmSync(dataDir, { recursive: true, force: true });
}
finish();

function finish(): never {
  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.step} — ${r.note}`);
  const bad = results.filter((r) => !r.ok).length;
  console.log(bad === 0 ? '[오프라인 확인] 통과 — AI 호출 밖의 확인 항목은 바깥 연결 없이 동작했습니다' : `[오프라인 확인] 실패 ${bad}개 — 위 ✗ 줄을 보세요`);
  console.log('  확인하지 않은 것: 실제 AI 호출(오프라인에선 안 됨 — 수용 기준 밖), 브라우저로 화면을 눌러 보는 사용자 흐름, Windows');
  process.exit(bad === 0 ? 0 : 1);
}
