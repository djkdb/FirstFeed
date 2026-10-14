// 004: 이미 저장된 옛 형식 프로필이 새 형식(축 ID·항목 출처·무게·보여 주는 방식)으로 바뀌는지
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { openDb } from './index.ts';

const MIG = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

describe('마이그레이션 004 — 옛 프로필 변환', () => {
  it('축에 ID·출처, 근거에 무게, 말투·피할 것은 출처 붙은 항목, 보여 주는 방식은 설문 S6 에서', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'firstfeed-004-')), 'old.sqlite');
    // 003 까지만 적용된 DB 를 직접 만든다
    const raw = new DatabaseSync(file);
    raw.exec('CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
    for (const f of ['001_init.sql', '002_identity.sql', '003_identity_note.sql']) {
      raw.exec(fs.readFileSync(path.join(MIG, f), 'utf8'));
      raw.prepare("INSERT INTO schema_version (version, applied_at) VALUES (?, datetime('now'))").run(Number(f.slice(0, 3)));
    }
    raw.prepare("INSERT INTO identity_sessions (id, brand_id, survey_json, status) VALUES (1, 1, ?, 'profiled')").run(
      JSON.stringify({ S6: { choices: ['안 한다'], text: '직접 만든 캐릭터(ZUN)로 대신한다' } }),
    );
    const oldPillars = [
      {
        name: '써 본 것',
        description: '설명',
        evidence: [
          { quote: '직접 쓴 답', source: 'A1', sourceLabel: '인터뷰 1번 답', countsAsUserInput: true },
          { quote: '고른 선택지', source: 'A3', sourceLabel: '인터뷰 3번 답 · 선택지를 고른 답', countsAsUserInput: true },
        ],
      },
      { name: '오늘 바로', description: '설명2', evidence: [{ quote: '또 다른 답', source: 'A2', sourceLabel: '인터뷰 2번 답', countsAsUserInput: true }] },
    ];
    raw.prepare(
      `INSERT INTO brand_profiles (brand_id, session_id, version, account_line, audience, pillars_json, dropped_json, voice_rules_json, avoid_json, unknown_json, origin)
       VALUES (1, 1, 1, '소개', '대상', ?, '[]', ?, ?, '[]', 'interview')`,
    ).run(JSON.stringify(oldPillars), JSON.stringify(['쉽게', '짧게']), JSON.stringify(['과장']));
    raw.close();

    const db = openDb(file);
    const row = db.prepare('SELECT * FROM brand_profiles WHERE id = 1').get() as Record<string, string>;
    const pillars = JSON.parse(row.pillars_json!);
    expect(pillars).toHaveLength(2);
    expect(pillars[0]).toMatchObject({ name: '써 본 것', origin: 'interview', expiresAt: null });
    expect(pillars[0].id).toMatch(/^[0-9a-f]{16}$/);
    expect(pillars[0].id).not.toBe(pillars[1].id);
    expect(pillars[0].evidence.map((e: { weight: string }) => e.weight)).toEqual(['primary', 'supporting']);
    expect(pillars[0].evidence[0]).not.toHaveProperty('countsAsUserInput');
    expect(JSON.parse(row.voice_rules_json!)).toEqual([
      { text: '쉽게', origin: 'interview', expiresAt: null },
      { text: '짧게', origin: 'interview', expiresAt: null },
    ]);
    expect(JSON.parse(row.avoid_json!)).toEqual([{ text: '과장', origin: 'interview', expiresAt: null }]);
    expect(JSON.parse(row.presence_json!)).toEqual({ text: '안 한다 — 직접 만든 캐릭터(ZUN)로 대신한다', source: 'S6', origin: 'interview' });
    expect(row.reason).toBe('interview');
    expect([row.account_line_origin, row.audience_origin]).toEqual(['interview', 'interview']);
  });
});
