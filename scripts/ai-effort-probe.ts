// 노력 단계(--effort)별 응답 시간과 규칙 통과를 잰다. 같은 프롬프트를 단계만 바꿔 한 번씩(생성 1회만, 재작성·자기 평가 없음).
//   npm run ai:effort -- --fixture=seoyeon --levels=default,low,medium,high --repeat=1
// opus 호출 시간이 27~149초로 흔들리고 180초 제한에 걸린 일(devlog 2026-10-13-04)의 원인을 가르려고 만들었다.
import fs from 'node:fs';
import path from 'node:path';
import { env, type Effort } from '../server/src/config.ts';
import { openDb } from '../server/src/db/index.ts';
import { AiService } from '../server/src/ai/adapter.ts';
import { loadPrompt } from '../server/src/ai/prompts.ts';
import { ClaudeCodeProvider } from '../server/src/ai/providers/claude-code.ts';
import { buildSources, formatSourcesForPrompt, type AnswerKind } from '../server/src/identity/sources.ts';
import { ProfileSchema, profileRules } from '../server/src/identity/profile.ts';
import type { SurveyAnswers } from '../server/src/identity/survey.ts';

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const fixtureId = arg('fixture', 'seoyeon');
const levels = arg('levels', 'default,low,medium,high').split(',');
const repeat = Number(arg('repeat', '1'));

const file = ['real', 'generated', 'private']
  .map((d) => path.join(env.repoRoot, 'tests/fixtures', d, 'interviews', `${fixtureId}.json`))
  .find((f) => fs.existsSync(f));
if (!file) {
  console.error(`[노력 측정] 테스트 자료 ${fixtureId} 를 찾지 못했습니다. tests/fixtures/*/interviews 를 확인하세요.`);
  process.exit(1);
}
const fx = JSON.parse(fs.readFileSync(file, 'utf8')) as { survey: SurveyAnswers; turns: Array<{ question: string; answer: string; answerKind: AnswerKind }> };
const sources = buildSources(
  fx.survey,
  fx.turns.map((t, i) => ({ turnNo: i + 1, question: t.question, answer: t.answer, answerKind: t.answerKind })),
);
const prompt = loadPrompt(null, 'identity_profile', { sources: formatSourcesForPrompt(sources) });
const ctx = { sources, overlapThreshold: 0.5, minQuoteChars: 4 };

const rows: string[] = [];
for (const level of levels) {
  for (let i = 1; i <= repeat; i++) {
    const db = openDb(':memory:');
    const ai = new AiService({ db, provider: new ClaudeCodeProvider() });
    const started = Date.now();
    try {
      const r = await ai.call({
        task: 'identity_profile',
        prompt: prompt.text,
        schema: ProfileSchema,
        timeoutMs: 600_000,
        ...(level === 'default' ? {} : { effort: level as Effort }),
      });
      const errors = profileRules(ctx)
        .flatMap((rule) => rule(r.data))
        .filter((x) => x.level === 'error');
      rows.push(`| ${level} | ${i} | ${((Date.now() - started) / 1000).toFixed(0)}초 | ${r.data.pillars.length} | ${errors.length === 0 ? '통과' : errors.map((e) => e.code).join(', ')} |`);
    } catch (err) {
      rows.push(`| ${level} | ${i} | ${((Date.now() - started) / 1000).toFixed(0)}초 | — | 실패: ${(err as Error).message.slice(0, 50)} |`);
    }
    console.log(rows.at(-1));
  }
}
console.log(`\n### identity_profile@${prompt.ref.version} · ${fixtureId} · opus · 단계별 1회 생성`);
console.log('| effort | 회차 | 시간 | 축 | 코드 규칙 |\n|---|---|---|---|---|');
for (const r of rows) console.log(r);
