// SQLite 연결과 마이그레이션. DB 접근은 이 폴더를 거친다 —
// node:sqlite 가 문제를 일으키면 better-sqlite3 로 바꿀 때 고칠 곳을 여기로 한정하려고.
import { createHash } from 'node:crypto';
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

const sha = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16);

/**
 * 아직 적용하지 않은 마이그레이션을 번호순으로 적용한다.
 * 적용한 파일의 체크섬을 기록해, 이미 적용된 파일이 나중에 바뀌면 시작할 때 멈춘다 —
 * 바뀐 내용은 이미 적용된 DB 에는 들어가지 않아 "새 DB 에선 되는데 쓰던 DB 에선 안 되는" 오류가 나기 때문(2026-10-13 실제로 겪음).
 */
function migrate(db: Db): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const cols = db.prepare('PRAGMA table_info(schema_version)').all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'checksum')) db.exec('ALTER TABLE schema_version ADD COLUMN checksum TEXT');

  const applied = new Map(
    (db.prepare('SELECT version, checksum FROM schema_version').all() as Array<{ version: number; checksum: string | null }>).map((r) => [
      r.version,
      r.checksum,
    ]),
  );
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort();
  for (const file of files) {
    const version = Number(file.slice(0, 3));
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const sum = sha(sql);
    if (applied.has(version)) {
      const recorded = applied.get(version);
      if (recorded === null || recorded === undefined) {
        // 체크섬 기록 전에 적용된 것: 지금 파일을 기준으로 기록만 한다
        db.prepare('UPDATE schema_version SET checksum = ? WHERE version = ?').run(sum, version);
      } else if (recorded !== sum) {
        throw new Error(
          `이미 적용된 마이그레이션 ${file} 의 내용이 바뀌었습니다. 적용된 마이그레이션은 고치지 말고, 바꿀 내용을 새 번호의 파일로 만드세요. ` +
            '개발 중이라 기존 데이터가 필요 없다면 data/firstfeed.sqlite 를 지우고 다시 시작해도 됩니다.',
        );
      }
      continue;
    }
    // 마이그레이션 하나가 반쯤 적용된 상태로 남지 않게 트랜잭션으로 감싼다
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare("INSERT INTO schema_version (version, applied_at, checksum) VALUES (?, datetime('now'), ?)").run(version, sum);
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
