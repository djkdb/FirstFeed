// 꼬리질문 측정 (FR-ID-2). 같은 대화 기록에서 다음 질문을 만들어 규칙 통과·재작성·시간과, v2 가 고치려는 문제를 잰다.
//   npm run eval:followup -- --repeat=2 --prompt identity_followup=v2 --label=followup-v2
// 입력: 고정 세트(tests/fixtures/*/interviews, 고정 질문 5턴 뒤) + 함정 시나리오(tests/fixtures/generated/followup)
// 자동 판정: 예시 답 내용을 확인 없이 전제했는가 / 앞 답을 따옴표로 인용했는가. 두 갈래 질문 여부는 사람이 본문을 읽고 판정한다.
import fs from 'node:fs';
import path from 'node:path';
import { env, getSetting, setSetting } from '../server/src/config.ts';
import { parsePromptArgs } from './prompt-args.ts';
import { openDb } from '../server/src/db/index.ts';
import { AiService } from '../server/src/ai/adapter.ts';
import { ClaudeCodeProvider } from '../server/src/ai/providers/claude-code.ts';
import { askNext } from '../server/src/identity/flow.ts';
import { addAnsweredTurn, createSession, getSessionState } from '../server/src/identity/store.ts';
import { normalizeForQuote } from '../server/src/rules/grounding.ts';
import type { AnswerKind } from '../server/src/identity/sources.ts';
import type { SurveyAnswers } from '../server/src/identity/survey.ts';

interface Scenario {
  id: string;
  set: 'real-public' | 'real-private' | 'generated';
  kind: '고정 5턴' | '함정';
  survey: SurveyAnswers;
  turns: Array<{ question: string; answer: string; answerKind: AnswerKind }>;
  checks?: { presumedToken?: string; expectQuote?: boolean };
}

const args = process.argv.slice(2);
const arg = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const repeat = Number(arg('repeat') ?? 1);
const promptVersions: Record<string, string> = parsePromptArgs(args, path.join(env.repoRoot, 'prompts'));
const versions: Record<string, string> = { identity_followup: 'v1', ...getSetting(null, 'prompts.activeVersions'), ...promptVersions };
const label = arg('label') ?? `followup-${versions.identity_followup}`;

// 예시 내용을 전제했어도, 실제로 했는지 확인하는 질문이면 전제가 아니다
const CONFIRM = /실제로|정말|직접 만드신|만드셨나요|맞나요|해 보신 적|경험이 있나요|있으신가요|본인의 말로|직접 하신/;

function load(): Scenario[] {
  const out: Scenario[] = [];
  const dirs: Array<[Scenario['set'], string, Scenario['kind']]> = [
    ['real-public', 'tests/fixtures/real/interviews', '고정 5턴'],
    ['real-private', 'tests/fixtures/private/interviews', '고정 5턴'],
    ['generated', 'tests/fixtures/generated/interviews', '고정 5턴'],
    ['generated', 'tests/fixtures/generated/followup', '함정'],
  ];
  for (const [set, dir, kind] of dirs) {
    const abs = path.join(env.repoRoot, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
      out.push({ ...(JSON.parse(fs.readFileSync(path.join(abs, f), 'utf8')) as Scenario), set, kind });
    }
  }
  return out;
}

/** 질문 속 따옴표 안의 말이 앞 답에 실제로 있는가 */
function quotesPrevAnswer(q: string, answers: string[]): boolean {
  const quoted = [...q.matchAll(/[“"'‘]([^”"'’]{2,})[”"'’]/g)].map((m) => normalizeForQuote(m[1]!));
  return quoted.some((x) => x.length >= 2 && answers.some((a) => normalizeForQuote(a).includes(x)));
}

interface Row {
  sc: Scenario;
  run: number;
  question: string;
  firstPass: boolean;
  rewrites: number;
  codes: string[];
  presumed: boolean | null;
  quoted: boolean;
  seconds: number;
  error?: string;
}

const rows: Row[] = [];
const scenarios = load();
console.log(`[꼬리질문 측정] ${scenarios.length}개 × ${repeat}회 — ${JSON.stringify(versions)}`);
for (const sc of scenarios) {
  for (let run = 1; run <= repeat; run++) {
    const db = openDb(':memory:');
    if (Object.keys(promptVersions).length) setSetting(db, 'prompts.activeVersions', promptVersions);
    const ai = new AiService({ db, provider: new ClaudeCodeProvider() });
    const sid = createSession(db, 1, sc.survey);
    for (const t of sc.turns) addAnsweredTurn(db, sid, t.question, t.answer, t.answerKind);
    const started = Date.now();
    const row: Row = { sc, run, question: '', firstPass: false, rewrites: 0, codes: [], presumed: null, quoted: false, seconds: 0 };
    try {
      const a = await askNext(ai, sid);
      const fr = db.prepare("SELECT kind, status, issues_json FROM ai_runs WHERE task = 'identity_followup' ORDER BY id").all() as Array<{
        kind: string;
        status: string;
        issues_json: string | null;
      }>;
      row.firstPass = fr[0]?.status === 'ok';
      row.rewrites = fr.filter((x) => x.kind === 'rewrite').length;
      row.codes = [...new Set(fr.flatMap((x) => (x.issues_json ? (JSON.parse(x.issues_json) as Array<{ code: string }>).map((i) => i.code) : [])))];
      row.question = a.kind === 'asked' ? getSessionState(db, sid)!.turns.at(-1)!.question : `(${a.kind})`;
      const presumedWord = sc.checks?.presumedToken;
      row.presumed = presumedWord ? row.question.includes(presumedWord) && !CONFIRM.test(row.question) : null;
      row.quoted = quotesPrevAnswer(row.question, sc.turns.map((t) => t.answer));
    } catch (err) {
      row.error = (err as Error).message;
    }
    row.seconds = (Date.now() - started) / 1000;
    console.log(`  ${sc.id} #${run}: ${row.question.slice(0, 70)}${row.error ? ` (오류: ${row.error})` : ''}`);
    rows.push(row);
  }
}

const date = new Date().toISOString().slice(0, 10);
const lines = [`# 꼬리질문 측정 · ${date} · ${label}`, '', `- 프롬프트: identity_followup@${versions.identity_followup}, 모델 ${getSetting(null, 'ai.taskModels').identity_followup}, 사람·시나리오당 ${repeat}회`, ''];
for (const [set, setLabel] of [
  ['real-public', '실제 · 공개'],
  ['real-private', '실제 · 비공개'],
  ['generated', 'AI 생성'],
] as const) {
  const rs = rows.filter((r) => r.sc.set === set);
  lines.push(`## ${setLabel}`, '');
  if (rs.length === 0) {
    lines.push('(아직 자료 없음)', '');
    continue;
  }
  const n = rs.length;
  lines.push('| 지표 | 값 |', '|---|---|');
  lines.push(`| 1회 규칙 통과 | ${rs.filter((r) => r.firstPass).length}/${n} |`);
  lines.push(`| 평균 재작성 | ${(rs.reduce((a, r) => a + r.rewrites, 0) / n).toFixed(1)} |`);
  lines.push(`| 평균 시간 | ${(rs.reduce((a, r) => a + r.seconds, 0) / n).toFixed(1)}초 |`);
  const trap = rs.filter((r) => r.presumed !== null);
  if (trap.length) lines.push(`| 예시 답 내용을 확인 없이 전제 (자동) | ${trap.filter((r) => r.presumed).length}/${trap.length} |`);
  lines.push(`| 앞 답을 따옴표로 인용 (자동) | ${rs.filter((r) => r.quoted).length}/${n} |`, '');
  lines.push('| 시나리오 | 종류 | 회차 | 질문 | 1회 통과 | 재작성 | 걸린 규칙 | 예시 전제 | 앞 답 인용 | 시간 |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rs) {
    const q = set === 'real-private' ? '(비공개)' : r.question.replace(/\|/g, '/');
    lines.push(
      `| ${set === 'real-private' ? '비공개' : r.sc.id} | ${r.sc.kind} | ${r.run} | ${q} | ${r.firstPass ? '예' : '아니오'} | ${r.rewrites} | ${r.codes.join(', ') || '—'} | ${r.presumed === null ? '—' : r.presumed ? '**예**' : '아니오'} | ${r.quoted ? '예' : '—'} | ${r.seconds.toFixed(1)}초 |`,
    );
  }
  lines.push('');
}
const out = path.join(env.repoRoot, 'tests/results', `${date}-identity-${label}.md`);
fs.writeFileSync(out, lines.join('\n'));
console.log(`\n[꼬리질문 측정] ${path.relative(env.repoRoot, out)} 에 저장`);
