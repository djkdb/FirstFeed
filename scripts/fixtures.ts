// 비공개 테스트 자료(tests/fixtures/private)의 "무엇이 몇 건인지" 목록. 내용은 절대 담지 않는다.
import fs from 'node:fs';
import path from 'node:path';

export const PRIVATE_DIR = 'tests/fixtures/private';
export const MANIFEST = 'tests/fixtures/private.manifest.json';

export interface PrivateFile {
  path: string; // private/ 아래 상대 경로
  group: string; // 첫 폴더 이름 (interviews, notices …)
}

export interface Manifest {
  note: string;
  counts: Record<string, number>;
  files: PrivateFile[];
}

export function listPrivateFixtures(root: string): PrivateFile[] {
  const base = path.join(root, PRIVATE_DIR);
  if (!fs.existsSync(base)) return [];
  const out: PrivateFile[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'README.md') continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else {
        const rel = path.relative(base, abs).split(path.sep).join('/');
        out.push({ path: rel, group: rel.includes('/') ? rel.split('/')[0]! : '(분류 없음)' });
      }
    }
  };
  walk(base);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export function buildManifest(files: PrivateFile[]): Manifest {
  const counts: Record<string, number> = {};
  for (const f of files) counts[f.group] = (counts[f.group] ?? 0) + 1;
  return {
    note: '비공개 테스트 자료의 목록과 건수만 담는다. 내용은 레포에 없다 (지인 인터뷰·대외활동 공지). 갱신: npm run fixtures:manifest',
    counts,
    files,
  };
}

export function readManifest(root: string): Manifest | null {
  const file = path.join(root, MANIFEST);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Manifest) : null;
}
