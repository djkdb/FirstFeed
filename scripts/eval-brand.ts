// 브랜딩 키트 측정 (FR-BR-1~4). 프로필은 고정 스냅숏을 쓴다 — 매번 프로필부터 만들면 프로필 쪽 변동·시간 초과가 섞여서
// (실제로 다른 방향 측정에서 프로필 단계 시간 초과 3번).
//   npm run eval:brand -- --snapshot            # 스냅숏이 없는 사람만 프로필을 만들어 저장 (tests/fixtures/<세트>/profiles/<id>.json)
//   npm run eval:brand -- [--only=me] [--runs=2] [--label=brand-v1] [--prompt brand_visual=v2 --prompt brand_words_review=v2]
//   npm run eval:brand -- --reflect=me          # FR-ID-6: 말투 규칙 하나(존댓말→반말)·축 하나를 바꾸기 전/후 바이오 비교
// 결과에는 숫자와 함께 후보 본문을 쓴다 — 바이오가 계정 정의·축을 담는지는 사람이 읽고 판정 (devlog 에 적는다). 비공개 세트는 숫자만.
import fs from 'node:fs';
import path from 'node:path';
import { env, getSetting, setSetting } from '../server/src/config.ts';
import { openDb, type Db } from '../server/src/db/index.ts';
import { AiService } from '../server/src/ai/adapter.ts';
import { ClaudeCodeProvider } from '../server/src/ai/providers/claude-code.ts';
import { makeProfile } from '../server/src/identity/flow.ts';
import { text, type ProfileContent } from '../server/src/identity/model.ts';
import { addAnsweredTurn, createSession, getProfile, saveProfileVersion } from '../server/src/identity/store.ts';
import type { AnswerKind } from '../server/src/identity/sources.ts';
import type { SurveyAnswers } from '../server/src/identity/survey.ts';
import { generateVisual, type VisualResult } from '../server/src/brand/visual.ts';
import { generateWords, type WordsResult } from '../server/src/brand/words.ts';
import { instagramLength } from '../server/src/brand/limits.ts';
import { fontById } from '../server/src/brand/fonts.ts';
import { startStopwatch } from '../server/src/lib/sleep-clock.ts';

interface Fixture {
  id: string;
  set: 'real-public' | 'real-private' | 'generated';
  dir: string;
  survey: SurveyAnswers;
  turns: Array<{ question: string; answer: string; answerKind: AnswerKind }>;
}
const SETS: Array<[Fixture['set'], string, string]> = [
  ['real-public', 'tests/fixtures/real', '실제 · 공개'],
  ['real-private', 'tests/fixtures/private', '실제 · 비공개'],
  ['generated', 'tests/fixtures/generated', 'AI 생성'],
];
const args = process.argv.slice(2);
const arg = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const only = arg('only');
const runs = Number(arg('runs') ?? 2);
const promptVersions: Record<string, string> = Object.fromEntries(
  args.flatMap((a, i) => (a === '--prompt' && args[i + 1]?.includes('=') ? [args[i + 1]!.split('=') as [string, string]] : [])),
);
const versions: Record<string, string> = { brand_words: 'v1', brand_visual: 'v1', brand_words_review: 'v1', ...getSetting(null, 'prompts.activeVersions'), ...promptVersions };
const label = arg('label') ?? `brand-visual${versions.brand_visual}-review${versions.brand_words_review}`;
const date = new Date().toISOString().slice(0, 10);

function load(): Fixture[] {
  const out: Fixture[] = [];
  for (const [set, dir] of SETS) {
    const abs = path.join(env.repoRoot, dir, 'interviews');
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
      const fx = JSON.parse(fs.readFileSync(path.join(abs, f), 'utf8')) as Fixture;
      if (!only || fx.id === only) out.push({ ...fx, set, dir });
    }
  }
  return out;
}

const snapshotPath = (fx: Fixture) => path.join(env.repoRoot, fx.dir, 'profiles', `${fx.id}.json`);

/** 고정 세트의 인터뷰를 넣은 새 DB. 스냅숏이 있으면 그 프로필을 활성 판으로 */
function seed(fx: Fixture, content?: ProfileContent): { db: Db; ai: AiService; sid: number } {
  const db = openDb(':memory:');
  const ai = new AiService({ db, provider: new ClaudeCodeProvider() });
  if (Object.keys(promptVersions).length) setSetting(db, 'prompts.activeVersions', promptVersions);
  const sid = createSession(db, 1, fx.survey);
  for (const t of fx.turns) addAnsweredTurn(db, sid, t.question, t.answer, t.answerKind);
  if (content) saveProfileVersion(db, 1, content, { reason: 'interview', sessionId: sid, basedOn: null, jobId: null, activate: true });
  return { db, ai, sid };
}

function readSnapshot(fx: Fixture): ProfileContent | null {
  const p = snapshotPath(fx);
  if (!fs.existsSync(p)) return null;
  const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as { profile: ProfileContent };
  return raw.profile;
}

async function snapshot() {
  for (const fx of load()) {
    if (readSnapshot(fx)) {
      console.log(`[스냅숏] ${fx.set}/${fx.id} 이미 있음 — 건너뜀`);
      continue;
    }
    console.log(`[스냅숏] ${fx.set}/${fx.id} 프로필 만드는 중 …`);
    const { db, ai, sid } = seed(fx);
    let profileId: number | null = null;
    for (let i = 0; i < 2 && profileId === null; i++) {
      try {
        profileId = (await makeProfile(ai, sid)).profileId;
      } catch (err) {
        console.log(`  → 오류: ${(err as Error).message}`);
      }
    }
    if (profileId === null) {
      console.log('  → 2번 모두 실패 — 건너뜀');
      continue;
    }
    const p = getProfile(db, profileId)!;
    const content: ProfileContent = {
      accountLine: p.accountLine,
      accountLineOrigin: p.accountLineOrigin,
      audience: p.audience,
      audienceOrigin: p.audienceOrigin,
      pillars: p.pillars,
      dropped: p.dropped,
      voiceRules: p.voiceRules,
      avoid: p.avoid,
      unknown: p.unknown,
      presence: p.presence,
    };
    fs.mkdirSync(path.dirname(snapshotPath(fx)), { recursive: true });
    const note = `AI(identity_profile@${versions.identity_profile})가 이 사람의 인터뷰(../interviews/${fx.id}.json)로 만든 프로필 스냅숏 · ${date}. 브랜딩 측정의 입력을 고정하려고 저장 (scripts/eval-brand.ts)`;
    fs.writeFileSync(snapshotPath(fx), JSON.stringify({ note, profile: content }, null, 2) + '\n');
    console.log(`  → ${path.relative(env.repoRoot, snapshotPath(fx))} 저장 · 축 ${content.pillars.map((x) => x.name).join(', ')}`);
  }
}

interface Run {
  words: WordsResult | null;
  visual: VisualResult | null;
  wordsSec: number;
  visualSec: number;
  /** 이 회차에 컴퓨터 잠자기가 낀 시간(초) — 시간 지표를 믿을 수 없는 회차 표시 */
  sleptSec: number;
  /** brand_visual 생성 회차(재작성 전 포함)에서 걸린 실사 인물·나이 규칙 수 */
  realPersonHits: number;
  /** brand_words 자기 평가가 「하지 않은 약속」으로 올린 fact */
  promiseFacts: string[];
  /** brand_words 자기 평가의 fact·broken 전체 */
  reviewFlags: string[];
  wordsError?: string;
  visualError?: string;
}

type IssueRow = { code: string; where?: string; message: string };
const issuesOf = (db: Db, sql: string): IssueRow[] =>
  (db.prepare(sql).all() as Array<{ issues_json: string | null }>).flatMap((r) => (r.issues_json ? (JSON.parse(r.issues_json) as IssueRow[]) : []));

/** 폰트 짝 3안의 다양성: 제목 폰트 느낌(sans·serif·display) 수, 서로 다른 폰트 수, 같은 폰트 짝 수 */
function fontVariety(pairs: Array<{ title: string; body: string }>) {
  const styles = new Set(pairs.map((p) => fontById(p.title)?.style ?? '?'));
  const families = new Set(pairs.flatMap((p) => [p.title, p.body]));
  return { titleStyles: styles.size, families: families.size, samePairs: pairs.filter((p) => p.title === p.body).length };
}

const codesOf = (dropped: Array<{ reasons: string[] }>) => dropped.flatMap((d) => d.reasons.map((r) => /^\[([a-z_]+)\]/.exec(r)?.[1] ?? '?'));
const count = (codes: string[], ...want: string[]) => codes.filter((c) => want.includes(c)).length;

async function measure() {
  const rows: Array<{ fx: Fixture; profile: ProfileContent; runs: Run[] }> = [];
  for (const fx of load()) {
    const profile = readSnapshot(fx);
    if (!profile) {
      console.log(`[브랜딩 측정] ${fx.set}/${fx.id} 스냅숏 없음 — 먼저 --snapshot`);
      continue;
    }
    const rs: Run[] = [];
    for (let n = 0; n < runs; n++) {
      console.log(`[브랜딩 측정] ${fx.set}/${fx.id} ${n + 1}/${runs} …`);
      const { ai, db } = seed(fx, profile);
      const sw = startStopwatch();
      const run: Run = { words: null, visual: null, wordsSec: 0, visualSec: 0, sleptSec: 0, realPersonHits: 0, promiseFacts: [], reviewFlags: [] };
      let t = Date.now();
      try {
        run.words = await generateWords(ai, 1);
      } catch (err) {
        run.wordsError = (err as Error).message;
      }
      run.wordsSec = (Date.now() - t) / 1000;
      t = Date.now();
      try {
        run.visual = await generateVisual(ai, 1);
      } catch (err) {
        run.visualError = (err as Error).message;
      }
      run.visualSec = (Date.now() - t) / 1000;
      run.sleptSec = Math.round(sw.sleptMs() / 1000);
      run.realPersonHits = issuesOf(db, "SELECT issues_json FROM ai_runs WHERE task = 'brand_visual'").filter((i) =>
        ['prompt_realistic_person', 'prompt_age_appearance'].includes(i.code),
      ).length;
      const review = issuesOf(db, "SELECT issues_json FROM ai_runs WHERE task = 'self_review'").filter((i) => ['review_fact', 'review_broken'].includes(i.code));
      run.reviewFlags = review.map((i) => `[${i.code}] ${i.where ?? ''} ${i.message}`);
      run.promiseFacts = review.filter((i) => i.code === 'review_fact' && /약속|다짐|하겠|밝히/.test(i.message)).map((i) => `${i.where ?? ''} ${i.message}`);
      const w = run.words;
      const v = run.visual;
      console.log(
        `  → ${run.sleptSec ? `[잠자기 ${run.sleptSec}초 포함] ` : ''}글 ${w ? `호출 ${w.calls}·재작성 ${w.rewrites}·바이오 ${w.candidates.bios.length}` : `오류 ${run.wordsError}`} ${run.wordsSec.toFixed(0)}초 / 시각 ${v ? `호출 ${v.calls}·재작성 ${v.rewrites}·팔레트 ${v.candidates.palettes.length}` : `오류 ${run.visualError}`} ${run.visualSec.toFixed(0)}초`,
      );
      rs.push(run);
    }
    rows.push({ fx, profile, runs: rs });
  }

  const lines = [
    `# 브랜딩 키트 측정 · ${date} · ${label}`,
    '',
    `- 프롬프트: ${Object.entries(versions).map(([k, v]) => `${k}@${v}`).join(', ')}, 모델 brand_words ${getSetting(null, 'ai.taskModels').brand_words} · brand_visual ${getSetting(null, 'ai.taskModels').brand_visual}, 사람당 ${runs}회`,
    '- 입력 프로필: tests/fixtures/<세트>/profiles/<id>.json 스냅숏 (매번 같은 프로필)',
    '- 「빠진 후보」는 규칙에 걸려 빼고 남은 후보만 보인 것 — 실패가 아니라 넉넉히 받아 거른 수',
    '',
  ];
  for (const [set, , setLabel] of SETS) {
    const rs = rows.filter((r) => r.fx.set === set);
    lines.push(`## ${setLabel} (${rs.length}명 × ${runs}회)`, '');
    if (rs.length === 0) {
      lines.push('(아직 자료 없음)', '');
      continue;
    }
    const all = rs.flatMap((r) => r.runs);
    const ws = all.filter((r) => r.words).map((r) => r.words!);
    const vs = all.filter((r) => r.visual).map((r) => r.visual!);
    const wCodes = ws.flatMap((w) => codesOf(w.dropped));
    const vCodes = vs.flatMap((v) => codesOf(v.dropped));
    const avg = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '—');
    lines.push('| 지표 | 글 (brand_words) | 시각 (brand_visual) |', '|---|---|---|');
    lines.push(`| 끝까지 완료 | ${ws.length}/${all.length} | ${vs.length}/${all.length} |`);
    lines.push(`| 1회 통과 (재작성 0) | ${ws.filter((w) => w.rewrites === 0).length}/${all.length} | ${vs.filter((v) => v.rewrites === 0).length}/${all.length} |`);
    lines.push(`| 평균 호출 · 재작성 | ${avg(ws.map((w) => w.calls))} · ${avg(ws.map((w) => w.rewrites))} | ${avg(vs.map((v) => v.calls))} · ${avg(vs.map((v) => v.rewrites))} |`);
    lines.push(`| 평균 시간 | ${avg(all.map((r) => r.wordsSec))}초 | ${avg(all.map((r) => r.visualSec))}초 |`);
    lines.push(`| 목록마다 다 채움 (5개 / 3개) | ${ws.filter((w) => w.candidates.handles.length >= 5 && w.candidates.displayNames.length >= 5 && w.candidates.bios.length >= 5).length}/${ws.length} | ${vs.filter((v) => v.candidates.palettes.length >= 3 && v.candidates.fontPairs.length >= 3).length}/${vs.length} |`);
    lines.push(`| 빠진 후보 — 바이오 길이 초과 | ${count(wCodes, 'too_long')} | — |`);
    lines.push(`| 빠진 후보 — 주소·없는 @아이디 | ${count(wCodes, 'url_in_bio', 'mention_not_in_source')} | — |`);
    lines.push(`| 빠진 후보 — 원문 밖 숫자·영문 | ${count(wCodes, 'number_not_in_source', 'english_not_in_source')} | — |`);
    lines.push(`| 빠진 후보 — 아이디 규칙·중복 | ${count(wCodes, 'handle_rule', 'duplicate_candidate')} | ${count(vCodes, 'duplicate_candidate')} |`);
    lines.push(`| 빠진 후보 — 명암비 미달 | — | ${count(vCodes, 'low_contrast', 'low_contrast_on_primary')} |`);
    lines.push(`| 빠진 후보 — 목록 밖 폰트·쓰임 | — | ${count(vCodes, 'font_not_in_list', 'font_role')} |`);
    lines.push(`| 빠진 후보 — 그림 프롬프트 위반 | — | ${count(vCodes, 'prompt_not_english', 'prompt_missing_no_text', 'prompt_missing_size', 'bad_filename')} |`);
    const fv = vs.map((v) => fontVariety(v.candidates.fontPairs));
    lines.push(`| 실사 인물·나이 프로필 프롬프트 (재작성 전 포함) | — | ${all.reduce((n, r) => n + r.realPersonHits, 0)} |`);
    lines.push(`| 폰트 3안 — 제목 느낌 수 평균 (최대 3) | — | ${avg(fv.map((f) => f.titleStyles))} |`);
    lines.push(`| 폰트 3안 — 서로 다른 폰트 수 평균 (최대 6) | — | ${avg(fv.map((f) => f.families))} |`);
    lines.push(`| 폰트 3안 — 같은 폰트 짝 (전체) | — | ${fv.reduce((n, f) => n + f.samePairs, 0)} |`);
    lines.push(`| 자기 평가가 잡은 「하지 않은 약속」 fact | ${all.reduce((n, r) => n + r.promiseFacts.length, 0)} | — |`);
    lines.push(`| 자기 평가 fact·broken 전체 | ${all.reduce((n, r) => n + r.reviewFlags.length, 0)} | — |`);
    lines.push(`| 잠자기가 낀 회차 | ${all.filter((r) => r.sleptSec > 0).length}/${all.length} | |`);
    lines.push('');
    if (all.some((r) => r.wordsError || r.visualError)) {
      lines.push('오류:', ...all.flatMap((r) => [r.wordsError && `- 글: ${r.wordsError}`, r.visualError && `- 시각: ${r.visualError}`].filter(Boolean) as string[]), '');
    }
    if (set === 'real-private') continue;
    for (const r of rs) {
      lines.push(`### ${r.fx.id}`, '', `프로필 — ${r.profile.accountLine} · 축: ${r.profile.pillars.map((p) => p.name).join(' / ')} · 말투: ${r.profile.voiceRules.map((v) => v.text).join(' / ')} · 보여 주는 방식: ${r.profile.presence?.text ?? '(없음)'}`, '');
      r.runs.forEach((run, n) => {
        lines.push(`#### ${n + 1}회${run.sleptSec ? ` (잠자기 ${run.sleptSec}초 포함 — 시간 지표 제외 대상)` : ''}`, '');
        if (run.reviewFlags.length) lines.push('- 자기 평가 fact·broken:', ...run.reviewFlags.map((x) => `  - ${x}`));
        const w = run.words;
        if (w) {
          lines.push(`- 아이디: ${w.candidates.handles.map((c) => `\`${c.value}\``).join(' · ')}`);
          lines.push(`- 표시 이름: ${w.candidates.displayNames.map((c) => c.value).join(' · ')}`);
          lines.push('- 바이오:', ...w.candidates.bios.map((c) => `  - ${c.value.replace(/\n/g, ' ⏎ ')} (${instagramLength(c.value)}자)`));
          if (w.dropped.length) lines.push('- 빠진 글 후보:', ...w.dropped.map((d) => `  - ${d.kind} "${d.value}" — ${d.reasons.join(' / ')}`));
        }
        const v = run.visual;
        if (v) {
          lines.push(
            '- 팔레트:',
            ...v.candidates.palettes.map(
              (p) => `  - ${p.name}: ${Object.entries(p.colors).map(([k, c]) => `${k} ${c}`).join(', ')} · 글자/배경 ${p.contrast.textOnBackground.toFixed(2)} · 주색 위 ${p.contrast.bestOnPrimary.toFixed(2)}`,
            ),
          );
          lines.push(`- 폰트 짝: ${v.candidates.fontPairs.map((f) => `${f.title}+${f.body}`).join(' · ')}`);
          lines.push('- 그림 프롬프트:', ...v.candidates.imagePrompts.map((p) => `  - [${p.target}${p.label ? ` · ${p.label}` : ''}] ${p.prompt}`));
          if (v.dropped.length) lines.push('- 빠진 시각 후보:', ...v.dropped.map((d) => `  - ${d.kind} "${d.value}" — ${d.reasons.join(' / ')}`));
        }
        lines.push('');
      });
    }
  }
  const out = path.join(env.repoRoot, 'tests/results', `${date}-${label}.md`);
  fs.writeFileSync(out, lines.join('\n'));
  console.log(`\n[브랜딩 측정] ${path.relative(env.repoRoot, out)} 에 저장`);
}

/** FR-ID-6 실제 반영: 말투 규칙 하나를 반말로, 축 하나를 바꾼 판으로 글 후보를 다시 만들어 전/후를 나란히 */
async function reflect(id: string) {
  const fx = load().find((f) => f.id === id);
  const before = fx && readSnapshot(fx);
  if (!fx || !before) throw new Error(`${id} 의 스냅숏이 없습니다. 먼저 --snapshot`);
  const banmal = text('반말로 쓴다 (~해, ~야). 존댓말을 쓰지 않는다', 'edit');
  const last = before.pillars.at(-1)!;
  const changedPillar = { ...last, name: '실패 기록', description: '써 보다가 안 된 것과 그 이유를 솔직하게 남긴다', edited: ['name', 'description'] as Array<'name' | 'description'> };
  const after: ProfileContent = {
    ...before,
    voiceRules: [banmal, ...before.voiceRules.filter((v) => !/존댓말|해요|합니다/.test(v.text))],
    pillars: [...before.pillars.slice(0, -1), changedPillar],
  };
  const lines = [`# FR-ID-6 실제 반영 · ${date} · ${id}`, '', `- 바꾼 것: 말투 규칙 → 「${banmal.text}」 (존댓말 규칙이 있으면 뺌 — 없으면 더하기만 한 것), 축 「${last.name}」 → 「${changedPillar.name}: ${changedPillar.description}」`, `- 프롬프트: brand_words@${versions.brand_words}, 각 1회`, ''];
  for (const [title, content] of [
    ['바꾸기 전', before],
    ['바꾼 뒤', after],
  ] as const) {
    console.log(`[반영 측정] ${id} ${title} …`);
    const { ai } = seed(fx, content);
    const t = Date.now();
    const w = await generateWords(ai, 1);
    lines.push(`## ${title} (${((Date.now() - t) / 1000).toFixed(0)}초 · 호출 ${w.calls} · 재작성 ${w.rewrites})`, '', `말투: ${content.voiceRules.map((v) => v.text).join(' / ')}`, `축: ${content.pillars.map((p) => p.name).join(' / ')}`, '');
    lines.push('바이오:', ...w.candidates.bios.map((c) => `- ${c.value.replace(/\n/g, ' ⏎ ')}`), '', `표시 이름: ${w.candidates.displayNames.map((c) => c.value).join(' · ')}`, '');
  }
  const out = path.join(env.repoRoot, 'tests/results', `${date}-brand-reflect-${id}.md`);
  fs.writeFileSync(out, lines.join('\n'));
  console.log(`[반영 측정] ${path.relative(env.repoRoot, out)} 에 저장`);
}

if (args.includes('--snapshot')) await snapshot();
else if (arg('reflect')) await reflect(arg('reflect')!);
else await measure();
