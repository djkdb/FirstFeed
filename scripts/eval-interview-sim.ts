// 인터뷰 다양화 측정(2026-11-08): 꼬리질문 판(v2 · v3)마다 같은 사람을 처음부터 N턴 인터뷰한다.
// 답은 **가상 응답자(sonnet, prompts/eval_persona_answer)가 만든 AI 생성 답** — 고정 세트 사람의 설문 · 고정 질문 답을 바탕으로.
// 그래서 이 측정은 「질문이 얼마나 다양한가 · 개성을 묻는가」만 본다(근거 품질은 보지 않는다).
//   npm run eval:interview -- --turns=6 --label=v2-v3 [--profile | --until-profile] [--only=minji] [--versions=v2:v2,v3:v3] [--cloud-session]
// 결과: tests/results/<날짜>-interview-sim-<label>.md · .json
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { env, getSetting, setSetting } from '../server/src/config.ts';
import { openDb } from '../server/src/db/index.ts';
import { AiService } from '../server/src/ai/adapter.ts';
import { loadPrompt } from '../server/src/ai/prompts.ts';
import { ClaudeCodeProvider, isSubscriptionAuth, type AuthStatus } from '../server/src/ai/providers/claude-code.ts';
import { answerTurn, askNext, makeProfile } from '../server/src/identity/flow.ts';
import { FORMAT_LABEL, LENS_LABEL } from '../server/src/identity/followup.ts';
import { formatSurvey } from '../server/src/identity/followup.ts';
import { createSession, getSessionState, listTurns, type Turn } from '../server/src/identity/store.ts';
import type { SurveyAnswers } from '../server/src/identity/survey.ts';
import { similarity } from '../server/src/rules/similarity.ts';

const args = process.argv.slice(2);
const arg = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const turnsN = Number(arg('turns') ?? 6);
const label = arg('label') ?? 'run';
const only = arg('only');
const withProfile = args.includes('--profile') || args.includes('--until-profile');
/** 앱처럼: 프로필이 「근거 있는 축 3개 미만」이면 질문 2개를 더 하고 다시 만든다 — 최대 질문 수까지 */
const untilProfile = args.includes('--until-profile');
const cloud = args.includes('--cloud-session');
if (cloud && process.env.CLAUDE_CODE_REMOTE !== 'true') throw new Error('--cloud-session 은 Claude Code 원격 세션 컨테이너(CLAUDE_CODE_REMOTE=true)에서만 씁니다');
const acceptAuth = cloud ? (a: AuthStatus, e: NodeJS.ProcessEnv) => isSubscriptionAuth(a, e) || (a.loggedIn === true && a.apiProvider === 'firstParty' && a.authMethod === 'oauth_token') : undefined;
const provider = () => new ClaudeCodeProvider(acceptAuth ? { acceptAuth } : {});

// --versions=v2:v2,v3:v3 (꼬리질문:프로필). 기본은 v2 와 v3
const VERSIONS: Array<{ followup: string; profile: string }> = (arg('versions') ?? 'v2:v2,v3:v3').split(',').map((x) => {
  const [followup, profile] = x.split(':');
  if (!/^v\d+$/.test(followup ?? '') || !/^v\d+$/.test(profile ?? '')) throw new Error(`--versions 의 「${x}」는 「v3:v3」(꼬리질문:프로필) 모양이어야 합니다`);
  return { followup: followup!, profile: profile! };
});
interface Persona {
  id: string;
  set: string;
  survey: SurveyAnswers;
  turns: Array<{ question: string; answer: string }>;
}
const PERSONAS = [
  ['real/interviews/me.json', '실제·공개 바탕'],
  ['generated/interviews/doyun.json', 'AI 생성'],
  ['generated/interviews/seoyeon.json', 'AI 생성'],
  ['generated/interviews/minji.json', 'AI 생성'],
]
  .map(([f, kind]) => ({ ...(JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures', f!), 'utf8')) as Persona), kind: kind! }))
  .filter((p) => !only || only.split(',').includes(p.id));

const PersonaAnswer = z.object({ unknown: z.boolean(), pick: z.string().max(60), scale: z.number().int().min(0).max(5), answer: z.string().max(300) });

function describeQuestion(t: Turn): string {
  const lines = [`질문: ${t.question}`, `답하는 방식: ${t.format}`];
  if (t.format === 'this_or_that') lines.push(`두 선택지: 「${t.options[0]}」 / 「${t.options[1]}」`);
  if (t.format === 'rewrite') lines.push(`고쳐 쓸 예시 문장: ${t.sample}`);
  if (t.format === 'scale' && t.scale) lines.push(`척도: 1 = ${t.scale.left} … 5 = ${t.scale.right}`);
  if (t.format === 'open' && t.options.length) lines.push(`고를 수 있는 선택지: ${t.options.join(' / ')}`);
  return lines.join('\n');
}

interface Row {
  /** 꼬리질문 재작성 사유(규칙 코드) */
  reasons: string[];
  /** 프로필을 만든 횟수(--until-profile 이면 저장될 때까지) */
  attempts: number;
  /** needs_more 때 부족하다고 한 것 */
  missing: string[];
  persona: string;
  kind: string;
  version: string;
  questions: Array<{ no: number; lens: string | null; format: string; question: string; why: string | null; extra: string; answer: string | null; answerKind: string | null }>;
  followupFailed: number;
  rewrites: number;
  seconds: number;
  maxSimilarity: number;
  distinctLenses: number | null;
  formats: string[];
  profile: { outcome: string; voiceRules: string[]; pillars: string[]; accountLine: string | null } | null;
}
const rows: Row[] = [];

for (const p of PERSONAS) {
  const persona = [formatSurvey(p.survey), '', '예전에 한 말:', ...p.turns.map((t) => `- (${t.question}) ${t.answer}`)].join('\n');
  for (const v of VERSIONS) {
    const db = openDb(':memory:');
    setSetting(db, 'prompts.activeVersions', { ...getSetting(null, 'prompts.activeVersions'), identity_followup: v.followup, identity_profile: v.profile });
    const ai = new AiService({ db, provider: provider() });
    const sid = createSession(db, 1, p.survey);
    const t0 = Date.now();
    let failed = 0;
    const askOne = async (): Promise<boolean> => {
      const r = await askNext(ai, sid);
      if (r.kind !== 'asked') {
        failed++;
        console.log(`  ${p.id} ${v.followup}: 질문 실패 ${r.kind === 'failed' ? r.errors.map((e) => e.code).join(',') : r.kind}`);
        return false;
      }
      const t = listTurns(db, sid).at(-1)!;
      const pr = loadPrompt(db, 'eval_persona_answer', { persona, question: describeQuestion(t) });
      const a = (await ai.call({ task: 'eval_persona', prompt: pr.text, promptRef: pr.ref, schema: PersonaAnswer })).data;
      const pick = t.format === 'this_or_that' ? (t.options.find((o) => o === a.pick) ?? t.options[0]!) : null;
      const scale = t.format === 'scale' ? Math.min(5, Math.max(1, a.scale || 3)) : null;
      try {
        answerTurn(ai, sid, t.turnNo, a.answer, a.unknown && t.format === 'open', pick, scale);
      } catch (e) {
        answerTurn(ai, sid, t.turnNo, a.answer || '잘 모르겠어요', true);
        console.log(`  ${p.id} ${v.followup}: 답 저장 실패 → 모름으로 (${(e as Error).message})`);
      }
      console.log(`  ${p.id} ${v.followup} A${t.turnNo} [${t.lens ?? '-'}/${t.format}] ${t.question}`);
      return true;
    };
    for (let i = 0; i < turnsN; i++) if (!(await askOne())) break;
    const turns = listTurns(db, sid);
    const rewrites = (db.prepare("SELECT COUNT(*) AS n FROM ai_runs WHERE task = 'identity_followup' AND kind = 'rewrite'").get() as { n: number }).n;
    // 재작성 사유(규칙 코드) — 판끼리 무엇 때문에 다시 썼는지 비교하려고
    const reasons = (db.prepare("SELECT issues_json FROM ai_runs WHERE task = 'identity_followup' AND issues_json IS NOT NULL").all() as Array<{ issues_json: string }>).flatMap((r) => {
      try {
        return (JSON.parse(r.issues_json) as Array<{ level: string; code: string }>).filter((i) => i.level === 'error').map((i) => i.code);
      } catch {
        return [];
      }
    });
    let maxSim = 0;
    for (let i = 0; i < turns.length; i++) for (let j = i + 1; j < turns.length; j++) maxSim = Math.max(maxSim, similarity(turns[i]!.question, turns[j]!.question));
    let profile: Row['profile'] = null;
    let attempts = 0;
    const missing: string[] = [];
    if (withProfile) {
      const max = getSetting(db, 'identity.maxTurns');
      for (;;) {
        attempts++;
        try {
          const pr = await makeProfile(ai, sid);
          const st = getSessionState(db, sid);
          if (pr.outcome === 'needs_more') missing.push(`${listTurns(db, sid).length}턴 뒤: ${st?.note?.missing.join(' / ') ?? ''}`);
          profile = { outcome: pr.outcome, voiceRules: st?.profile?.voiceRules.map((x) => x.text) ?? [], pillars: st?.profile?.pillars.map((x) => `${x.name} — ${x.description}`) ?? [], accountLine: st?.profile?.accountLine ?? null };
          if (!untilProfile || pr.outcome !== 'needs_more' || listTurns(db, sid).length >= max) break;
          // 앱처럼 인터뷰로 돌아가 더 묻는다(2개씩 — 한 개씩이면 프로필 opus 호출이 질문마다 붙는다)
          for (let k = 0; k < 2 && listTurns(db, sid).length < max; k++) if (!(await askOne())) break;
        } catch (e) {
          profile = { outcome: `오류: ${(e as Error).message}`, voiceRules: [], pillars: [], accountLine: null };
          break;
        }
      }
    }
    const finalTurns = listTurns(db, sid);
    rows.push({
      reasons,
      attempts,
      missing,
      persona: p.id,
      kind: p.kind,
      version: v.followup,
      questions: finalTurns.map((t) => ({
        no: t.turnNo,
        lens: t.lens,
        format: t.format,
        question: t.question,
        why: t.why,
        extra: t.format === 'this_or_that' ? `「${t.options.join('」 / 「')}」 → ${t.pick}` : t.format === 'rewrite' ? `예시 문장: ${t.sample}` : t.format === 'scale' && t.scale ? `${t.scale.left} ↔ ${t.scale.right} → ${t.pick}` : '',
        answer: t.answer,
        answerKind: t.answerKind,
      })),
      followupFailed: failed,
      rewrites,
      seconds: Math.round((Date.now() - t0) / 1000),
      maxSimilarity: Number(maxSim.toFixed(2)),
      distinctLenses: turns.some((t) => t.lens) ? new Set(turns.map((t) => t.lens).filter(Boolean)).size : null,
      formats: [...new Set(turns.map((t) => t.format))],
      profile,
    });
    console.log(`${p.id} ${v.followup}: 질문 ${turns.length} · 재작성 ${rewrites} · 각도 ${rows.at(-1)!.distinctLenses ?? '모름'} · 방식 ${rows.at(-1)!.formats.join(',')} · ${rows.at(-1)!.seconds}초${profile ? ` · 프로필 ${profile.outcome}` : ''}`);
  }
}

const date = new Date().toLocaleDateString('sv-SE');
const md: string[] = [
  `# 인터뷰 시뮬레이션 — ${label} (${date})`,
  '',
  `- 판: ${VERSIONS.map((v) => `꼬리질문 ${v.followup} + 프로필 ${v.profile}`).join(' / ')} · 처음부터 ${turnsN}턴(고정 질문 없이)`,
  '- 답: **가상 응답자(sonnet, prompts/eval_persona_answer/v1)가 만든 AI 생성 답** — 고정 세트 사람의 설문 · 고정 질문 답을 바탕으로. 근거 품질이 아니라 질문의 다양성 · 개성을 끌어내는지만 본다',
  '- 사람: me(실제·공개 자료를 바탕으로 한 시뮬레이션) · doyun · seoyeon · minji(AI 생성 페르소나). 실제·비공개 자료는 쓰지 않음',
  `- 규칙 기준: identity.variety ${JSON.stringify(getSetting(null, 'identity.variety'))}`,
  '',
  '| 사람 | 판 | 질문 | 질문 실패 | 재작성(사유) | 서로 다른 각도 | 방식 | 질문끼리 최대 유사도 | 시간 | 프로필(만든 횟수) |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.persona}(${r.kind}) | ${r.version} | ${r.questions.length} | ${r.followupFailed} | ${r.rewrites}${r.reasons.length ? `(${r.reasons.join(', ')})` : ''} | ${r.distinctLenses ?? '모름(v2 는 각도 없음)'} | ${r.formats.map((f) => FORMAT_LABEL[f as keyof typeof FORMAT_LABEL]).join(' · ')} | ${r.maxSimilarity} | ${r.seconds}초 | ${r.profile?.outcome ?? '안 만듦'}${r.attempts ? `(${r.attempts})` : ''} |`),
  '',
];
for (const r of rows) {
  md.push(`## ${r.persona} · ${r.version}`, '');
  for (const q of r.questions) {
    md.push(`${q.no}. ${q.lens ? `[${LENS_LABEL[q.lens as keyof typeof LENS_LABEL]} · ${FORMAT_LABEL[q.format as keyof typeof FORMAT_LABEL]}] ` : ''}${q.question}${q.why ? `  \n   왜: ${q.why}` : ''}${q.extra ? `  \n   ${q.extra}` : ''}  \n   → (가상 답${q.answerKind && q.answerKind !== 'text' ? ` · ${q.answerKind}` : ''}) ${q.answer ?? ''}`);
  }
  if (r.missing.length) md.push('', ...r.missing.map((m) => `- 근거 부족(${m})`));
  if (r.profile) {
    md.push('', `- 계정 한 줄: ${r.profile.accountLine ?? '-'}`, `- 축: ${r.profile.pillars.join(' / ') || '-'}`, `- 말투 규칙: ${r.profile.voiceRules.join(' / ') || '-'}`);
  }
  md.push('');
}
md.push('사람이 읽은 판정은 devlog 에 적는다.');
fs.writeFileSync(path.join(env.repoRoot, 'tests/results', `${date}-interview-sim-${label}.md`), md.join('\n') + '\n');
fs.writeFileSync(path.join(env.repoRoot, 'tests/results', `${date}-interview-sim-${label}.json`), JSON.stringify(rows, null, 1) + '\n');
console.log(`결과: tests/results/${date}-interview-sim-${label}.md`);
