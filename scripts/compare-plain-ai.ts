// 같은 인터뷰를 「검사 없이 AI 에 그냥」 넣은 결과를 FirstFeed 의 근거 검사 코드로 잰다(중간 보고서 비교표 근거, 2026-11-04).
// 구독 사용량 듦(opus 3회). 결과 JSON 은 scripts 옆이 아니라 tests/results/2026-11-04-plain-ai-compare.json 에 쓴다.
// 걸린 값에는 질문 번호(S8 · A3) · 목록 번호처럼 지어낸 사실이 아닌 것도 섞이므로, 판정은 사람이 결과를 읽고 한다
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { formatSurvey, formatTranscript } from '../server/src/identity/followup.ts';
import type { AnswerKind } from '../server/src/identity/sources.ts';
import { buildSources } from '../server/src/identity/sources.ts';
import { findUngrounded } from '../server/src/rules/grounding.ts';
import { commonEnglishTerms } from '../server/src/config.ts';

const fx = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '../tests/fixtures/real/interviews/me.json'), 'utf8'));
const turns = (fx.turns as Array<{ question: string; answer: string; answerKind: AnswerKind }>).map((t, i) => ({ turnNo: i + 1, question: t.question, answer: t.answer, answerKind: t.answerKind }));
const ask = `아래는 인스타그램 계정을 새로 시작하려는 사람(나)의 설문 답과 인터뷰야.
이걸 보고 나한테 맞는 인스타 계정을 만들어 줘:
1. 계정 주제 3~5개
2. 프로필 소개글(바이오) 1개
3. 앞으로 올릴 게시물 제목 9개

## 설문 답
${formatSurvey(fx.survey)}

## 인터뷰
${formatTranscript(turns)}`;
const srcs = buildSources(fx.survey, turns).filter((s) => s.countsAsUserInput).map((s) => s.text);
const common = commonEnglishTerms(null);
const out: Array<{ run: number; text: string; bad: unknown[]; ms: number; model: string | undefined }> = [];
for (let i = 1; i <= 3; i++) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cmp-'));
  const env = { ...process.env }; delete env.ANTHROPIC_BASE_URL;
  const r = spawnSync('claude', ['-p', '--model', 'opus', '--tools', '', '--safe-mode', '--strict-mcp-config', '--no-session-persistence', '--output-format', 'json'], { input: ask, cwd, env, encoding: 'utf8', timeout: 300000 });
  const j = JSON.parse(r.stdout);
  const text: string = j.result;
  const bad = findUngrounded(text, { source: [], userInput: srcs }, common);
  out.push({ run: i, text, bad, ms: j.duration_ms, model: Object.keys(j.modelUsage ?? {})[0] });
  console.log(`#${i} ${Object.keys(j.modelUsage ?? {})[0]} ${(j.duration_ms / 1000).toFixed(0)}초 · 근거 없는 숫자·영문 ${bad.length}개: ${bad.map((b) => b.value).join(', ')}`);
}
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '../tests/results/2026-11-04-plain-ai-compare.json'), JSON.stringify({ ask, sources: srcs, out }, null, 1));
