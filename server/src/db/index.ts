// SQLite 연결과 마이그레이션. DB 접근은 이 폴더를 거친다 —
// node:sqlite 가 문제를 일으키면 better-sqlite3 로 바꿀 때 고칠 곳을 여기로 한정하려고.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export type Db = DatabaseSync;

/** DB 를 열고 아직 적용하지 않은 마이그레이션을 번호순으로 적용한다. ':memory:' 는 테스트용. */
export function openDb(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_version').get() as { v: number | null };
  const current = row.v ?? 0;
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort();
  for (const file of files) {
    const version = Number(file.slice(0, 3));
    if (version <= current) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    // 마이그레이션 하나가 반쯤 적용된 상태로 남지 않게 트랜잭션으로 감싼다
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare("INSERT INTO schema_version (version, applied_at) VALUES (?, datetime('now'))").run(version);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(
        `DB 마이그레이션 ${file} 적용에 실패했습니다: ${(err as Error).message}. ` +
          `SQL 파일을 고친 뒤 다시 실행하세요. 개발 중이라면 data/firstfeed.sqlite 를 지우고 다시 시작해도 됩니다.`,
        { cause: err },
      );
    }
  }
}
