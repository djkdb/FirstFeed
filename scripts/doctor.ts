// 설치 점검 (FR-AC-6): npm run doctor
// Node 버전 · 의존성 설치 · Claude Code CLI 설치 · 로그인 · 구독 · 카드 렌더링 브라우저 · 포트를 확인하고,
// 문제마다 다음에 할 일을 한국어로 알린다. Claude 쪽 판정과 안내 문구는 앱의 감지 코드(claude-code.ts)를 그대로 쓴다 —
// 화면과 명령이 다른 말을 하지 않게. AI 를 부르지는 않는다(구독 사용량 없음).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
type Level = 'ok' | 'warn' | 'fail';
const rows: Array<{ level: Level; what: string; detail: string; next?: string }> = [];
const add = (level: Level, what: string, detail: string, next?: string) => rows.push({ level, what, detail, next });
// 앱 화면용 안내의 「[다시 확인]」 버튼을 이 명령으로 바꿔 읽는다
const forCli = (hint: string) => hint.replace(/\[다시 확인\]을 누르세요/g, '`npm run doctor` 를 다시 실행하세요');

// 1. Node — package.json engines 와 같은 기준
const engines = (JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { engines?: { node?: string } }).engines?.node ?? '';
const need = Number(/(\d+)/.exec(engines)?.[1] ?? 0);
const major = Number(process.versions.node.split('.')[0]);
if (major >= need) add('ok', 'Node.js', `${process.versions.node} (필요: ${engines})`);
else add('fail', 'Node.js', `${process.versions.node} — ${engines} 가 필요합니다`, `Node.js ${need} 이상을 설치한 뒤(https://nodejs.org) 새 터미널에서 다시 실행하세요.`);

// 2. 의존성 — 없으면 아래 점검(서버 코드를 읽음)도 못 한다
if (!fs.existsSync(path.join(root, 'node_modules', 'playwright'))) {
  add('fail', '의존성 설치', 'node_modules 가 없거나 덜 설치됐습니다', '이 폴더에서 `npm install` 을 실행하세요.');
  finish();
}
add('ok', '의존성 설치', 'node_modules 있음');

// 3. Claude Code CLI — 앱과 같은 감지(설치 → 로그인 → 구독). 실행 환경도 앱과 같다(API 키 변수 뺀 환경)
const { ClaudeCodeProvider } = await import('../server/src/ai/providers/claude-code.ts');
const s = await new ClaudeCodeProvider().detect();
if (!s.installed) add('fail', 'Claude Code CLI', '설치 안 됨', forCli(s.hint ?? ''));
else {
  add('ok', 'Claude Code CLI', `설치됨 (${s.version ?? '판 모름'})`);
  if (s.loggedIn === null) add('fail', 'Claude 로그인', '확인하지 못함', forCli(s.hint ?? ''));
  else if (!s.loggedIn) add('fail', 'Claude 로그인', '로그인 안 됨', forCli(s.hint ?? ''));
  else if (!s.supported) add('fail', 'Claude 구독', `구독 로그인이 아님 (${s.authMethod ?? '방식 모름'})`, forCli(s.hint ?? ''));
  else add('ok', 'Claude 로그인 · 구독', `${s.authMethod ?? ''}${s.subscription ? ` · ${s.subscription}` : ''}`);
}

// 4. 카드 렌더링 브라우저 — 앱과 같은 순서(Playwright Chromium → Chrome). 실제로 한 번 열어 본다
try {
  const { getBrowser, closeBrowser } = await import('../server/src/render/browser.ts');
  const b = await getBrowser(null);
  add(
    b.info.reference ? 'ok' : 'warn',
    '카드 렌더링 브라우저',
    `${b.info.kind} ${b.info.version}${b.info.reference ? ' (기준 브라우저)' : ' — 기준 브라우저 아님'}`,
    b.info.reference ? undefined : '넘침 판정의 기준은 Playwright Chromium 입니다. `npx playwright install chromium` 을 실행하면 기준 브라우저로 그립니다.',
  );
  await closeBrowser();
} catch (e) {
  const err = e as { message?: string; hint?: string };
  add('fail', '카드 렌더링 브라우저', err.message ?? String(e), err.hint ?? '`npx playwright install chromium` 을 실행하세요.');
}

// 5. 포트 — 이미 쓰는 중이면 `npm run dev` 가 켜져 있을 수도 있어 경고만
const port = (p: number) =>
  new Promise<boolean>((ok) => {
    const srv = net.createServer();
    srv.once('error', () => ok(false));
    srv.listen(p, '127.0.0.1', () => srv.close(() => ok(true)));
  });
for (const [p, who] of [
  [Number(process.env.FIRSTFEED_PORT ?? 4317), '로컬 서버'],
  [5173, '화면'],
] as const) {
  if (await port(p)) add('ok', `포트 ${p} (${who})`, '비어 있음');
  else add('warn', `포트 ${p} (${who})`, '이미 쓰는 중', `\`npm run dev\` 가 이미 켜져 있다면 괜찮습니다. 아니면 \`lsof -nP -iTCP:${p} -sTCP:LISTEN\` 으로 무엇이 쓰는지 확인하고 끈 뒤 다시 실행하세요.`);
}

finish();

function finish(): never {
  const mark = { ok: '✓', warn: '!', fail: '✗' } as const;
  console.log('[설치 점검] 퍼스트피드');
  for (const r of rows) {
    console.log(`${mark[r.level]} ${r.what} — ${r.detail}`);
    if (r.next) console.log(`    → ${r.next}`);
  }
  const fails = rows.filter((r) => r.level === 'fail').length;
  console.log(fails === 0 ? '\n준비됐습니다. `npm run dev` 로 시작한 뒤 http://localhost:5173 을 여세요.' : `\n고칠 것 ${fails}개 — 위 → 줄대로 한 뒤 \`npm run doctor\` 를 다시 실행하세요.`);
  process.exit(fails === 0 ? 0 : 1);
}
