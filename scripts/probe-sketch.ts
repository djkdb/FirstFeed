// 실시간 미리보기 초안 호출(안 B)의 걸리는 시간 재기 — 앱에는 아직 없다(결정 2026-10-24 · 설계서 2장).
//   node scripts/probe-sketch.ts --model=sonnet --turns=3     (구독 사용량 듦: 호출 1회)
// 공개 fixture(tests/fixtures/real/interviews/me.json)의 설문 + 인터뷰 앞 N개 답으로 prompts/identity_sketch/v1.md 를 한 번 부른다.
// 자기 평가 없이, 숫자·영문 근거 규칙만(앱에 넣을 때와 같은 조건). 결과는 저장하지 않고 화면에 시간 · 출력만 찍는다.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { AiService } from '../server/src/ai/adapter.ts';
import { generateChecked } from '../server/src/ai/loop.ts';
import { loadPrompt } from '../server/src/ai/prompts.ts';
import { ClaudeCodeProvider } from '../server/src/ai/providers/claude-code.ts';
import { commonEnglishTerms, env, getSetting, setSetting, type ModelAlias } from '../server/src/config.ts';
import { openDb } from '../server/src/db/index.ts';
import { formatSurvey, formatTranscript } from '../server/src/identity/followup.ts';
import type { SurveyAnswers } from '../server/src/identity/survey.ts';
import { findUngrounded } from '../server/src/rules/grounding.ts';
import type { Rule } from '../server/src/rules/types.ts';

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const MODELS: ModelAlias[] = ['sonnet', 'opus', 'fable', 'haiku'];
const model = arg('model', 'sonnet') as ModelAlias;
if (!MODELS.includes(model)) throw new Error(`--model 은 ${MODELS.join(' · ')} 중 하나`);
const nTurns = Number(arg('turns', '3'));

const SketchSchema = z.object({
  handles: z.array(z.object({ value: z.string().min(1).max(30), why: z.string().max(60) })).min(1).max(3),
  bio_line: z.string().min(1).max(60),
  mood: z.string().min(1).max(30),
});

const fx = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/real/interviews/me.json'), 'utf8')) as {
  survey: SurveyAnswers;
  turns: Array<{ question: string; answer: string; answerKind: 'text' }>;
};
const turns = fx.turns.slice(0, nTurns).map((t, i) => ({ turnNo: i + 1, question: t.question, answer: t.answer, answerKind: t.answerKind }));
const survey = formatSurvey(fx.survey);
const db = openDb(':memory:');
setSetting(db, 'ai.taskModels', { ...getSetting(db, 'ai.taskModels'), identity_sketch: model });
const prompt = loadPrompt(db, 'identity_sketch', { survey, transcript: formatTranscript(turns) });
const sources = { source: [], brand: [], userInput: [survey, ...turns.map((t) => t.answer)] };
const rules: Rule<z.infer<typeof SketchSchema>>[] = [
  (d) =>
    // 아이디는 늘 영문이라 근거 대조에서 뺀다(브랜딩 아이디와 같음) — 처음엔 아이디까지 걸어 영문마다 재작성됐다(devlog 2026-10-24-03)
    [d.bio_line, d.mood].flatMap((t) =>
      findUngrounded(t, sources, commonEnglishTerms(db)).map((u) => ({ level: 'error' as const, code: 'ungrounded', message: `답에 없는 ${u.kind} "${u.value}"`, where: 'sketch', from: 'rule' as const })),
    ),
  (d) =>
    d.handles
      .filter((h) => !/^(?!\.)(?!.*\.\.)[a-z0-9._]{1,30}(?<!\.)$/.test(h.value))
      .map((h) => ({ level: 'error' as const, code: 'handle_format', message: `아이디 모양이 아님 "${h.value}"`, where: 'handles', from: 'rule' as const })),
];
const ai = new AiService({ db, provider: new ClaudeCodeProvider() });
const t0 = Date.now();
const r = await generateChecked(ai, { task: 'identity_sketch', prompt: prompt.text, promptRef: prompt.ref, schema: SketchSchema, rules, selfReview: false });
const runs = db.prepare("SELECT kind, status, duration_ms FROM ai_runs WHERE task = 'identity_sketch' ORDER BY attempt").all();
console.log(JSON.stringify({ model, turns: nTurns, wallMs: Date.now() - t0, ok: r.ok, calls: r.calls, rewrites: r.rewrites, runs, out: r.ok ? r.data : r.errors.map((e) => e.message) }, null, 1));
