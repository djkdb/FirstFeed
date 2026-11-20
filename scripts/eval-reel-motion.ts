// 릴스 모션 제안 측정(결정 2026-11-08). 고정 릴스(tests/fixtures/generated/reels — AI 생성 예시 문장)에 브랜드 키트 팔레트를 입혀
// 앱과 같은 경로(proposeMotion: 생성 → 코드 규칙 → 재작성)로 돌리고, 통과 · 재작성 · 걸린 규칙 · 토큰 · 시간을 표로 남긴다.
// 통과한 첫 제안은 720 으로 영상을 뽑아 프레임 판(_sheet.png)을 만든다 — 사람이 열어 글자 잘림 · 가림을 본다.
//   npm run eval:motion -- --runs=2 --label=v1 [--prompt reel_motion=v2] [--no-render] [--cloud-session]
// 결과: tests/results/<날짜>-reel-motion-<label>.md · .json · <날짜>-reel-motion-<label>/<릴스>-<브랜드>/
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { env, getSetting, setSetting } from '../server/src/config.ts';
import { openDb } from '../server/src/db/index.ts';
import { AiService } from '../server/src/ai/adapter.ts';
import { ClaudeCodeProvider, isSubscriptionAuth, type AuthStatus } from '../server/src/ai/providers/claude-code.ts';
import { saveSelection } from '../server/src/brand/store.ts';
import { createApp } from '../server/src/app.ts';
import type { ReelDoc } from '../server/src/reels/model.ts';
import { applyMotion, proposeMotion, type MotionPlan } from '../server/src/reels/motionPlan.ts';
import { createReel, saveReel } from '../server/src/reels/store.ts';
import { parsePromptArgs } from './prompt-args.ts';

const args = process.argv.slice(2);
const runs = Number(args.find((a) => a.startsWith('--runs='))?.slice(7) ?? 1);
const label = args.find((a) => a.startsWith('--label='))?.slice(8) ?? 'run';
const render = !args.includes('--no-render');
const cloud = args.includes('--cloud-session');
const versions = { ...getSetting(null, 'prompts.activeVersions'), ...parsePromptArgs(args, path.join(env.repoRoot, 'prompts')) };
if (cloud && process.env.CLAUDE_CODE_REMOTE !== 'true') throw new Error('--cloud-session 은 Claude Code 원격 세션 컨테이너(CLAUDE_CODE_REMOTE=true)에서만 씁니다');
// 클라우드 컨테이너는 원격 세션의 oauth_token 으로 로그인돼 있다 — eval-tokens.ts 와 같은 예외(앱 서버는 이 길을 쓰지 않는다)
const acceptAuth = cloud ? (a: AuthStatus, e: NodeJS.ProcessEnv) => isSubscriptionAuth(a, e) || (a.loggedIn === true && a.apiProvider === 'firstParty' && a.authMethod === 'oauth_token') : undefined;

const date = new Date().toLocaleDateString('sv-SE');
const outDir = path.join(env.repoRoot, 'tests/results', `${date}-reel-motion-${label}`);
fs.mkdirSync(outDir, { recursive: true });

/** 팔레트 출처: me = 실제 · 공개 브랜드 키트, 나머지 = AI 생성 페르소나 */
const BRANDS: Array<{ name: string; file: string; kind: '실제·공개' | 'AI 생성' }> = [
  { name: 'me', file: 'real/brands/me.json', kind: '실제·공개' },
  { name: 'doyun', file: 'generated/brands/doyun.json', kind: 'AI 생성' },
  { name: 'seoyeon', file: 'generated/brands/seoyeon.json', kind: 'AI 생성' },
];
// 릴스 하나를 브랜드 하나에 — 3 × 3 이면 호출이 많아서 짝을 정해 둔다(릴스마다 다른 팔레트)
const PAIRS: Array<[string, string]> = [
  ['info', 'me'],
  ['hook', 'doyun'],
  ['photo', 'seoyeon'],
];

interface Row {
  run: number;
  reel: string;
  brand: string;
  kind: string;
  ok: boolean;
  rewrites: number;
  calls: number;
  seconds: number;
  /** 재작성 때 걸린 규칙 코드(앞 시도들) */
  reasons: string[];
  error: string | null;
  input: number | null;
  cacheWrite: number | null;
  cacheRead: number | null;
  output: number | null;
  model: string | null;
  plan: MotionPlan | null;
  warnings: string[];
}

const rows: Row[] = [];
const rendered: string[] = [];
const sum = (xs: Array<number | null>) => (xs.every((x) => x == null) ? null : xs.reduce<number>((a, b) => a + (b ?? 0), 0));

async function renderPlan(doc: ReelDoc, brandSel: Parameters<typeof saveSelection>[3], dir: string): Promise<string | null> {
  const db = openDb(':memory:');
  saveSelection(db, 1, null, brandSel);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-motion-eval-'));
  const app = createApp({ db, ai: new AiService({ db, provider: new ClaudeCodeProvider() }), dataDir });
  const { serve } = await import('@hono/node-server');
  const server = await new Promise<ReturnType<typeof serve>>((res) => {
    const s = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }, (info) => {
      process.env.FIRSTFEED_RENDER_BASE = `http://127.0.0.1:${info.port}`;
      res(s);
    });
  });
  const H = { host: 'localhost:4317', 'content-type': 'application/json' };
  try {
    const r = createReel(db, 1, doc.name);
    // 사진 장면은 그림 파일이 없으니 배경만으로(측정용 릴스의 자리표시 주소)
    saveReel(db, 1, r.id, { ...doc, scenes: doc.scenes.map((s) => ({ ...s, media: null })) });
    const { jobId } = (await (await app.request(`/api/reels/${r.id}/render`, { method: 'POST', headers: H, body: JSON.stringify({ quality: '720' }) })).json()) as { jobId: string };
    type Job = { phase: string; file: string | null; error: string | null };
    let job: Job | null = null;
    for (let i = 0; i < 1200; i++) {
      const j = (await (await app.request(`/api/reels/jobs/${jobId}`, { headers: H })).json()) as Job;
      job = j;
      if (['done', 'failed', 'cancelled'].includes(j.phase)) break;
      await new Promise((res) => setTimeout(res, 500));
    }
    const done = job as Job | null;
    if (!done?.file) return `영상 뽑기 실패: ${done?.error ?? '알 수 없음'}`;
    const mp4 = path.join(dataDir, 'reels', `reel-${r.id}`, 'renders', done.file);
    fs.mkdirSync(dir, { recursive: true });
    // 0.2초마다 한 장 — 등장 · 전환이 보이게 5줄 × 6칸 판
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp4, '-vf', 'fps=5,scale=180:320,tile=6x5', '-frames:v', '1', path.join(dir, '_sheet.png')]);
    return null;
  } finally {
    server.close();
    delete process.env.FIRSTFEED_RENDER_BASE;
  }
}

for (let run = 1; run <= runs; run++) {
  for (const [reelName, brandName] of PAIRS) {
    const b = BRANDS.find((x) => x.name === brandName)!;
    const kit = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures', b.file), 'utf8')) as { look: { palette: Record<string, string>; titleFont: string; bodyFont: string } };
    const doc = (JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/generated/reels', `${reelName}.json`), 'utf8')) as { doc: ReelDoc }).doc;
    const sel = { palette: { name: b.name, colors: kit.look.palette as never, why: '' }, titleFont: kit.look.titleFont, bodyFont: kit.look.bodyFont, handle: null };
    const db = openDb(':memory:');
    setSetting(db, 'prompts.activeVersions', versions);
    saveSelection(db, 1, null, sel);
    const reel = createReel(db, 1, doc.name);
    saveReel(db, 1, reel.id, doc);
    const ai = new AiService({ db, provider: new ClaudeCodeProvider(acceptAuth ? { acceptAuth } : {}) });
    const t0 = Date.now();
    let res: Awaited<ReturnType<typeof proposeMotion>> | null = null;
    let error: string | null = null;
    try {
      res = await proposeMotion(ai, 1, reel.id);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const runsRows = db.prepare("SELECT kind, status, model, issues_json, input_tokens, cache_creation_tokens, cache_read_tokens, output_tokens FROM ai_runs WHERE task = 'reel_motion' ORDER BY id").all() as Array<Record<string, unknown>>;
    const reasons = runsRows.flatMap((r) => {
      try {
        return ((JSON.parse(String(r.issues_json ?? '[]')) as Array<{ level: string; code: string }>) ?? []).filter((i) => i.level === 'error').map((i) => i.code);
      } catch {
        return [];
      }
    });
    const row: Row = {
      run,
      reel: reelName,
      brand: brandName,
      kind: b.kind,
      ok: !!res,
      rewrites: res?.rewrites ?? runsRows.filter((r) => r.kind === 'rewrite').length,
      calls: res?.calls ?? runsRows.length,
      seconds: Math.round((Date.now() - t0) / 1000),
      reasons,
      error,
      input: sum(runsRows.map((r) => r.input_tokens as number | null)),
      cacheWrite: sum(runsRows.map((r) => r.cache_creation_tokens as number | null)),
      cacheRead: sum(runsRows.map((r) => r.cache_read_tokens as number | null)),
      output: sum(runsRows.map((r) => r.output_tokens as number | null)),
      model: (runsRows.find((r) => r.model)?.model as string | undefined) ?? null,
      plan: res?.plan ?? null,
      warnings: res?.warnings.map((w) => w.message) ?? [],
    };
    rows.push(row);
    console.log(`${run}회 ${reelName}-${brandName}: ${row.ok ? '통과' : '실패'} · 재작성 ${row.rewrites} · ${row.seconds}초${row.reasons.length ? ` · 걸린 규칙 ${row.reasons.join(',')}` : ''}${error ? ` · ${error}` : ''}`);
    const key = `${reelName}-${brandName}`;
    if (render && res && !rendered.includes(key)) {
      const msg = await renderPlan(applyMotion(doc, res.plan), sel as never, path.join(outDir, key));
      rendered.push(key);
      if (msg) console.log(`  ${msg}`);
    }
  }
}

const fmt = (n: number | null) => (n == null ? '모름' : n.toLocaleString('en-US'));
const enterOf = (p: MotionPlan | null) => (p ? Object.entries(p.texts.reduce<Record<string, number>>((a, t) => ((a[t.enter] = (a[t.enter] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ${v}`).join(' · ') : '');
const md = [
  `# 릴스 모션 제안 측정 — ${label} (${date})`,
  '',
  `- 프롬프트: reel_motion ${versions.reel_motion ?? 'v1'} · 모델 설정 ${getSetting(null, 'ai.taskModels').reel_motion} · 실제 모델 ${[...new Set(rows.map((r) => r.model).filter(Boolean))].join(', ') || '모름'}`,
  `- 입력: 고정 릴스 3개(tests/fixtures/generated/reels — **AI 생성 예시 문장**) × 브랜드 팔레트(me 실제·공개 · doyun · seoyeon AI 생성), ${runs}회`,
  `- 규칙 기준: reels.motion ${JSON.stringify(getSetting(null, 'reels.motion'))}`,
  '- 실제·비공개 자료: 없음(이 측정은 비공개 자료를 쓰지 않는다)',
  '',
  '| 회 | 릴스 | 팔레트(출처) | 결과 | 재작성 | 걸린 규칙 | 시간 | 입력 · 캐시 쓰기 · 캐시 읽기 · 출력 토큰 | 등장 분포 |',
  '|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.run} | ${r.reel} | ${r.brand}(${r.kind}) | ${r.ok ? '통과' : `실패 — ${r.error?.slice(0, 60)}`} | ${r.rewrites} | ${r.reasons.join(', ') || '없음'} | ${r.seconds}초 | ${fmt(r.input)} · ${fmt(r.cacheWrite)} · ${fmt(r.cacheRead)} · ${fmt(r.output)} | ${enterOf(r.plan)} |`),
  '',
  `통과 ${rows.filter((r) => r.ok).length}/${rows.length} · 첫 시도 통과 ${rows.filter((r) => r.ok && r.rewrites === 0).length}/${rows.length}`,
  '',
  '## 제안 한 줄(note)',
  ...rows.filter((r) => r.plan).map((r) => `- ${r.run}회 ${r.reel}-${r.brand}: ${r.plan!.note}`),
  '',
  '## 경고(재작성 사유 아님)',
  ...(rows.some((r) => r.warnings.length) ? rows.flatMap((r) => r.warnings.map((w) => `- ${r.run}회 ${r.reel}-${r.brand}: ${w}`)) : ['- 없음']),
  '',
  render ? `## 프레임 판\n${rendered.map((k) => `- ${k}: [_sheet.png](${path.basename(outDir)}/${k}/_sheet.png) (0.2초마다 한 장, 720 으로 뽑은 mp4 에서)`).join('\n')}\n\n사람이 열어 본 결과는 devlog 에 적는다.` : '',
];
fs.writeFileSync(path.join(env.repoRoot, 'tests/results', `${date}-reel-motion-${label}.md`), md.join('\n') + '\n');
fs.writeFileSync(path.join(env.repoRoot, 'tests/results', `${date}-reel-motion-${label}.json`), JSON.stringify(rows, null, 1) + '\n');
console.log(`결과: tests/results/${date}-reel-motion-${label}.md`);
