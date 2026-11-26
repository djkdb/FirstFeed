// 024: 004 가 근거(evidence)를 "배열을 적은 문자열"로 저장한 판을 배열로 되돌리는지, 멀쩡한 판은 그대로 두는지
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const SQL = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations', '024_repair_pillar_evidence.sql'),
  'utf8',
);

const evidence = [
  { quote: '직접 쓴 답', source: 'A1', weight: 'primary' },
  { quote: '고른 선택지', source: 'A3', weight: 'supporting' },
];

function setup(rows: Array<{ id: number; pillars: unknown }>): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE brand_profiles (id INTEGER PRIMARY KEY, pillars_json TEXT NOT NULL)');
  for (const r of rows) db.prepare('INSERT INTO brand_profiles (id, pillars_json) VALUES (?, ?)').run(r.id, JSON.stringify(r.pillars));
  return db;
}

const pillarsOf = (db: DatabaseSync, id: number) =>
  JSON.parse((db.prepare('SELECT pillars_json FROM brand_profiles WHERE id = ?').get(id) as { pillars_json: string }).pillars_json);

describe('마이그레이션 024 — 문자열로 저장된 근거 되돌리기', () => {
  it('문자열로 저장된 근거는 배열로 돌아오고 다른 칸은 그대로다', () => {
    const db = setup([
      {
        id: 1,
        pillars: [
          { id: 'aaaa', name: '써 본 것', origin: 'interview', evidence: JSON.stringify(evidence) },
          { id: 'bbbb', name: '오늘 바로', origin: 'interview', evidence: JSON.stringify([evidence[0]]) },
        ],
      },
    ]);
    db.exec(SQL);
    const pillars = pillarsOf(db, 1);
    expect(pillars).toHaveLength(2);
    expect(pillars[0]).toEqual({ id: 'aaaa', name: '써 본 것', origin: 'interview', evidence });
    expect(pillars[1].evidence).toEqual([evidence[0]]);
  });

  it('이미 배열인 판은 글자 하나 바꾸지 않는다', () => {
    const good = [{ id: 'cccc', name: '멀쩡한 축', evidence }];
    const db = setup([{ id: 2, pillars: good }]);
    const before = (db.prepare('SELECT pillars_json FROM brand_profiles WHERE id = 2').get() as { pillars_json: string }).pillars_json;
    db.exec(SQL);
    const after = (db.prepare('SELECT pillars_json FROM brand_profiles WHERE id = 2').get() as { pillars_json: string }).pillars_json;
    expect(after).toBe(before);
  });

  it('한 판 안에 문자열 근거와 배열 근거가 섞여 있어도 모두 배열이 된다', () => {
    const db = setup([
      {
        id: 3,
        pillars: [
          { id: 'dddd', name: '문자열', evidence: JSON.stringify(evidence) },
          { id: 'eeee', name: '배열', evidence: [evidence[1]] },
          { id: 'ffff', name: '근거 없음' },
        ],
      },
    ]);
    db.exec(SQL);
    const pillars = pillarsOf(db, 3);
    expect(pillars[0].evidence).toEqual(evidence);
    expect(pillars[1].evidence).toEqual([evidence[1]]);
    expect(pillars[2].evidence).toEqual([]);
  });

  it('두 번 돌려도 결과가 같다', () => {
    const db = setup([{ id: 4, pillars: [{ id: 'gggg', name: '문자열', evidence: JSON.stringify(evidence) }] }]);
    db.exec(SQL);
    const once = pillarsOf(db, 4);
    db.exec(SQL);
    expect(pillarsOf(db, 4)).toEqual(once);
  });
});
