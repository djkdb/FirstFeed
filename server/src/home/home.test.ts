// 「오늘 올릴 것」 홈 (FR-HM-1~3 · 결정 2026-10-24) — 칸 상태 · 오늘 할 칸 · 잇기 · 올렸어요 · 하루 미루기 · 간격
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider } from '../ai/testing/fake-provider.ts';
import { env, getSetting } from '../config.ts';
import { openDb } from '../db/index.ts';
import { text } from '../identity/model.ts';
import { createSession, saveProfileVersion } from '../identity/store.ts';
import { latestPlan, savePlan } from '../preview/plan.ts';
import { fixTemplate } from '../templates/store.ts';
import { delayDay, homeView, linkSet, markPosted, setCadence, unmarkPosted } from './store.ts';

const P = (id: string, name: string) => ({ id, name, description: name, evidence: [], origin: 'interview' as const, expiresAt: null });
const PILLARS = [P('a'.repeat(16), '써 본 도구'), P('b'.repeat(16), '만든 것')];

function setup(opts: { plan?: boolean } = {}) {
  const db = openDb(':memory:');
  const pid = saveProfileVersion(
    db,
    1,
    { accountLine: '계정', accountLineOrigin: 'interview', audience: '누구', audienceOrigin: 'interview', pillars: PILLARS, dropped: [], voiceRules: [text('쉽게', 'interview')], avoid: [], unknown: [], presence: null },
    { reason: 'interview', sessionId: createSession(db, 1, {}), basedOn: null, jobId: null, activate: true },
  );
  const look = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/real/brands/me.json'), 'utf8')).look;
  const tv = fixTemplate(db, 1, 'A', look, {}, 'test', null);
  if (opts.plan !== false)
    savePlan(db, 1, pid, ['첫 칸', '둘째 칸', '셋째 칸'].map((title, i) => ({ title, pillarId: PILLARS[i % 2]!.id, locked: false, origin: 'ai' as const })), null);
  const madeSet = (headline: string) => {
    const src = Number(db.prepare("INSERT INTO sources (brand_id, body) VALUES (1, '원문')").run().lastInsertRowid);
    const set = Number(db.prepare('INSERT INTO card_sets (brand_id, source_id, profile_id, template_version_id, body_count) VALUES (1, ?, ?, ?, 1)').run(src, pid, tv).lastInsertRowid);
    db.prepare("INSERT INTO cards (set_id, idx, kind, content_json, png_file, render_json) VALUES (?, 0, 'cover', ?, '01-cover.png', '{}')").run(set, JSON.stringify({ headline }));
    return set;
  };
  return { db, madeSet };
}

describe('「오늘 올릴 것」 홈', () => {
  it('계획이 없으면 준비 안 됨 — 시작일도 정하지 않는다', () => {
    const { db } = setup({ plan: false });
    expect(homeView(db, 1, '2026-10-25')).toMatchObject({ ready: false, slots: [] });
    expect(getSetting(db, 'home.startDate')).toBeNull();
  });

  it('처음 연 날이 시작일(한 번만 정함) · 기본 3일마다 · 오늘 할 칸은 첫 칸', () => {
    const { db } = setup();
    const v = homeView(db, 1, '2026-10-25');
    expect(v).toMatchObject({ ready: true, start: '2026-10-25', cadence: 'every3', todayIdx: 0, nextIdx: 1, counts: { posted: 0, made: 0, plan: 3 } });
    expect(v.slots.map((s) => s.due)).toEqual(['2026-10-25', '2026-10-28', '2026-10-31']);
    expect(v.slots[1]).toMatchObject({ title: '둘째 칸', pillarName: '만든 것', state: 'plan' });
    expect(homeView(db, 1, '2026-10-30').start).toBe('2026-10-25');
  });

  it('세트를 이으면 「만듦」이 되고 계획에서 그 칸이 고정된다 · 한 세트는 한 칸에만 · 끊을 수 있다', () => {
    const { db, madeSet } = setup();
    const s = madeSet('**하얀 화면**에서');
    linkSet(db, 1, 0, s);
    const v = homeView(db, 1, '2026-10-25');
    expect(v.slots[0]).toMatchObject({ state: 'made', setId: s, setCover: '**하얀 화면**에서' });
    expect(v.freeSets).toEqual([]);
    expect(latestPlan(db, 1)!.slots[0]!.locked).toBe(true);
    expect(() => linkSet(db, 1, 1, s)).toThrow(/이미 1번 칸/);
    linkSet(db, 1, 0, null);
    expect(homeView(db, 1, '2026-10-25').slots[0]).toMatchObject({ state: 'plan', setId: null });
  });

  it('「올렸어요」는 사용자 표시 — 올림이 되고 오늘 할 칸이 넘어간다. 되돌릴 수 있다', () => {
    const { db } = setup();
    homeView(db, 1, '2026-10-25');
    markPosted(db, 1, 0, '2026-10-25');
    let v = homeView(db, 1, '2026-10-25');
    expect(v.slots[0]).toMatchObject({ state: 'posted', postedAt: '2026-10-25' });
    expect(v).toMatchObject({ todayIdx: null, nextIdx: 1, counts: { posted: 1, made: 0, plan: 2 } });
    expect(latestPlan(db, 1)!.slots[0]!.locked).toBe(true);
    unmarkPosted(db, 1, 0);
    v = homeView(db, 1, '2026-10-25');
    expect(v).toMatchObject({ todayIdx: 0 });
    expect(() => markPosted(db, 1, 0, '10/25')).toThrow(/날짜/);
  });

  it('「하루 미루기」는 그 칸부터 뒤 칸까지 하루씩 — 올린 칸은 미룰 수 없다', () => {
    const { db } = setup();
    homeView(db, 1, '2026-10-25');
    delayDay(db, 1, 1);
    expect(homeView(db, 1, '2026-10-25').slots.map((s) => s.due)).toEqual(['2026-10-25', '2026-10-29', '2026-11-01']);
    markPosted(db, 1, 2);
    expect(() => delayDay(db, 1, 2)).toThrow(/이미 올린/);
  });

  it('간격을 주 2회 · 주 3회로 바꾸면 예정일이 다시 계산된다. 목록 밖 값은 거절', () => {
    const { db } = setup();
    homeView(db, 1, '2026-10-26');
    setCadence(db, 'thrice');
    expect(homeView(db, 1, '2026-10-26').slots.map((s) => s.due)).toEqual(['2026-10-26', '2026-10-28', '2026-10-30']);
    setCadence(db, 'twice');
    expect(homeView(db, 1, '2026-10-26').slots.map((s) => s.due)).toEqual(['2026-10-26', '2026-10-29', '2026-11-02']);
    expect(() => setCadence(db, 'daily')).toThrow(/간격/);
  });

  it('API: 바꾸는 요청은 홈 값을 다시 돌려주고, 안 되는 일은 400 + 이유', async () => {
    const { db, madeSet } = setup();
    const app = createApp({ db, ai: new AiService({ db, provider: new FakeProvider([]) }) });
    const H = { host: 'localhost:4317', 'content-type': 'application/json' };
    const req = (method: string, p: string, body?: unknown) => app.request(`/api/home${p}`, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
    expect((await (await req('GET', '')).json()) as { ready: boolean }).toMatchObject({ ready: true });
    const s = madeSet('세트');
    const r = await req('PUT', '/slots/1/set', { setId: s });
    expect(r.status).toBe(200);
    expect(((await r.json()) as { slots: Array<{ state: string }> }).slots[1]!.state).toBe('made');
    expect((await req('POST', '/slots/1/posted', {})).status).toBe(200);
    expect((await req('POST', '/slots/1/delay')).status).toBe(400);
    expect((await req('PUT', '/settings', { cadence: 'daily' })).status).toBe(400);
    expect((await req('POST', '/slots/9/posted', {})).status).toBe(400);
  });
});
