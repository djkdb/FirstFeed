// 성과 제안 측정(2026-11-24): 고정 성과 표 + 공개 프로필 스냅숏(me)으로 앱과 같은 경로(suggestFromGroups — 생성 → 코드 규칙 → 자기 평가 → 재작성)를 돌린다.
// 통과 · 재작성 · 걸린 규칙 · 토큰과 제안 문장을 남긴다(사람이 읽고 판정).
//   npm run eval:insights -- --runs=2 --label=v1 [--prompt insight_suggest=v2] [--posts=<json>] [--no-save] [--cloud-session]
// --posts 기본은 AI 생성 합성 표(tests/fixtures/generated/insights/posts.json). 실제 계정 숫자로 돌릴 때는 --no-save(레포에 숫자를 남기지 않는다)
// 결과: tests/results/<날짜>-insight-suggest-<label>.md · .json
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../server/src/config.ts';
import { openDb } from '../server/src/db/index.ts';
import { AiService } from '../server/src/ai/adapter.ts';
import { ClaudeCodeProvider, isSubscriptionAuth, type AuthStatus } from '../server/src/ai/providers/claude-code.ts';
import { saveProfileVersion } from '../server/src/identity/store.ts';
import type { ProfileContent } from '../server/src/identity/model.ts';
import { analyze, insightTable, type SetInfo } from '../server/src/insights/analyze.ts';
import type { InsightPost } from '../server/src/insights/store.ts';
import { suggestFromGroups } from '../server/src/insights/suggest.ts';
import { getSetting, setSetting } from '../server/src/config.ts';
import { parsePromptArgs } from './prompt-args.ts';

const args = process.argv.slice(2);
const runs = Number(args.find((a) => a.startsWith('--runs='))?.slice(7) ?? 1);
const label = args.find((a) => a.startsWith('--label='))?.slice(8) ?? 'run';
const postsPath = args.find((a) => a.startsWith('--posts='))?.slice(8) ?? path.join(env.repoRoot, 'tests/fixtures/generated/insights/posts.json');
const save = !args.includes('--no-save');
// 판을 고르면 머리 줄에 그대로 적는다(옛 판으로 잰 줄 모르고 해석한 일 — CLAUDE.md 「겪은 오류」)
const versions = { ...getSetting(null, 'prompts.activeVersions'), ...parsePromptArgs(args, path.join(env.repoRoot, 'prompts')) };
const cloud = args.includes('--cloud-session');
if (cloud && process.env.CLAUDE_CODE_REMOTE !== 'true') throw new Error('--cloud-session 은 Claude Code 원격 세션 컨테이너(CLAUDE_CODE_REMOTE=true)에서만 씁니다');
const acceptAuth = cloud ? (a: AuthStatus, e: NodeJS.ProcessEnv) => isSubscriptionAuth(a, e) || (a.loggedIn === true && a.apiProvider === 'firstParty' && a.authMethod === 'oauth_token') : undefined;

type InputPost = Omit<InsightPost, 'id' | 'source' | 'fetchedAt' | 'setId' | 'url' | 'content' | 'views' | 'likes' | 'comments'> & { set?: SetInfo };
const input = JSON.parse(fs.readFileSync(postsPath, 'utf8')) as { now?: string; posts: InputPost[] };
const kind = postsPath.includes('/generated/') ? 'AI 생성' : '실제';
const sets = new Map<number, SetInfo>();
const posts: InsightPost[] = input.posts.map((p, i) => {
  if (p.set) sets.set(i + 1, p.set);
  return { id: i + 1, source: 'metricool', fetchedAt: null, url: null, content: null, views: null, likes: null, comments: null, ...p, setId: p.set ? i + 1 : null };
});
const prof = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/real/profiles/me.json'), 'utf8')) as { profile: ProfileContent };
const names = new Map(prof.profile.pillars.map((p) => [p.id, p.name]));

const rows: Array<Record<string, unknown>> = [];
const md: string[] = [];
for (let run = 1; run <= runs; run++) {
  const db = openDb(':memory:');
  setSetting(db, 'prompts.activeVersions', versions);
  saveProfileVersion(db, 1, prof.profile, { reason: 'interview', sessionId: null, basedOn: null, jobId: null, activate: true });
  const { groups } = analyze(posts, { now: input.now ? Date.parse(input.now) : Date.now(), matureHours: getSetting(db, 'insights.matureHours'), minSamples: getSetting(db, 'insights.minSamples'), sets, pillarNames: names });
  if (run === 1) md.push('## 입력 표(앱이 AI 에게 보이는 그대로)', '', '```', insightTable(groups).text, '```', '');
  const ai = new AiService({ db, provider: new ClaudeCodeProvider(acceptAuth ? { acceptAuth } : {}) });
  const t0 = Date.now();
  const res = await suggestFromGroups(ai, 1, groups).catch((e: Error) => ({ status: 'error' as const, message: e.message }));
  const runsRows = db.prepare("SELECT kind, issues_json, input_tokens, output_tokens FROM ai_runs WHERE task = 'insight_suggest' ORDER BY id").all() as Array<Record<string, unknown>>;
  const reasons = runsRows.flatMap((r) => ((JSON.parse(String(r.issues_json ?? '[]')) as Array<{ level: string; code: string }>) ?? []).filter((i) => i.level === 'error').map((i) => i.code));
  // 재작성 사유는 코드만으로는 왜 걸렸는지 알 수 없어 문장까지 남긴다(사람이 읽고 과잉 판정인지 본다)
  const reasonTexts = runsRows.flatMap((r) => ((JSON.parse(String(r.issues_json ?? '[]')) as Array<{ level: string; code: string; where?: string; message?: string }>) ?? []).filter((i) => i.level === 'error').map((i) => `${i.code}${i.where ? ` (${i.where})` : ''}: ${i.message ?? ''}`));
  const warns = runsRows.flatMap((r) => ((JSON.parse(String(r.issues_json ?? '[]')) as Array<{ level: string; code: string; message?: string }>) ?? []).filter((i) => i.level !== 'error').map((i) => `${i.code}: ${i.message ?? ''}`));
  const saved = db.prepare('SELECT kind, group_key, text, rule, evidence_json FROM insight_suggestions ORDER BY id').all() as Array<Record<string, string>>;
  const row = { run, kind, status: res.status, rewrites: 'rewrites' in res ? res.rewrites : null, reasonTexts, calls: 'calls' in res ? res.calls : null, seconds: Math.round((Date.now() - t0) / 1000), reasons, warns, suggestions: saved, error: 'message' in res ? res.message : 'errors' in res ? res.errors : null };
  rows.push(row);
  console.log(`${run}회(insight_suggest ${versions.insight_suggest}): ${row.status} · 재작성 ${row.rewrites ?? '-'} · ${row.seconds}초${reasons.length ? ` · ${reasons.join(',')}` : ''}${row.error ? ` · ${JSON.stringify(row.error)}` : ''}`);
  for (const t of reasonTexts) console.log(`  사유 ${t}`);
  for (const s of saved) console.log(`  [${s.kind}] ${s.group_key} — ${s.text} / 규칙: ${s.rule}`);
  md.push(`## ${run}회(${kind}) — ${row.status} · 재작성 ${row.rewrites ?? '-'} · ${row.seconds}초${reasons.length ? ` · 걸린 규칙 ${reasons.join(', ')}` : ''}`, '');
  for (const s of saved) md.push(`- **${s.kind === 'more' ? '더 할 것' : '줄일 것'}** \`${s.group_key}\` — ${s.text}  \n  규칙: ${s.rule}`);
  if (reasonTexts.length) md.push('', '재작성 사유:', ...reasonTexts.map((t) => `- ${t}`));
  if (warns.length) md.push('', `경고(재작성 사유 아님): ${warns.join(' / ')}`);
  md.push('');
}
if (save) {
  const date = new Date().toLocaleDateString('sv-SE');
  const base = path.join(env.repoRoot, 'tests/results', `${date}-insight-suggest-${label}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify({ label, postsPath: path.relative(env.repoRoot, postsPath), kind, rows }, null, 1));
  fs.writeFileSync(`${base}.md`, [`# 성과 제안 측정 — ${label} (${date})`, '', `입력: \`${path.relative(env.repoRoot, postsPath)}\`(${kind}) · 프로필: 공개 fixture me · ${runs}회 · 프롬프트 insight_suggest ${versions.insight_suggest} · 자기 평가 insight_suggest_review ${versions.insight_suggest_review}`, '', ...md].join('\n'));
  console.log(`→ ${base}.md`);
} else console.log('(--no-save — 결과를 레포에 남기지 않음)');
