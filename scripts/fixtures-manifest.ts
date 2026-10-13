// 비공개 테스트 자료의 목록(파일 이름·건수)을 만든다. 내용은 담지 않는다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { buildManifest, listPrivateFixtures, MANIFEST } from './fixtures.ts';
import { findSensitive } from '../server/src/lib/redact.ts';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const manifest = buildManifest(listPrivateFixtures(root));

// 파일 이름 자체에 이메일·전화번호가 들어가 있으면 목록으로 새어 나가므로 막는다
const leaky = manifest.files.filter((f) => findSensitive(f.path).length > 0);
if (leaky.length) {
  console.error('[목록] 파일 이름에 개인정보로 보이는 값이 있습니다. notice-01.md 처럼 이름을 바꾼 뒤 다시 실행하세요:');
  for (const f of leaky) console.error(`  - ${f.path}`);
  process.exit(1);
}

fs.writeFileSync(path.join(root, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
console.log(`[목록] ${MANIFEST} 갱신 — ${manifest.files.length}건`, manifest.counts);
