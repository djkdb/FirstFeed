// 정체성 프로필 측정 (PRD 7-5). 고정 테스트 세트(설문 8 + 고정 질문 5)로 프로필 초안을 만들고 규칙 통과율·재작성·무효 인용을 잰다.
//   npm run eval:identity                                   모든 세트, 사람당 1회 (실제 구독 호출 — 사람당 opus 2~6회)
//   npm run eval:identity -- --only=me                      한 명만
//   npm run eval:identity -- --repeat=2                     사람당 2회 (같은 사람 결과가 흔들리는지 본다)
//   npm run eval:identity -- --prompt identity_profile=v2   프롬프트 버전을 골라 돌린다 (여러 번 줄 수 있다)
//   npm run eval:identity -- --label=profile-v2             결과 파일 이름에 붙일 이름
// 꼬리질문 측정은 scripts/eval-followup.ts 로 따로 한다.
// 결과는 tests/results/<날짜>-identity-<이름>.md 에 실제·공개 / 실제·비공개 / AI 생성 으로 나눠 쓴다. 비공개 세트는 숫자만.
import fs from 'node:fs';
import path from 'node:path';
import { env, getSetting, setSetting } from '../server/src/config.ts';
import { openDb } from '../server/src/db/index.ts';
import { AiService } from '../server/src/ai/adapter.ts';
import { ClaudeCodeProvider } from '../server/src/ai/providers/claude-code.ts';
import { makeProfile } from '../server/src/identity/flow.ts';
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
const arg = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const only = arg('only');
const repeat = Number(arg('repeat') ?? 1);
const promptVersions: Record<string, string> = Object.fromEntries(
  args.flatMap((a, i) => (a === '--prompt' && args[i + 1]?.includes('=') ? [args[i + 1]!.split('=') as [string, string]] : [])),
);
const versions: Record<string, string> = { identity_profile: 'v1', ...getSetting(null, 'prompts.activeVersions'), ...promptVersions };
const label = arg('label') ?? `profile-${versions.identity_profile}-review-${versions.self_review ?? 'v1'}`;

/** 검토자 시점 3인칭 (identity_profile v2 가 없애려는 것) */
const REVIEWER_VOICE = /이 사람|이분|사용자|계정 주인|응답자/;

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

type RunIssue = { code: string; level: string; message: string; where?: string; from: 'rule' | 'review' };

interface Row {
  fx: Fixture;
  run: number;
  outcome: string;
  firstPass: boolean;
  rewrites: number;
  calls: number;
  pillars: number;
  dropped: number;
  invalidQuotes: number;
  /** 모든 시도에서 quote_too_short 가 나온 횟수 */
  tooShort: number;
  ruleCodes: string[];
  reviewBroken: number;
  reviewStyle: number;
  /** 저장된 프로필에서 검토자 시점 표현이 나온 칸 수 */
  reviewerVoice: number;
  /** 저장된 설문 인용 중 "라벨: 답" 한 줄 전체 / 일부 */
  surveyFull: number;
  surveyPartial: number;
  seconds: number;
  maxPillarSim: number | null;
  pillarNames: string[];
  detail: string[];
  error?: string;
}

async function runOne(fx: Fixture, run: number): Promise<Row> {
  const db = openDb(':memory:');
  if (Object.keys(promptVersions).length) setSetting(db, 'prompts.activeVersions', promptVersions);
  const ai = new AiService({ db, provider: new ClaudeCodeProvider() });
  const sessionId = createSession(db, 1, fx.survey);
  for (const t of fx.turns) addAnsweredTurn(db, sessionId, t.question, t.answer, t.answerKind);
  const started = Date.now();
  const row: Row = {
    fx,
    run,
    outcome: '',
    firstPass: false,
    rewrites: 0,
    calls: 0,
    pillars: 0,
    dropped: 0,
    invalidQuotes: 0,
    tooShort: 0,
    ruleCodes: [],
    reviewBroken: 0,
    reviewStyle: 0,
    reviewerVoice: 0,
    surveyFull: 0,
    surveyPartial: 0,
    seconds: 0,
    maxPillarSim: null,
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
    const parse = (x: { issues_json: string | null }) => (x.issues_json ? (JSON.parse(x.issues_json) as RunIssue[]) : []);
    // 자기 평가 지적은 생성·자기 평가 두 기록에 함께 저장되므로, 규칙은 생성 기록에서·지적은 자기 평가 기록에서만 센다
    const ruleIssues = runs.filter((x) => x.task === 'identity_profile').flatMap(parse).filter((i) => i.from === 'rule');
    const reviewIssues = runs.filter((x) => x.task === 'self_review').flatMap(parse);
    row.ruleCodes = [...new Set(ruleIssues.filter((i) => i.level === 'error').map((i) => i.code))];
    row.invalidQuotes = ruleIssues.filter((i) => ['quote_not_in_source', 'quote_too_short', 'label_only_quote', 'unknown_source'].includes(i.code)).length;
    row.tooShort = ruleIssues.filter((i) => i.code === 'quote_too_short').length;
    row.reviewBroken = reviewIssues.filter((i) => i.code === 'review_broken' || i.code === 'review_fact').length;
    row.reviewStyle = reviewIssues.filter((i) => i.code === 'review_style').length;
    row.firstPass = runs.find((x) => x.task === 'identity_profile' && x.kind === 'generate')?.status === 'ok' && r.rewrites === 0;

    const st = getSessionState(db, sessionId);
    const p = st?.profile;
    if (p) {
      row.pillars = p.pillars.length;
      row.dropped = p.dropped.length;
      row.pillarNames = p.pillars.map((x) => x.name);
      const sims: number[] = [];
      for (let i = 0; i < p.pillars.length; i++)
        for (let j = i + 1; j < p.pillars.length; j++)
          sims.push(similarity(`${p.pillars[i]!.name} ${p.pillars[i]!.description}`, `${p.pillars[j]!.name} ${p.pillars[j]!.description}`));
      row.maxPillarSim = sims.length ? Math.max(...sims) : null;
      const texts = [p.accountLine, p.audience, ...p.pillars.map((x) => x.description), ...p.voiceRules];
      row.reviewerVoice = texts.filter((t) => REVIEWER_VOICE.test(t)).length;
      for (const x of p.pillars)
        for (const e of x.evidence)
          if (e.source.startsWith('S')) {
            // "라벨: 답" 한 줄 전체인지: 인용에 콜론 앞 라벨이 들어 있으면 전체로 본다
            if (/^[^:]+:\s*\S/.test(e.quote)) row.surveyFull++;
            else row.surveyPartial++;
          }
      row.detail.push(`**${p.accountLine}** — ${p.audience}`);
      for (const x of p.pillars)
        row.detail.push(`- **${x.name}**: ${x.description}`, ...x.evidence.map((e) => `  - “${e.quote}” (${e.sourceLabel}${e.weight === 'supporting' ? ' · 보조' : ''})`));
      for (const d of p.dropped) row.detail.push(`- ~~${d.name}~~ 근거 부족: ${d.reason}`);
      row.detail.push(`- 말투: ${p.voiceRules.join(' / ')}`, `- 피할 것: ${p.avoid.join(' / ')}`, `- 모르는 것: ${p.unknown.join(' / ') || '—'}`);
    } else if (st?.note) {
      row.detail.push(`(저장 안 됨) ${st.note.message}`, ...st.note.missing.map((m) => `- ${m}`));
    }
    const notes = reviewIssues.filter((i) => i.code !== 'review_style');
    if (notes.length) row.detail.push('', '자기 평가 broken/fact 지적:', ...notes.map((i) => `- [${i.code}] ${i.where ?? ''} ${i.message}`));
    const rules = ruleIssues.filter((i) => i.level === 'error');
    if (rules.length) row.detail.push('', '걸린 코드 규칙:', ...rules.map((i) => `- [${i.code}] ${i.where ?? ''} ${i.message}`));
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
console.log(`[측정] ${fixtures.length}명 × ${repeat}회 — 프롬프트 ${JSON.stringify(versions)}`);
const rows: Row[] = [];
for (const fx of fixtures) {
  for (let run = 1; run <= repeat; run++) {
    console.log(`[측정] ${fx.set}/${fx.id} #${run} …`);
    const r = await runOne(fx, run);
    console.log(`  → ${r.outcome} · 재작성 ${r.rewrites} · 짧은 인용 ${r.tooShort} · 축 ${r.pillars} · ${r.seconds.toFixed(0)}초${r.error ? ` · ${r.error}` : ''}`);
    rows.push(r);
  }
}

const pct = (n: number, d: number) => (d === 0 ? '—' : `${Math.round((n / d) * 100)}% (${n}/${d})`);
const avg = (xs: number[], digits = 1) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(digits) : '—');
const date = new Date().toISOString().slice(0, 10);
const lines: string[] = [];
lines.push(`# 정체성 프로필 측정 · ${date} · ${label}`, '');
lines.push(`- 프롬프트: ${Object.entries(versions).map(([k, v]) => `${k}@${v}`).join(', ')}`);
lines.push(`- 모델: 프로필 ${getSetting(null, 'ai.taskModels').identity_profile}, 자기 평가 ${getSetting(null, 'ai.taskModels').self_review}`);
lines.push(`- 기준값: 축 겹침 ${getSetting(null, 'identity.pillarOverlapThreshold')}, 인용 최소 ${getSetting(null, 'identity.minQuoteChars')}자`);
lines.push(`- 입력: 설문 8 + 고정 질문 5 (tests/fixtures/*/interviews), 사람당 ${repeat}회`, '');
for (const [set, , setLabel] of SETS) {
  const rs = rows.filter((r) => r.fx.set === set);
  const people = [...new Set(rs.map((r) => r.fx.id))];
  lines.push(`## ${setLabel} (${people.length}명 × ${repeat}회)`, '');
  if (rs.length === 0) {
    lines.push('(아직 자료 없음)', '');
    continue;
  }
  const saved = rs.filter((r) => r.outcome.startsWith('saved'));
  lines.push('| 지표 | 값 |', '|---|---|');
  lines.push(`| 1회 생성 통과율 | ${pct(rs.filter((r) => r.firstPass).length, rs.length)} |`);
  lines.push(`| 저장(재작성 2회 이내) | ${pct(saved.length, rs.length)} |`);
  lines.push(`| 근거 축 3개 미만 → 인터뷰 | ${rs.filter((r) => r.outcome === 'needs_more').length} |`);
  lines.push(`| 평균 재작성 | ${avg(rs.map((r) => r.rewrites))} |`);
  lines.push(`| quote_too_short (모든 시도 합) | ${rs.reduce((a, r) => a + r.tooShort, 0)} |`);
  lines.push(`| 무효 인용 (모든 시도 합) | ${rs.reduce((a, r) => a + r.invalidQuotes, 0)} |`);
  lines.push(`| 자기 평가 broken·fact (합) | ${rs.reduce((a, r) => a + r.reviewBroken, 0)} |`);
  lines.push(`| 검토자 시점 표현 (저장된 프로필의 칸 수 합) | ${saved.reduce((a, r) => a + r.reviewerVoice, 0)} |`);
  lines.push(`| 설문 인용: 한 줄 전체 / 일부 | ${saved.reduce((a, r) => a + r.surveyFull, 0)} / ${saved.reduce((a, r) => a + r.surveyPartial, 0)} |`);
  lines.push(`| 평균 AI 호출 | ${avg(rs.map((r) => r.calls))} |`);
  lines.push(`| 평균 시간 | ${avg(rs.map((r) => r.seconds), 0)}초 |`, '');
  lines.push(
    '| 사람 | 회차 | 결과 | 재작성 | 짧은 인용 | 축 | 근거 부족 | 걸린 규칙 | 평가 broken·fact | 평가 style | 검토자 시점 | 설문 인용 전체/일부 | 축 쌍 최대 유사도 | 시간 |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  );
  for (const r of rs) {
    const who = set === 'real-private' ? `비공개 ${people.indexOf(r.fx.id) + 1}` : r.fx.id;
    lines.push(
      `| ${who} | ${r.run} | ${r.outcome}${r.error ? ` (${r.error.slice(0, 40)})` : ''} | ${r.rewrites} | ${r.tooShort} | ${r.pillars} | ${r.dropped} | ${r.ruleCodes.join(', ') || '—'} | ${r.reviewBroken} | ${r.reviewStyle} | ${r.reviewerVoice} | ${r.surveyFull}/${r.surveyPartial} | ${r.maxPillarSim === null ? '—' : r.maxPillarSim.toFixed(2)} | ${r.seconds.toFixed(0)}초 |`,
    );
  }
  if (repeat > 1) {
    // 같은 사람의 회차끼리 결과가 크게 다르면 따로 적는다 (결과·축 수·축 이름 겹침)
    lines.push('', '같은 사람 회차 간 차이:');
    for (const id of people) {
      const mine = rs.filter((r) => r.fx.id === id);
      const outcomes = [...new Set(mine.map((r) => r.outcome))];
      const counts = [...new Set(mine.map((r) => r.pillars))];
      const who = set === 'real-private' ? `비공개 ${people.indexOf(id) + 1}` : id;
      const diff = outcomes.length > 1 || counts.length > 1 ? '**다름**' : '같음';
      lines.push(`- ${who}: ${diff} — 결과 ${mine.map((r) => r.outcome).join(' / ')}, 축 ${mine.map((r) => r.pillars).join(' / ')}, 재작성 ${mine.map((r) => r.rewrites).join(' / ')}`);
      if (set !== 'real-private') lines.push(...mine.map((r) => `  - ${r.run}회: ${r.pillarNames.join(' · ') || '—'}`));
    }
  }
  if (set !== 'real-private') {
    for (const r of rs) lines.push('', `<details><summary>${r.fx.id} ${r.run}회 본문</summary>`, '', ...r.detail, '', '</details>');
  }
  lines.push('');
}
const out = path.join(env.repoRoot, 'tests/results', `${date}-identity-${label}.md`);
fs.writeFileSync(out, lines.join('\n'));
console.log(`\n[측정] ${path.relative(env.repoRoot, out)} 에 저장`);
