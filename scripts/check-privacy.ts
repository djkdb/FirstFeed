// 공개 레포에 개인정보·비밀 값이 올라가지 않게 검사한다.
//   node scripts/check-privacy.ts           커밋될 수 있는 모든 파일(추적 중 + 무시되지 않은 새 파일)
//   node scripts/check-privacy.ts --staged  커밋하려고 올린 내용만 (pre-commit 훅이 쓴다)
// 오탐은 privacy-allowlist.json 에 이유 한 줄과 함께 올린다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describeFinding, scanFile, validateAllowlist, type FileFinding } from './privacy.ts';
import { listPrivateFixtures, readManifest, PRIVATE_DIR } from './fixtures.ts';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const staged = process.argv.includes('--staged');
const IMAGE = /\.(png|jpe?g|gif|webp|heic|pdf)$/i;

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

const allowRaw = JSON.parse(fs.readFileSync(path.join(root, 'privacy-allowlist.json'), 'utf8'));
const allow = validateAllowlist(allowRaw);
if (!allow.ok) {
  console.error('[개인정보 검사] privacy-allowlist.json 형식이 잘못됐습니다:');
  for (const e of allow.errors) console.error(`  - ${e}`);
  process.exit(1);
}

const files = (
  staged
    ? git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
    : git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
)
  .split('\0')
  .filter(Boolean);

const findings: FileFinding[] = [];
const imagesToEyeball: string[] = [];
const privateLeaks: string[] = [];

for (const file of files) {
  // 비공개 자료가 어떤 경로로든(.gitignore 실수, git add -f) 올라가려 하면 무조건 막는다
  if (file.startsWith(`${PRIVATE_DIR}/`)) privateLeaks.push(file);
  if (IMAGE.test(file)) {
    imagesToEyeball.push(file);
    continue;
  }
  let buf: Buffer;
  try {
    buf = staged ? execFileSync('git', ['show', `:${file}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 }) : fs.readFileSync(path.join(root, file));
  } catch {
    continue; // 지워진 파일 등
  }
  if (buf.includes(0)) continue; // 이진 파일
  findings.push(...scanFile(file, buf.toString('utf8'), allow.list));
}

// 비공개 자료 목록(manifest)이 실제와 다르면 알린다 — 목록만 공개하기로 했으므로 목록은 최신이어야 한다
const actual = listPrivateFixtures(root);
const manifest = readManifest(root);
const stale =
  actual.length > 0 &&
  (manifest === null || JSON.stringify(manifest.files.map((f) => f.path)) !== JSON.stringify(actual.map((f) => f.path)));

let failed = false;
if (privateLeaks.length) {
  failed = true;
  console.error(`[개인정보 검사] 비공개 자료(${PRIVATE_DIR}/)가 커밋에 들어 있습니다:`);
  for (const f of privateLeaks) console.error(`  - ${f}`);
  console.error('  → git rm --cached <파일> 로 커밋에서 빼세요. 이 폴더는 목록(manifest)만 공개합니다.');
}
if (findings.length) {
  failed = true;
  console.error(`[개인정보 검사] 개인정보·비밀 값으로 보이는 것 ${findings.length}건:`);
  for (const f of findings) console.error(`  - ${describeFinding(f)}`);
  console.error('  → 실제 값이면 지우거나 가린 뒤 다시 커밋하세요.');
  console.error('  → 오탐이면 privacy-allowlist.json 에 { "value" 또는 "path", "reason": "이유 한 줄" } 로 올리세요.');
}
if (imagesToEyeball.length) {
  console.warn(`[개인정보 검사] 이미지 ${imagesToEyeball.length}개는 글자를 검사하지 못합니다. 얼굴·이름·연락처가 보이지 않는지 직접 열어 확인하세요:`);
  for (const f of imagesToEyeball) console.warn(`  - ${f}`);
}
if (stale) {
  console.warn('[개인정보 검사] 비공개 자료 목록(private.manifest.json)이 실제 파일과 다릅니다. npm run fixtures:manifest 를 실행해 갱신하세요.');
}
if (failed) process.exit(1);
console.log(`[개인정보 검사] 통과 — 파일 ${files.length}개 검사${staged ? ' (커밋할 내용)' : ''}`);
