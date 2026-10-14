// 「다른 방향 2개 더」 측정 (FR-ID-5). 사람마다 지금 판을 만들어 확정한 뒤 다른 방향 두 개를 요청한다.
//   npm run eval:alternatives -- [--only=me] [--label=alternatives-v1]
// 결과에는 숫자와 함께 지금 판·두 방향의 축 목록 본문을 쓴다 — 실제로 다른 방향인지는 숫자만으로 판단할 수 없어서
// (판정 기준: 한 방향에 올릴 게시물이 지금 판의 축에도 그대로 들어가는가 — 사람이 읽고 판정, devlog 에 적는다)
// 비공개 세트는 숫자만.
import fs from 'node:fs';
import path from 'node:path';
import { env, getSetting } from '../server/src/config.ts';
import { openDb } from '../server/src/db/index.ts';
import { AiService } from '../server/src/ai/adapter.ts';
import { ClaudeCodeProvider } from '../server/src/ai/providers/claude-code.ts';
import { makeProfile } from '../server/src/identity/flow.ts';
import { runAlternatives, type AlternativesResult } from '../server/src/identity/alternatives.ts';
import { addAnsweredTurn, confirmProfile, createSession, getProfile } from '../server/src/identity/store.ts';
import type { AnswerKind } from '../server/src/identity/sources.ts';
import type { SurveyAnswers } from '../server/src/identity/survey.ts';

interface Fixture {
  id: string;
  set: 'real-public' | 'real-private' | 'generated';
  survey: SurveyAnswers;
  turns: Array<{ question: string; answer: string; answerKind: AnswerKind }>;
}
const SETS: Array<[Fixture['set'], string, string]> = [
  ['real-public', 'tests/fixtures/real/interviews', '실제 · 공개'],
  ['real-private', 'tests/fixtures/private/interviews', '실제 · 비공개'],
  ['generated', 'tests/fixtures/generated/interviews', 'AI 생성'],
];
const args = process.argv.slice(2);
const arg = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const only = arg('only');
const versions: Record<string, string> = { identity_alternatives: 'v1', ...getSetting(null, 'prompts.activeVersions') };
const label = arg('label') ?? `alternatives-${versions.identity_alternatives}`;

function load(): Fixture[] {
  const out: Fixture[] = [];
  for (const [set, dir] of SETS) {
    const abs = path.join(env.repoRoot, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
      const fx = JSON.parse(fs.readFileSync(path.join(abs, f), 'utf8')) as Fixture;
      if (!only || fx.id === only) out.push({ ...fx, set });
    }
  }
  return out;
}

interface Row {
  fx: Fixture;
  baseTries: number;
  base: { accountLine: string; pillars: Array<{ name: string; description: string }> } | null;
  alt: AlternativesResult | null;
  reviewFlags: string[];
  seconds: number;
  error?: string;
}

const rows: Row[] = [];
for (const fx of load()) {
  console.log(`[다른 방향 측정] ${fx.set}/${fx.id} …`);
  const db = openDb(':memory:');
  const ai = new AiService({ db, provider: new ClaudeCodeProvider() });
  const sid = createSession(db, 1, fx.survey);
  for (const t of fx.turns) addAnsweredTurn(db, sid, t.question, t.answer, t.answerKind);
  const row: Row = { fx, baseTries: 0, base: null, alt: null, reviewFlags: [], seconds: 0 };
  try {
    // 지금 판: 근거 축 3개 미만으로 되돌아오면 한 번 더 (고정 세트는 더 물을 수 없어서)
    let profileId: number | null = null;
    for (let i = 0; i < 2 && profileId === null; i++) {
      row.baseTries++;
      profileId = (await makeProfile(ai, sid)).profileId;
    }
    if (profileId === null) throw new Error('지금 판을 만들지 못함 (2번 모두 근거 축 3개 미만)');
    confirmProfile(db, profileId);
    const base = getProfile(db, profileId)!;
    row.base = { accountLine: base.accountLine, pillars: base.pillars.map((p) => ({ name: p.name, description: p.description })) };
    const started = Date.now();
    row.alt = await runAlternatives(ai, profileId);
    row.seconds = (Date.now() - started) / 1000;
    const reviews = db.prepare("SELECT issues_json FROM ai_runs WHERE task = 'self_review' AND job_id IN (SELECT job_id FROM ai_runs WHERE task = 'identity_alternatives')").all() as Array<{
      issues_json: string | null;
    }>;
    row.reviewFlags = reviews.flatMap((r) => (r.issues_json ? (JSON.parse(r.issues_json) as Array<{ code: string; where?: string; message: string }>) : []))
      .filter((i) => i.code !== 'review_style')
      .map((i) => `[${i.code}] ${i.where ?? ''} ${i.message}`);
  } catch (err) {
    row.error = (err as Error).message;
  }
  const a = row.alt;
  console.log(`  → ${a ? `통과 ${a.directions.filter((d) => d.ok).length}/2 · 호출 ${a.calls} · 재작성 ${a.rewrites} · ${row.seconds.toFixed(0)}초` : `오류: ${row.error}`}`);
  rows.push(row);
}

const date = new Date().toISOString().slice(0, 10);
const lines = [`# 다른 방향 2개 더 측정 · ${date} · ${label}`, '', `- 프롬프트: ${Object.entries(versions).map(([k, v]) => `${k}@${v}`).join(', ')}, 모델 ${getSetting(null, 'ai.taskModels').identity_alternatives}, 사람당 1회`, ''];
for (const [set, , setLabel] of SETS) {
  const rs = rows.filter((r) => r.fx.set === set);
  lines.push(`## ${setLabel} (${rs.length}명)`, '');
  if (rs.length === 0) {
    lines.push('(아직 자료 없음)', '');
    continue;
  }
  const ok = rs.filter((r) => r.alt);
  lines.push('| 지표 | 값 |', '|---|---|');
  lines.push(`| 두 방향 모두 통과 | ${ok.filter((r) => r.alt!.directions.every((d) => d.ok)).length}/${rs.length} |`);
  lines.push(`| 한 방향만 통과 | ${ok.filter((r) => r.alt!.directions.filter((d) => d.ok).length === 1).length}/${rs.length} |`);
  lines.push(`| 평균 AI 호출 | ${ok.length ? (ok.reduce((s, r) => s + r.alt!.calls, 0) / ok.length).toFixed(1) : '—'} |`);
  lines.push(`| 평균 재작성 | ${ok.length ? (ok.reduce((s, r) => s + r.alt!.rewrites, 0) / ok.length).toFixed(1) : '—'} |`);
  lines.push(`| 평균 시간 (다른 방향만) | ${ok.length ? (ok.reduce((s, r) => s + r.seconds, 0) / ok.length).toFixed(0) : '—'}초 |`, '');
  lines.push('| 사람 | 방향1 | 방향2 | 호출 | 재작성 | 자기 평가 broken·fact | 시간 |', '|---|---|---|---|---|---|---|');
  rs.forEach((r, n) => {
    const who = set === 'real-private' ? `비공개 ${n + 1}` : r.fx.id;
    const d = r.alt?.directions;
    lines.push(
      `| ${who} | ${d ? (d[0]!.ok ? '통과' : '실패') : '—'} | ${d ? (d[1]!.ok ? '통과' : '실패') : '—'} | ${r.alt?.calls ?? '—'} | ${r.alt?.rewrites ?? '—'} | ${r.reviewFlags.length} | ${r.seconds.toFixed(0)}초${r.error ? ` (${r.error.slice(0, 40)})` : ''} |`,
    );
  });
  if (set !== 'real-private') {
    for (const r of rs) {
      lines.push('', `### ${r.fx.id}`, '');
      if (r.base) lines.push(`**지금 판** — ${r.base.accountLine}`, ...r.base.pillars.map((p) => `- ${p.name}: ${p.description}`), '');
      for (const d of r.alt?.directions ?? []) {
        lines.push(`**방향 ${d.index + 1} (${d.ok ? '통과' : '실패'})** · ${d.angle} — ${d.accountLine}`, ...d.pillars.map((p) => `- ${p.name}: ${p.description}`));
        if (!d.ok) lines.push(...d.reasons.map((x) => `  - 실패 이유: ${x}`));
        lines.push('');
      }
      if (r.reviewFlags.length) lines.push('자기 평가 broken·fact 지적:', ...r.reviewFlags.map((x) => `- ${x}`), '');
      if (r.error) lines.push(`오류: ${r.error}`, '');
    }
  }
  lines.push('');
}
const out = path.join(env.repoRoot, 'tests/results', `${date}-identity-${label}.md`);
fs.writeFileSync(out, lines.join('\n'));
console.log(`\n[다른 방향 측정] ${path.relative(env.repoRoot, out)} 에 저장`);
