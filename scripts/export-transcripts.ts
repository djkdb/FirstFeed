// 제출용 AI 대화 기록 내보내기.
//   npm run export:transcripts -- <세션ID> [<세션ID> …]
//   npm run export:transcripts -- --latest           가장 최근 세션
//   npm run export:transcripts -- --all              이 프로젝트의 모든 세션
//   … --with-tool-results                            도구 결과도 넣기 (기본은 뺌)
// 결과는 exports/<세션ID>.md (.gitignore 로 막혀 있어 레포에 올라가지 않는다)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderTranscript } from './transcript.ts';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
// Claude Code 는 프로젝트 경로의 / 를 - 로 바꾼 이름의 폴더에 대화를 저장한다
const projectDir = path.join(os.homedir(), '.claude', 'projects', root.replace(/[/.]/g, '-'));
const args = process.argv.slice(2);

if (!fs.existsSync(projectDir)) {
  console.error(`[내보내기] 대화 기록 폴더가 없습니다: ${projectDir}\n  이 레포에서 Claude Code 를 한 번 이상 실행했는지 확인하세요.`);
  process.exit(1);
}
const all = fs
  .readdirSync(projectDir)
  .filter((f) => f.endsWith('.jsonl'))
  .map((f) => ({ id: f.slice(0, -6), mtime: fs.statSync(path.join(projectDir, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

const ids = args.includes('--all')
  ? all.map((s) => s.id)
  : args.includes('--latest')
    ? all.slice(0, 1).map((s) => s.id)
    : args.filter((a) => !a.startsWith('--'));

if (ids.length === 0) {
  console.error('[내보내기] 세션 ID 를 주거나 --latest / --all 을 쓰세요. 세션 ID 는 docs/devlog 기록에 있습니다.');
  process.exit(1);
}

const outDir = path.join(root, 'exports');
fs.mkdirSync(outDir, { recursive: true });
for (const id of ids) {
  const file = path.join(projectDir, `${id}.jsonl`);
  if (!fs.existsSync(file)) {
    console.error(`[내보내기] 세션 ${id} 을 찾지 못했습니다. ID 를 확인하세요 (${projectDir}).`);
    process.exitCode = 1;
    continue;
  }
  const { markdown, stats } = renderTranscript(id, fs.readFileSync(file, 'utf8'), {
    withToolResults: args.includes('--with-tool-results'),
  });
  const out = path.join(outDir, `${id}.md`);
  fs.writeFileSync(out, markdown);
  console.log(`[내보내기] ${path.relative(root, out)} — 사람 ${stats.userMessages} · Claude ${stats.assistantMessages} · 도구 ${stats.toolCalls} · 가림`, stats.redacted);
}
