// 정체성 프로필 측정 (PRD 7-5). 고정 테스트 세트(설문 8 + 고정 질문 5)로 프로필 초안을 만들고 규칙 통과율·재작성·무효 인용을 잰다.
//   npm run eval:identity                 모든 세트 (실제 구독 호출 — 사람당 opus 2~6회)
//   npm run eval:identity -- --only=me    한 명만
//   npm run eval:identity -- --followup   고정 5턴 뒤 꼬리질문 1개도 만들어 규칙을 잰다 (sonnet)
// 결과는 tests/results/<날짜>-identity-<프롬프트 버전>.md 에 실제·공개 / 실제·비공개 / AI 생성 으로 나눠 쓴다.
// 비공개 세트는 숫자만 쓴다 (원문·축 이름 금지).
import fs from 'node:fs';
import path from 'node:path';
import { env, getSetting, setSetting } from '../server/src/config.ts';
import { openDb } from '../server/src/db/index.ts';
import { AiService } from '../server/src/ai/adapter.ts';
import { ClaudeCodeProvider } from '../server/src/ai/providers/claude-code.ts';
import { askNext, makeProfile } from '../server/src/identity/flow.ts';
import { addAnsweredTurn, createSession, getSessionState } from '../server/src/identity/store.ts';
import { similarity } from '../server/src/rules/similarity.ts';
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
const only = args.find((a) => a.startsWith('--only='))?.slice(7);
const withFollowup = args.includes('--followup');
// --prompt self_review=v1 처럼 프롬프트 버전을 골라 돌린다 (전/후 비교용). 여러 번 줄 수 있다
const promptVersions: Record<string, string> = Object.fromEntries(
  args.flatMap((a, i) => (a === '--prompt' && args[i + 1]?.includes('=') ? [args[i + 1]!.split('=') as [string, string]] : [])),
);

function load(): Fixture[] {
  const out: Fixture[] = [];
  for (const [set, dir] of SETS) {
    const abs = path.join(env.repoRoot, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).filter((f) => f.endsWith('.json') && !f.startsWith('_'))) {
      const fx = JSON.parse(fs.readFileSync(path.join(abs, f), 'utf8')) as Fixture;
      if (!only || fx.id === only) out.push({ ...fx, set });
    }
  }
  return out;
}

interface Row {
  fx: Fixture;
  outcome: string;
  firstPass: boolean;
  rewrites: number;
  calls: number;
  pillars: number;
  dropped: number;
  invalidQuotes: number;
  ruleCodes: string[];
  reviewIssues: number;
  seconds: number;
  pillarSims: number[];
  pillarNames: string[];
  /** 공개 세트만 결과에 쓰는 본문 (비공개는 숫자만) */
  detail: string[];
  followup?: { firstPass: boolean; rewrites: number; maxSimToPrev: number; question: string; codes: string[] };
  error?: string;
}

async function runOne(fx: Fixture): Promise<Row> {
  const db = openDb(':memory:');
  if (Object.keys(promptVersions).length) setSetting(db, 'prompts.activeVersions', promptVersions);
  const ai = new AiService({ db, provider: new ClaudeCodeProvider() });
  const sessionId = createSession(db, 1, fx.survey);
  for (const t of fx.turns) addAnsweredTurn(db, sessionId, t.question, t.answer, t.answerKind);
  const started = Date.now();
  const row: Row = {
    fx,
    outcome: '',
    firstPass: false,
    rewrites: 0,
    calls: 0,
    pillars: 0,
    dropped: 0,
    invalidQuotes: 0,
    ruleCodes: [],
    reviewIssues: 0,
    seconds: 0,
    pillarSims: [],
    pillarNames: [],
    detail: [],
  };
  try {
    const r = await makeProfile(ai, sessionId);
    row.outcome = r.outcome + (r.salvaged ? '(구제)' : '');
    row.rewrites = r.rewrites;
    row.calls = r.calls;
    const runs = db.prepare("SELECT task, kind, status, issues_json FROM ai_runs WHERE task IN ('identity_profile','self_review') ORDER BY id").all() as Array<{
      task: string;
      kind: string;
      status: string;
      issues_json: string | null;
    }>;
    type RunIssue = { code: string; level: string; message: string; where?: string; from: 'rule' | 'review' };
    const parse = (x: { issues_json: string | null }) => (x.issues_json ? (JSON.parse(x.issues_json) as RunIssue[]) : []);
    // 자기 평가 지적은 생성 기록과 자기 평가 기록 양쪽에 저장되므로, 규칙은 생성 기록에서·지적은 자기 평가 기록에서만 센다
    // (처음엔 둘을 더해 지적이 두 번씩 셌다 — devlog 2026-10-13-04)
    const issues = [
      ...runs.filter((x) => x.task === 'identity_profile').flatMap(parse).filter((i) => i.from === 'rule'),
      ...runs.filter((x) => x.task === 'self_review').flatMap(parse),
    ];
    row.ruleCodes = [...new Set(issues.filter((i) => i.level === 'error').map((i) => i.code))];
    row.invalidQuotes = issues.filter((i) => ['quote_not_in_source', 'quote_too_short', 'unknown_source'].includes(i.code)).length;
    row.reviewIssues = issues.filter((i) => i.code.startsWith('review_')).length;
    const reviewNotes = issues.filter((i) => i.code.startsWith('review_'));
    if (reviewNotes.length) row.detail.push('', '자기 평가 지적:', ...reviewNotes.map((i) => `- [${i.code}] ${i.where ?? ''} ${i.message}`), '');
    row.firstPass = runs.find((x) => x.task === 'identity_profile' && x.kind === 'generate')?.status === 'ok' && r.rewrites === 0;
    const p = getSessionState(db, sessionId)?.profile;
    if (p) {
      row.pillars = p.pillars.length;
      row.dropped = p.dropped.length;
      row.pillarNames = p.pillars.map((x) => x.name);
      row.detail.push(`**${p.accountLine}** — ${p.audience}`);
      for (const x of p.pillars) row.detail.push(`- **${x.name}**: ${x.description}`, ...x.evidence.map((e) => `  - “${e.quote}” (${e.sourceLabel})`));
      for (const d of p.dropped) row.detail.push(`- ~~${d.name}~~ 근거 부족: ${d.reason}`);
      row.detail.push(`- 말투: ${p.voiceRules.join(' / ')}`, `- 피할 것: ${p.avoid.join(' / ')}`, `- 모르는 것: ${p.unknown.join(' / ') || '—'}`);
      for (let i = 0; i < p.pillars.length; i++)
        for (let j = i + 1; j < p.pillars.length; j++)
          row.pillarSims.push(similarity(`${p.pillars[i]!.name} ${p.pillars[i]!.description}`, `${p.pillars[j]!.name} ${p.pillars[j]!.description}`));
    }
    if (withFollowup) {
      // 프로필을 만든 세션과 별개로, 고정 5턴 뒤 다음 질문을 만든다
      const sid = createSession(db, 1, fx.survey);
      for (const t of fx.turns) addAnsweredTurn(db, sid, t.question, t.answer, t.answerKind);
      const before = (db.prepare("SELECT COUNT(*) AS n FROM ai_runs WHERE task = 'identity_followup'").get() as { n: number }).n;
      const a = await askNext(ai, sid);
      const fr = db.prepare("SELECT kind, status, issues_json FROM ai_runs WHERE task = 'identity_followup' ORDER BY id").all().slice(before) as Array<{
        kind: string;
        status: string;
        issues_json: string | null;
      }>;
      const st = getSessionState(db, sid)!;
      const q = a.kind === 'asked' ? st.turns.at(-1)!.question : '(실패)';
      row.followup = {
        firstPass: fr[0]?.status === 'ok',
        rewrites: fr.filter((x) => x.kind === 'rewrite').length,
        maxSimToPrev: Math.max(...fx.turns.map((t) => similarity(q, t.question))),
        question: q,
        codes: [...new Set(fr.flatMap((x) => (x.issues_json ? (JSON.parse(x.issues_json) as Array<{ code: string }>).map((i) => i.code) : [])))],
      };
    }
  } catch (err) {
    row.outcome = 'error';
    row.error = (err as Error).message;
  }
  row.seconds = (Date.now() - started) / 1000;
  return row;
}

const fixtures = load();
if (fixtures.length === 0) {
  console.error('[측정] 테스트 세트가 없습니다. tests/fixtures/*/interviews/*.json 을 확인하세요.');
  process.exit(1);
}
console.log(`[측정] ${fixtures.length}명 — 프롬프트 ${JSON.stringify({ identity_profile: 'v1', self_review: 'v1', ...getSetting(null, 'prompts.activeVersions'), ...promptVersions })}`);
const rows: Row[] = [];
for (const fx of fixtures) {
  console.log(`[측정] ${fx.set}/${fx.id} …`);
  const r = await runOne(fx);
  console.log(`  → ${r.outcome} · 재작성 ${r.rewrites} · 축 ${r.pillars} · 근거 부족 ${r.dropped} · ${r.seconds.toFixed(0)}초${r.error ? ` · ${r.error}` : ''}`);
  rows.push(r);
}

const pct = (n: number, d: number) => (d === 0 ? '—' : `${Math.round((n / d) * 100)}% (${n}/${d})`);
const lines: string[] = [];
const date = new Date().toISOString().slice(0, 10);
const ver = promptVersions.identity_profile ?? getSetting(null, 'prompts.activeVersions').identity_profile ?? 'v1';
const reviewVer = promptVersions.self_review ?? getSetting(null, 'prompts.activeVersions').self_review ?? 'v1';
const followVer = promptVersions.identity_followup ?? getSetting(null, 'prompts.activeVersions').identity_followup ?? 'v1';
lines.push(`# 정체성 프로필 측정 · ${date} · identity_profile@${ver} · self_review@${reviewVer}${withFollowup ? ` · identity_followup@${followVer}` : ''}`, '');
lines.push(`- 모델: 프로필 ${getSetting(null, 'ai.taskModels').identity_profile}, 자기 평가 ${getSetting(null, 'ai.taskModels').self_review}${withFollowup ? `, 꼬리질문 ${getSetting(null, 'ai.taskModels').identity_followup}` : ''}`);
lines.push(`- 기준값: 축 겹침 ${getSetting(null, 'identity.pillarOverlapThreshold')}, 질문 중복 ${getSetting(null, 'identity.duplicateQuestionThreshold')}, 인용 최소 ${getSetting(null, 'identity.minQuoteChars')}자 (임시값)`);
lines.push('- 입력: 설문 8 + 고정 질문 5 (tests/fixtures/*/interviews)', '');
for (const [set, , label] of SETS) {
  const rs = rows.filter((r) => r.fx.set === set);
  if (rs.length === 0) continue;
  lines.push(`## ${label} (${rs.length}명)`, '');
  lines.push(`| 지표 | 값 |`, `|---|---|`);
  lines.push(`| 1회 생성 통과율 | ${pct(rs.filter((r) => r.firstPass).length, rs.length)} |`);
  lines.push(`| 재작성 2회 이내 저장 | ${pct(rs.filter((r) => r.outcome.startsWith('saved') && r.rewrites <= 2).length, rs.length)} |`);
  lines.push(`| 평균 재작성 | ${(rs.reduce((a, r) => a + r.rewrites, 0) / rs.length).toFixed(1)} |`);
  lines.push(`| 무효 인용(모든 시도 합) | ${rs.reduce((a, r) => a + r.invalidQuotes, 0)} |`);
  lines.push(`| 평균 AI 호출 | ${(rs.reduce((a, r) => a + r.calls, 0) / rs.length).toFixed(1)} |`);
  lines.push(`| 평균 시간 | ${(rs.reduce((a, r) => a + r.seconds, 0) / rs.length).toFixed(0)}초 |`, '');
  lines.push(`| 사람 | 결과 | 재작성 | 축 | 근거 부족 | 무효 인용 | 걸린 규칙 | 자기 평가 지적 | 축 쌍 최대 유사도 | 시간 |`, `|---|---|---|---|---|---|---|---|---|---|`);
  for (const r of rs) {
    const who = set === 'real-private' ? `비공개 ${rs.indexOf(r) + 1}` : r.fx.id;
    lines.push(
      `| ${who} | ${r.outcome}${r.error ? ` (${r.error.slice(0, 40)})` : ''} | ${r.rewrites} | ${r.pillars} | ${r.dropped} | ${r.invalidQuotes} | ${r.ruleCodes.join(', ') || '—'} | ${r.reviewIssues} | ${r.pillarSims.length ? Math.max(...r.pillarSims).toFixed(2) : '—'} | ${r.seconds.toFixed(0)}초 |`,
    );
  }
  if (set !== 'real-private') {
    lines.push('', '축 이름:', ...rs.map((r) => `- ${r.fx.id}: ${r.pillarNames.join(' · ') || '—'}`));
    for (const r of rs) lines.push('', `<details><summary>${r.fx.id} 프로필 본문</summary>`, '', ...r.detail, '', '</details>');
  }
  if (withFollowup) {
    lines.push('', '| 사람 | 꼬리질문 1회 통과 | 재작성 | 고정 질문과 최대 유사도 | 걸린 규칙 |', '|---|---|---|---|---|');
    for (const r of rs) {
      const f = r.followup;
      const who = set === 'real-private' ? `비공개 ${rs.indexOf(r) + 1}` : r.fx.id;
      lines.push(`| ${who} | ${f ? (f.firstPass ? '예' : '아니오') : '—'} | ${f?.rewrites ?? '—'} | ${f ? f.maxSimToPrev.toFixed(2) : '—'} | ${f?.codes.join(', ') || '—'} |`);
    }
    if (set !== 'real-private') lines.push('', '만든 질문:', ...rs.map((r) => `- ${r.fx.id}: ${r.followup?.question ?? '—'}`));
  }
  lines.push('');
}
const out = path.join(env.repoRoot, 'tests/results', `${date}-identity-${ver}-review-${reviewVer}.md`);
fs.writeFileSync(out, lines.join('\n'));
console.log(`\n[측정] ${path.relative(env.repoRoot, out)} 에 저장\n`);
console.log(lines.join('\n'));
