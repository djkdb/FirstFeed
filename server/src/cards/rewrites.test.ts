// 카드 세트의 재작성 기록 API (결정 2026-10-21 · C) — 세트를 만든 본문 작업에서 걸린 규칙과 바뀐 칸
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider } from '../ai/testing/fake-provider.ts';
import { env } from '../config.ts';
import { openDb } from '../db/index.ts';
import { text } from '../identity/model.ts';
import { createSession, saveProfileVersion } from '../identity/store.ts';
import { fixTemplate } from '../templates/store.ts';

describe('GET /api/cards/sets/:id/rewrites', () => {
  it('본문 작업의 걸린 시도 → 다시 쓴 시도를 짝지어 바뀐 칸만 돌려준다', async () => {
    const db = openDb(':memory:');
    const pid = saveProfileVersion(
      db,
      1,
      { accountLine: '계정', accountLineOrigin: 'interview', audience: '누구', audienceOrigin: 'interview', pillars: [], dropped: [], voiceRules: [text('쉽게', 'interview')], avoid: [], unknown: [], presence: null },
      { reason: 'interview', sessionId: createSession(db, 1, {}), basedOn: null, jobId: null, activate: true },
    );
    const look = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/real/brands/me.json'), 'utf8')).look;
    const tv = fixTemplate(db, 1, 'A', look, {}, 'test', null);
    const src = Number(db.prepare("INSERT INTO sources (brand_id, body) VALUES (1, '원문')").run().lastInsertRowid);
    const set = Number(db.prepare("INSERT INTO card_sets (brand_id, source_id, profile_id, template_version_id, body_count, body_job_id) VALUES (1, ?, ?, ?, 1, 'job-b')").run(src, pid, tv).lastInsertRowid);
    const run = db.prepare(
      "INSERT INTO ai_runs (job_id, task, provider, attempt, kind, status, issues_json, output_json, started_at) VALUES ('job-b', 'card_body', 'fake', ?, ?, ?, ?, ?, '')",
    );
    run.run(1, 'generate', 'rule_error', JSON.stringify([{ level: 'error', code: 'number_not_in_source', where: 'cards.0.text', message: '원문에 없는 "40"', from: 'rule' }]), JSON.stringify({ cards: [{ text: '40분 기다림' }] }));
    run.run(2, 'rewrite', 'ok', '[]', JSON.stringify({ cards: [{ text: '오래 기다림' }] }));
    const app = createApp({ db, ai: new AiService({ db, provider: new FakeProvider([]) }) });
    const r = await app.request(`/api/cards/sets/${set}/rewrites`, { headers: { host: 'localhost:4317' } });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      cover: [],
      body: [
        {
          task: 'card_body',
          attempt: 1,
          issues: [{ code: 'number_not_in_source', where: 'cards.0.text', message: '원문에 없는 "40"', from: 'rule' }],
          changes: [{ path: 'cards.0.text', before: '40분 기다림', after: '오래 기다림' }],
          passedAfter: true,
        },
      ],
    });
    expect((await app.request('/api/cards/sets/999/rewrites', { headers: { host: 'localhost:4317' } })).status).toBe(404);
  });
});
