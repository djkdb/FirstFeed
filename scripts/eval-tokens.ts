// 토큰 측정 (토큰 줄이기 작업 2026-11-04). 고정 입력으로 주요 과제를 앱과 같은 경로(생성 → 규칙 → 자기 평가 → 재작성)로 돌리고,
// 호출마다 CLI 결과 봉투의 usage(입력 · 캐시 쓰기 · 캐시 읽기 · 출력)와 시간을 ai_runs 에서 모아 과제별로 표를 만든다.
//   npm run eval:tokens -- --runs=2 --label=baseline
//   npm run eval:tokens -- --runs=2 --label=after --prompt card_body=v4 --model brand_visual=sonnet
//   npm run eval:tokens -- --overhead-only                 고정 토큰(아주 짧은 프롬프트)만
//   --cloud-session  클라우드 개발 컨테이너(Claude Code 원격 세션)에서 잴 때만. 그 컨테이너는 사용자 본인 계정의
//                    oauth_token 으로 로그인돼 있어 앱의 구독 판정(claude.ai 또는 CLAUDE_CODE_OAUTH_TOKEN)을 통과하지 못한다.
//                    CLAUDE_CODE_REMOTE=true 일 때만 받아들인다. 앱 서버는 이 길을 쓰지 않는다
// 고정 입력: 실제 · 공개 fixture me(설문 8 + 고정 질문 5 · 프로필 스냅숏 · 브랜드 키트 · 시안 A) + 실제 소재 1개.
// 결과: tests/results/<날짜>-tokens-<label>.md + 같은 이름 .json(전/후 비교용 날것 기록)
import fs from 'node:fs';
import path from 'node:path';
import { env, getSetting, setSetting, type ModelAlias } from '../server/src/config.ts';
import { parsePromptArgs } from './prompt-args.ts';
import { openDb, type Db } from '../server/src/db/index.ts';
import { AiService } from '../server/src/ai/adapter.ts';
import { ClaudeCodeProvider, isSubscriptionAuth, type AuthStatus } from '../server/src/ai/providers/claude-code.ts';
import { toCliSchema } from '../server/src/ai/adapter.ts';
import { loadPrompt } from '../server/src/ai/prompts.ts';
import { closeBrowser } from '../server/src/render/browser.ts';
import { askNext, makeProfile } from '../server/src/identity/flow.ts';
import { addAnsweredTurn, createSession } from '../server/src/identity/store.ts';
import { generateWords } from '../server/src/brand/words.ts';
import { generateVisual } from '../server/src/brand/visual.ts';
import { generatePlan } from '../server/src/preview/plan.ts';
import { generateCovers } from '../server/src/cards/covers.ts';
import { generateBody } from '../server/src/cards/body.ts';
import { generateCaption } from '../server/src/publish/caption.ts';
import { runSmokeExtract } from '../server/src/tasks/smoke-extract.ts';
import { addTestSource, seedBrand } from '../server/src/cards/testing/setup.ts';
import type { AnswerKind } from '../server/src/identity/sources.ts';
import type { SurveyAnswers } from '../server/src/identity/survey.ts';
import { z } from 'zod';
import { runProcess } from '../server/src/lib/process.ts';

const args = process.argv.slice(2);
const arg = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const runs = Number(arg('runs') ?? 2);
const label = arg('label') ?? 'tokens';
const sourceName = arg('source') ?? 'ig-claude-code-skills';
const overheadOnly = args.includes('--overhead-only');
const cloud = args.includes('--cloud-session');
/** 돌릴 단계만(쉼표): followup,profile,words,visual,plan,cards,caption */
const stepsArg = arg('steps');
const STEPS = ['followup', 'profile', 'words', 'visual', 'plan', 'cards', 'caption', 'smoke'] as const;
/** smoke(「AI 시험 호출」 과제)는 기본 목록에 없다 — 모델 바꾸기 비교에서만 --steps=smoke 로 */
const steps = new Set<string>(stepsArg ? stepsArg.split(',') : STEPS.filter((s) => s !== 'smoke'));
const promptVersions = parsePromptArgs(args, path.join(env.repoRoot, 'prompts'));
const versions: Record<string, string> = { ...getSetting(null, 'prompts.activeVersions'), ...promptVersions };
/** --model 과제=별칭 (여러 번) — 모델을 내려 보는 비교용 */
const modelOverrides: Record<string, ModelAlias> = {};
args.forEach((a, i) => {
  if (a !== '--model') return;
  const m = /^([a-z_]+)=(opus|sonnet|haiku)$/.exec(args[i + 1] ?? '');
  if (!m) throw new Error(`「--model」 다음 값 「${args[i + 1] ?? '(없음)'}」이 「과제=opus|sonnet|haiku」 모양이 아닙니다`);
  modelOverrides[m[1]!] = m[2] as ModelAlias;
});
const models: Record<string, ModelAlias> = { ...getSetting(null, 'ai.taskModels'), ...modelOverrides };
const date = new Date().toLocaleDateString('sv-SE');
const cliVersion = (await runProcess('claude', ['--version'], { timeoutMs: 15_000 })).stdout.trim() || '(버전 모름)';

if (cloud && process.env.CLAUDE_CODE_REMOTE !== 'true') throw new Error('--cloud-session 은 Claude Code 원격 세션 컨테이너(CLAUDE_CODE_REMOTE=true)에서만 씁니다');
/** 클라우드 컨테이너: 구독 판정 + (원격 세션의 oauth_token · Anthropic 직접) */
const acceptAuth = cloud
  ? (a: AuthStatus, e: NodeJS.ProcessEnv) => isSubscriptionAuth(a, e) || (a.loggedIn === true && a.apiProvider === 'firstParty' && a.authMethod === 'oauth_token')
  : undefined;
const provider = () => new ClaudeCodeProvider(acceptAuth ? { acceptAuth } : {});

interface RunRow {
  run: number;
  task: string;
  /** 자기 평가면 평가받은 과제 */
  of: string | null;
  kind: string;
  status: string;
  model: string | null;
  input: number | null;
  cacheWrite: number | null;
  cacheRead: number | null;
  output: number | null;
  thinking: number | null;
  costUsd: number | null;
  ms: number | null;
  ruleErrors: number;
  /** 코드 규칙 위반 코드(재작성 · 뺀 후보의 이유 — 근거 위반을 따로 세려고) */
  ruleCodes: string[];
}

/** ai_runs → 측정 줄. 자기 평가 줄에는 같은 작업에서 바로 앞의 생성 과제를 붙인다 */
function collect(db: Db, run: number): RunRow[] {
  const rows = db
    .prepare('SELECT job_id, task, kind, status, model, input_tokens, cache_creation_tokens, cache_read_tokens, output_tokens, thinking_tokens, cost_usd, duration_ms, issues_json FROM ai_runs ORDER BY id')
    .all() as Array<Record<string, string | number | null>>;
  const lastTask = new Map<string, string>();
  return rows.map((r) => {
    const job = String(r.job_id);
    const task = String(r.task);
    const of = task === 'self_review' ? (lastTask.get(job) ?? null) : null;
    if (task !== 'self_review') lastTask.set(job, task);
    const issues = r.issues_json ? (JSON.parse(String(r.issues_json)) as Array<{ level: string; from?: string; code: string }>) : [];
    return {
      run,
      task,
      of,
      kind: String(r.kind),
      status: String(r.status),
      model: r.model === null ? null : String(r.model),
      input: r.input_tokens as number | null,
      cacheWrite: r.cache_creation_tokens as number | null,
      cacheRead: r.cache_read_tokens as number | null,
      output: r.output_tokens as number | null,
      thinking: r.thinking_tokens as number | null,
      costUsd: r.cost_usd as number | null,
      ms: r.duration_ms as number | null,
      ruleErrors: issues.filter((i) => i.level === 'error' && i.from === 'rule').length,
      ruleCodes: issues.filter((i) => i.level === 'error' && i.from === 'rule').map((i) => i.code),
    };
  });
}

const totalIn = (r: RunRow) => (r.input === null ? null : r.input + (r.cacheWrite ?? 0) + (r.cacheRead ?? 0));

/** 아주 짧은 프롬프트 — 프롬프트 내용과 상관없이 매 호출에 붙는 토큰(시스템 프롬프트 · 도구 정의 · 스키마 안내) */
async function overhead(): Promise<Array<{ model: string; schema: boolean; input: number | null; cacheWrite: number | null; cacheRead: number | null; total: number | null; output: number | null; ms: number }>> {
  const p = provider();
  const out = [];
  const schema = toCliSchema(z.object({ ok: z.boolean() }));
  for (const model of ['sonnet', 'opus'] as const) {
    for (let i = 0; i < 2; i++) {
      // 앱과 같게: 설정이 켜져 있으면 앱 시스템 프롬프트를 넘긴다(어댑터와 같은 조건)
      const systemPrompt = getSetting(null, 'ai.appSystemPrompt') ? loadPrompt(null, '_system/app', {}).text : undefined;
      const r = await p.run({ prompt: '{"ok": true} 를 그대로 답하라.', jsonSchema: schema, model, images: [], web: false, timeoutMs: 120_000, ...(systemPrompt ? { systemPrompt } : {}) });
      const u = r.usage ?? null;
      const total = u?.inputTokens === null || !u ? null : (u.inputTokens ?? 0) + (u.cacheCreationTokens ?? 0) + (u.cacheReadTokens ?? 0);
      out.push({ model, schema: true, input: u?.inputTokens ?? null, cacheWrite: u?.cacheCreationTokens ?? null, cacheRead: u?.cacheReadTokens ?? null, total, output: u?.outputTokens ?? null, ms: r.durationMs });
      console.log(`[고정 토큰] ${model} #${i + 1}: 입력 합 ${total} (캐시 안 됨 ${u?.inputTokens} · 쓰기 ${u?.cacheCreationTokens} · 읽기 ${u?.cacheReadTokens}) · 출력 ${u?.outputTokens} · ${(r.durationMs / 1000).toFixed(1)}초`);
    }
  }
  return out;
}

async function oneRun(run: number): Promise<{ rows: RunRow[]; notes: string[] }> {
  const notes: string[] = [];
  const db = openDb(':memory:');
  setSetting(db, 'prompts.activeVersions', versions);
  setSetting(db, 'ai.taskModels', models);
  const ai = new AiService({ db, provider: provider() });
  const { dataDir } = await seedBrand('me', 'real', 'A', db);
  const interview = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/real/interviews/me.json'), 'utf8')) as {
    survey: SurveyAnswers;
    turns: Array<{ question: string; answer: string; answerKind: AnswerKind }>;
  };
  const step = async (name: (typeof STEPS)[number], f: () => Promise<string>) => {
    if (!steps.has(name)) return;
    const t = Date.now();
    try {
      const msg = await f();
      notes.push(`${run}회 ${name}: ${msg} (${((Date.now() - t) / 1000).toFixed(0)}초)`);
    } catch (err) {
      notes.push(`${run}회 ${name}: 오류 — ${(err as Error).message}`);
    }
    console.log(`  ${notes.at(-1)}`);
  };
  await step('smoke', async () => {
    const src = fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/generated/smoke/source-01.md'), 'utf8').replace(/^\s*<!--[\s\S]*?-->\s*/, '').trim();
    const r = await runSmokeExtract(ai, src);
    return r.ok ? `통과 · 재작성 ${r.rewrites} · ${r.data.facts.map((f) => f.fact).join(' / ')}` : `실패 · ${r.errors.map((e) => e.code).join(',')}`;
  });
  // 꼬리질문: 설문 + 고정 질문 2개에 답한 상태에서 다음 질문 하나
  await step('followup', async () => {
    const sid = createSession(db, 1, interview.survey);
    for (const t of interview.turns.slice(0, 2)) addAnsweredTurn(db, sid, t.question, t.answer, t.answerKind);
    const r = await askNext(ai, sid);
    return r.kind;
  });
  // 프로필 초안: 설문 + 고정 질문 5개 (seedBrand 가 만든 세션 — 초안은 활성이 아니라 뒤 단계는 스냅숏 프로필 그대로)
  await step('profile', async () => {
    const sid = (db.prepare('SELECT MIN(id) AS id FROM identity_sessions').get() as { id: number }).id;
    const r = await makeProfile(ai, sid);
    return `${r.outcome}${r.salvaged ? '(구제)' : ''} · 재작성 ${r.rewrites}`;
  });
  await step('words', async () => {
    const r = await generateWords(ai, 1);
    return `뺀 후보 ${r.dropped.length} · 재작성 ${r.rewrites}`;
  });
  await step('visual', async () => {
    const r = await generateVisual(ai, 1);
    // 모델을 바꿔 볼 때 사람이 읽고 비교하려고 결과를 짧게 남긴다
    const c = r.candidates;
    return `뺀 후보 ${r.dropped.length} · 재작성 ${r.rewrites} · 팔레트 ${c.palettes.map((p) => `${p.name}(${Object.values(p.colors).join(' ')})`).join(' / ')} · 폰트 ${c.fontPairs.map((f) => `${f.title}+${f.body}`).join(' / ')} · 그림 ${c.imagePrompts.map((x) => `[${x.target}] ${x.prompt}`).join(' / ')}`;
  });
  await step('plan', async () => {
    const r = await generatePlan(ai, 1);
    return `칸 ${r.plan.slots.length} · 재작성 ${r.rewrites} · ${r.plan.slots.map((x) => `[${x.pillarId}] ${x.title}`).join(' / ')}`;
  });
  if (steps.has('cards') || steps.has('caption')) {
    const text = fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/real/sources', `${sourceName}.md`), 'utf8').replace(/^\s*<!--[\s\S]*?-->\s*/, '').trim();
    const sourceId = addTestSource(db, text);
    let setId: number | null = null;
    await step('cards', async () => {
      const covers = await generateCovers(ai, 1, sourceId, null, undefined, dataDir);
      const first = covers.candidates[0];
      if (!first) throw new Error('보여 줄 표지 후보가 없음');
      const body = await generateBody(ai, 1, { sourceId, cover: { headline: first.headline, sub: first.sub, pillarId: first.pillarId, chip: first.chip }, requested: null, coverJobId: null }, undefined, dataDir);
      if (body.status === 'saved') setId = body.setId;
      return `표지 ${covers.candidates.length}개(뺀 ${covers.dropped.length}) · 재작성 ${covers.rewrites} / 본문 ${body.status} · 재작성 ${body.rewrites}`;
    });
    await step('caption', async () => {
      if (setId === null) throw new Error('저장된 세트가 없어 캡션을 건너뜀');
      const r = await generateCaption(ai, 1, setId, undefined, dataDir);
      return `${r.status} · 재작성 ${r.rewrites}`;
    });
  }
  return { rows: collect(db, run), notes };
}

/** --no-overhead: 모델 비교처럼 과제만 다시 잴 때 고정 토큰 호출(4번)을 건너뛴다 */
const ovh = args.includes('--no-overhead') ? [] : await overhead();
const all: RunRow[] = [];
const notes: string[] = [];
if (!overheadOnly) {
  for (let n = 1; n <= runs; n++) {
    console.log(`[토큰 측정] ${n}/${runs} …`);
    const r = await oneRun(n);
    all.push(...r.rows);
    notes.push(...r.notes);
  }
}
await closeBrowser();

const avg = (xs: Array<number | null>) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const fmt = (x: number | null, d = 0) => (x === null ? '-' : x.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
const keyOf = (r: RunRow) => (r.task === 'self_review' ? `self_review ← ${r.of ?? '?'}` : r.task);

const lines = [
  `# 토큰 측정 · ${date} · ${label}`,
  '',
  `- 고정 입력: 실제 · 공개 fixture me(설문 8 + 고정 질문 5 · 프로필 스냅숏 · 키트 · 시안 A) + 소재 ${sourceName} · ${runs}회`,
  `- 프롬프트: ${Object.entries(versions).map(([k, v]) => `${k}@${v}`).join(', ')}`,
  `- 모델: ${Object.entries(models).filter(([k]) => k !== 'default').map(([k, v]) => `${k}=${v}`).join(', ')}${Object.keys(modelOverrides).length ? ` (바꾼 것: ${JSON.stringify(modelOverrides)})` : ''}`,
  `- CLI: claude ${cliVersion}${cloud ? ' · 클라우드 개발 컨테이너(--cloud-session)' : ''}`,
  '- 입력 합 = 캐시 안 된 입력 + 캐시 쓰기 + 캐시 읽기. 비용은 CLI 가 적은 표시 가격(구독에서는 청구되지 않음 — 비교용)',
  '',
  '## 고정 토큰 (아주 짧은 프롬프트 + 작은 스키마)',
  '',
  '| 모델 | 입력 합 | 캐시 안 됨 | 캐시 쓰기 | 캐시 읽기 | 출력 | 시간 |',
  '|---|---|---|---|---|---|---|',
  ...ovh.map((o) => `| ${o.model} | ${fmt(o.total)} | ${fmt(o.input)} | ${fmt(o.cacheWrite)} | ${fmt(o.cacheRead)} | ${fmt(o.output)} | ${(o.ms / 1000).toFixed(1)}초 |`),
  '',
];
if (!overheadOnly) {
  lines.push('## 호출 종류별 평균 (호출 1번 기준)', '', '| 과제 | 종류 | 모델 | 호출 수 | 입력 합 | 캐시 안 됨 | 캐시 쓰기 | 캐시 읽기 | 출력 | 그중 생각 | 시간 |', '|---|---|---|---|---|---|---|---|---|---|---|');
  const groups = new Map<string, RunRow[]>();
  for (const r of all) {
    const k = `${keyOf(r)}|${r.kind}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const [k, rs] of [...groups].sort()) {
    const [task, kind] = k.split('|');
    lines.push(
      `| ${task} | ${kind} | ${[...new Set(rs.map((r) => r.model))].join('·')} | ${rs.length} | ${fmt(avg(rs.map(totalIn)))} | ${fmt(avg(rs.map((r) => r.input)))} | ${fmt(avg(rs.map((r) => r.cacheWrite)))} | ${fmt(avg(rs.map((r) => r.cacheRead)))} | ${fmt(avg(rs.map((r) => r.output)))} | ${fmt(avg(rs.map((r) => r.thinking)))} | ${fmt(avg(rs.map((r) => (r.ms === null ? null : r.ms / 1000))), 1)}초 |`,
    );
  }
  // 과제 하나를 끝내는 데 든 전부(생성 + 재작성 + 형식 재요청 + 그 과제의 자기 평가) — 1회 평균
  lines.push('', '## 과제별 합 (1회 평균 — 생성 · 재작성 · 자기 평가 포함)', '', '| 과제 | 호출 수 | 입력 합 | 출력 | 시간 | 1회 통과 | 재작성 | 코드 규칙 위반 | 위반 코드 |', '|---|---|---|---|---|---|---|---|---|');
  const tasks = [...new Set(all.filter((r) => r.task !== 'self_review').map((r) => r.task))];
  for (const t of tasks) {
    const per = Array.from({ length: runs }, (_, i) => all.filter((r) => r.run === i + 1 && (r.task === t || r.of === t)));
    const sum = (rs: RunRow[], f: (r: RunRow) => number | null) => rs.reduce((n, r) => n + (f(r) ?? 0), 0);
    const firstPass = per.filter((rs) => rs.find((r) => r.task === t && r.kind === 'generate')?.status === 'ok').length;
    lines.push(
      `| ${t} | ${fmt(avg(per.map((rs) => rs.length)), 1)} | ${fmt(avg(per.map((rs) => sum(rs, totalIn))))} | ${fmt(avg(per.map((rs) => sum(rs, (r) => r.output))))} | ${fmt(avg(per.map((rs) => sum(rs, (r) => r.ms) / 1000)), 0)}초 | ${firstPass}/${runs} | ${per.map((rs) => rs.filter((r) => r.task === t && r.kind === 'rewrite').length).join('·')} | ${per.map((rs) => sum(rs.filter((r) => r.task === t), (r) => r.ruleErrors)).join('·')} | ${[...new Set(per.flatMap((rs) => rs.filter((r) => r.task === t).flatMap((r) => r.ruleCodes ?? [])))].join(', ') || '-'} |`,
    );
  }
  const perRun = Array.from({ length: runs }, (_, i) => all.filter((r) => r.run === i + 1));
  lines.push('', `- 전체 1회 평균: 호출 ${fmt(avg(perRun.map((rs) => rs.length)), 1)} · 입력 합 ${fmt(avg(perRun.map((rs) => rs.reduce((n, r) => n + (totalIn(r) ?? 0), 0))))} · 출력 ${fmt(avg(perRun.map((rs) => rs.reduce((n, r) => n + (r.output ?? 0), 0))))} · 표시 가격 $${fmt(avg(perRun.map((rs) => rs.reduce((n, r) => n + (r.costUsd ?? 0), 0))), 2)} · 시간 ${fmt(avg(perRun.map((rs) => rs.reduce((n, r) => n + (r.ms ?? 0), 0) / 1000)))}초`);
  lines.push('', '## 단계 결과', '', ...notes.map((n) => `- ${n}`), '');
}
const base = path.join(env.repoRoot, 'tests/results', `${date}-tokens-${label}`);
fs.writeFileSync(`${base}.md`, lines.join('\n'));
fs.writeFileSync(`${base}.json`, JSON.stringify({ date, label, versions, models, source: sourceName, runs, overhead: ovh, calls: all, notes }, null, 1));
console.log(`[토큰 측정] ${path.relative(env.repoRoot, base)}.md 에 저장`);
