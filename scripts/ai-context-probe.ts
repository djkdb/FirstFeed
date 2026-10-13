// 대조 실험: 앱의 AI 호출에 개발용 지침(이 레포의 CLAUDE.md)이 섞이는지 확인한다.
//   npm run ai:probe            (조건마다 2번씩, 구독 사용량이 든다 — sonnet 8회)
// 판정은 모델의 자기 보고(claude_md_visible)만 믿지 않고, 보고한 첫 줄이 실제 CLAUDE.md 첫 줄과 똑같은지로 한다 —
// 파일을 보지 않고는 그 줄을 글자 그대로 맞힐 수 없으므로.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { env } from '../server/src/config.ts';
import { openDb } from '../server/src/db/index.ts';
import { AiService } from '../server/src/ai/adapter.ts';
import { loadPrompt } from '../server/src/ai/prompts.ts';
import { ClaudeCodeProvider } from '../server/src/ai/providers/claude-code.ts';

const ProbeSchema = z.object({
  claude_md_visible: z.boolean(),
  first_line: z.string().nullable(),
  project_name: z.string().nullable(),
});

const REPEAT = Number(process.env.PROBE_REPEAT ?? 2);
const claudeMdFirstLine = fs.readFileSync(path.join(env.repoRoot, 'CLAUDE.md'), 'utf8').split('\n')[0]!.trim();
const sessionDir = path.join(os.homedir(), '.claude', 'projects', env.repoRoot.replace(/[/.]/g, '-'));
const countSessions = () => (fs.existsSync(sessionDir) ? fs.readdirSync(sessionDir).filter((f) => f.endsWith('.jsonl')).length : 0);

const conditions = [
  { id: 'A', label: '레포 폴더 · safe-mode 없음', isolation: { safeMode: false, tempCwd: false, cwd: env.repoRoot }, expect: '섞임 (실험이 잡아내는지 확인)' },
  { id: 'B', label: '레포 폴더 · safe-mode', isolation: { safeMode: true, tempCwd: false, cwd: env.repoRoot }, expect: '안 섞임' },
  { id: 'C', label: '임시 폴더 · safe-mode (앱 기본)', isolation: { safeMode: true, tempCwd: true }, expect: '안 섞임' },
  { id: 'D', label: '임시 폴더 · safe-mode 없음 (참고)', isolation: { safeMode: false, tempCwd: true }, expect: '안 섞임' },
];

const prompt = loadPrompt(null, 'smoke_context_probe', {});
const sessionsBefore = countSessions();
const rows: string[] = [];
console.log(`[실험] CLAUDE.md 첫 줄: ${claudeMdFirstLine}`);

for (const c of conditions) {
  for (let i = 1; i <= REPEAT; i++) {
    const db = openDb(':memory:');
    const ai = new AiService({ db, provider: new ClaudeCodeProvider({ isolation: c.isolation }) });
    const started = Date.now();
    try {
      const r = await ai.call({ task: 'smoke_context_probe', prompt: prompt.text, schema: ProbeSchema, promptRef: prompt.ref });
      const exact = r.data.first_line?.trim() === claudeMdFirstLine;
      const verdict = exact ? '**섞임**' : r.data.claude_md_visible ? '섞임 의심(첫 줄 불일치)' : '안 섞임';
      rows.push(
        `| ${c.id} | ${c.label} | ${i} | ${r.data.claude_md_visible} | ${r.data.first_line === null ? 'null' : `\`${r.data.first_line}\``} | ${exact ? '예' : '아니오'} | ${verdict} | ${c.expect} | ${((Date.now() - started) / 1000).toFixed(1)}초 |`,
      );
    } catch (err) {
      rows.push(`| ${c.id} | ${c.label} | ${i} | — | — | — | 실패: ${(err as Error).message.slice(0, 60)} | ${c.expect} | — |`);
    }
    console.log(rows.at(-1));
  }
}

const sessionsAfter = countSessions();
console.log('\n| 조건 | 실행 방식 | 회차 | 모델 자기 보고 | 보고한 첫 줄 | 실제 첫 줄과 일치 | 판정 | 기대 | 시간 |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(r);
console.log(`\n세션 기록(--no-session-persistence 확인): 이 프로젝트의 대화 파일 ${sessionsBefore}개 → ${sessionsAfter}개`);
