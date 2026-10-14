import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from './index.ts';

describe('마이그레이션', () => {
  it('새 DB 에 모든 마이그레이션을 적용하고 체크섬을 기록한다', () => {
    const db = openDb(':memory:');
    const rows = db.prepare('SELECT version, checksum FROM schema_version ORDER BY version').all() as Array<{ version: number; checksum: string }>;
    expect(rows.map((r) => r.version)).toEqual([1, 2, 3]);
    expect(rows.every((r) => /^[0-9a-f]{16}$/.test(r.checksum))).toBe(true);
    // 003 이 더한 칸이 있다
    const cols = db.prepare('PRAGMA table_info(identity_sessions)').all() as Array<{ name: string }>;
    expect(cols.map((c) => c.name)).toContain('note_json');
  });

  it('이미 적용된 마이그레이션 파일이 바뀌었으면 시작할 때 멈추고 무엇을 하면 되는지 알려 준다', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'firstfeed-db-')), 'test.sqlite');
    openDb(file).close();
    // 적용된 002 의 체크섬을 다른 값으로 바꿔 "파일이 바뀐 상황"을 만든다
    const raw = new DatabaseSync(file);
    raw.prepare("UPDATE schema_version SET checksum = 'deadbeefdeadbeef' WHERE version = 2").run();
    raw.close();
    expect(() => openDb(file)).toThrow(/새 번호의 파일로 만드세요/);
  });

  it('체크섬 기록 전에 적용된 DB 는 지금 파일 기준으로 기록만 하고 계속한다', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'firstfeed-db-')), 'old.sqlite');
    openDb(file).close();
    const raw = new DatabaseSync(file);
    raw.exec('UPDATE schema_version SET checksum = NULL');
    raw.close();
    expect(() => openDb(file).close()).not.toThrow();
  });
});
