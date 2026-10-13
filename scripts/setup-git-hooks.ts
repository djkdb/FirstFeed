// npm install 때(prepare) 레포의 git 훅 폴더를 .githooks 로 연결한다 — 클론한 뒤 npm install 만 하면 커밋 전 검사가 켜지게.
// git 저장소가 아닌 곳(압축 파일로 받은 경우 등)에서는 조용히 건너뛴다. 설치 자체가 실패하면 안 되므로.
import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
} catch {
  console.log('[훅] git 저장소가 아니라서 커밋 전 검사 설정을 건너뜁니다.');
  process.exit(0);
}
execFileSync('git', ['config', 'core.hooksPath', '.githooks']);
console.log('[훅] 커밋 전 검사(.githooks/pre-commit)를 켰습니다.');
