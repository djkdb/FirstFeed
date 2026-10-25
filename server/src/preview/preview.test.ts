// 30일 뒤 내 계정 미리보기 (FR-BR-6 · 결정 2026-10-21) — 격자 구성 · 계획 칸 고치기·고정 · 다시 만들 때 고정 유지 · 근거 규칙
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { AiService } from '../ai/adapter.ts';
import type { JobState } from '../ai/jobs.ts';
import { FakeProvider, type FakeStep } from '../ai/testing/fake-provider.ts';
import { env, setSetting } from '../config.ts';
import { openDb } from '../db/index.ts';
import { text, type ProfileContent } from '../identity/model.ts';
import { createSession, saveProfileVersion } from '../identity/store.ts';
import { fixTemplate } from '../templates/store.ts';
import type { BrandLook } from '../templates/types.ts';
import { latestPlan, planRules, savePlan, type PlanContext } from './plan.ts';
import { markPosted } from '../home/store.ts';
import type { HomeMark } from '../home/marks.ts';
import { composeGrid } from './routes.ts';

const H = { host: 'localhost:4317', 'content-type': 'application/json' };
const P = (id: string, name: string) => ({ id, name, description: `${name} 이야기`, evidence: [], origin: 'interview' as const, expiresAt: null });
const PILLARS = [P('a'.repeat(16), '써 본 도구'), P('b'.repeat(16), '만든 것'), P('c'.repeat(16), '활동 기록')];
const look: BrandLook = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/real/brands/me.json'), 'utf8')).look;

/** 축을 돌아가며 9개 — 숫자 없이 */
const nine = (prefix = '제목') => ({ titles: Array.from({ length: 9 }, (_, i) => ({ title: `${prefix} ${'가나다라마바사아자'[i]}`, pillar_id: PILLARS[i % 3]!.id })) });

/** 격자는 최근이 왼쪽 위라(결정 2026-10-25) 칸 위치가 아니라 계획 칸 번호로 찾는다 */
const atSlot = (v: { cells: Array<{ slot?: number | null }> }, n: number) => v.cells.find((c) => c.slot === n);

/** 정체성 프로필 내용(축 3개) — 프로필 판을 바꿔 보는 테스트가 축만 갈아 끼운다 */
const profileContent = (): ProfileContent => ({
  accountLine: '직접 써 본 AI 도구 정리',
  accountLineOrigin: 'interview',
  audience: '대학생',
  audienceOrigin: 'interview',
  pillars: PILLARS,
  dropped: [],
  voiceRules: [text('쉽게 쓴다', 'interview')],
  avoid: [],
  unknown: [],
  presence: null,
});

function setup(steps: FakeStep[], opts: { template?: boolean; made?: string[] } = {}) {
  const db = openDb(':memory:');
  const sid = createSession(db, 1, {});
  saveProfileVersion(db, 1, profileContent(), { reason: 'interview', sessionId: sid, basedOn: null, jobId: null, activate: true });
  const tv = opts.template !== false ? fixTemplate(db, 1, 'A', look, { cover: { headline: { charsPerLine: 9, maxLines: 2, maxChars: null } } }, 'playwright-chromium 156', null) : null;
  // 이미 만든 카드 세트(표지만) — 계획이 같은 소재를 또 내지 않는지 보려고
  for (const headline of opts.made ?? []) {
    const src = Number(db.prepare("INSERT INTO sources (brand_id, body) VALUES (1, '원문')").run().lastInsertRowid);
    const pid = Number((db.prepare('SELECT id FROM brand_profiles ORDER BY id DESC LIMIT 1').get() as { id: number }).id);
    const set = Number(db.prepare('INSERT INTO card_sets (brand_id, source_id, profile_id, template_version_id, body_count) VALUES (1, ?, ?, ?, 1)').run(src, pid, tv).lastInsertRowid);
    db.prepare("INSERT INTO cards (set_id, idx, kind, content_json, png_file, render_json) VALUES (?, 0, 'cover', ?, '01-cover.png', '{}')").run(set, JSON.stringify({ headline }));
  }
  const provider = new FakeProvider(steps);
  const app = createApp({ db, ai: new AiService({ db, provider }) });
  const req = (method: string, p: string, body?: unknown) => app.request(`/api/preview${p}`, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
  const job = async (jobId: string): Promise<JobState> => {
    for (let i = 0; i < 200; i++) {
      const s = (await (await app.request(`/api/ai/jobs/${jobId}`, { headers: H })).json()) as JobState;
      if (s.phase !== 'running') return s;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error('작업이 끝나지 않음');
  };
  const view = async () => (await (await req('GET', '')).json()) as {
    profile: { profileImage: string | null; handle: string | null };
    cells: Array<{ kind: string; slot?: number | null; title?: string; locked?: boolean; origin?: string; pillarName?: string | null }>;
    counts: { made: number; plan: number };
    plan: { slots: Array<{ title: string; locked: boolean }> } | null;
  };
  const makePlan = async () => {
    const { jobId } = (await (await req('POST', '/plan')).json()) as { jobId: string };
    return job(jobId);
  };
  return { db, req, view, makePlan, provider };
}

describe('격자 구성 — 실제 인스타처럼 가장 최근이 왼쪽 위 (결정 2026-10-25)', () => {
  const plan9 = Array.from({ length: 9 }, (_, i) => ({ title: `계획 ${i + 1}`, pillarId: 'x', locked: false, origin: 'ai' as const }));
  const kinds = (g: ReturnType<typeof composeGrid>) => g.map((c) => (c.kind === 'plan' ? `p${c.slot + 1}` : c.kind === 'made' ? `m${c.setId}` : '-'));

  it('계획만 있으면 마지막에 올릴 9번 칸이 왼쪽 위, 1번 칸이 오른쪽 아래', () => {
    const g = composeGrid([], plan9, new Map([['x', '축 X']]), 9);
    expect(kinds(g)).toEqual(['p9', 'p8', 'p7', 'p6', 'p5', 'p4', 'p3', 'p2', 'p1']);
    expect(g[8]).toMatchObject({ kind: 'plan', slot: 0, title: '계획 1', pillarName: '축 X', state: 'plan' });
  });

  it('잇지 않은 만든 세트는 계획보다 먼저 올린 것으로 — 오른쪽 아래부터(만든 순), 계획 칸은 그 위로', () => {
    const made = [
      { id: 7, cover: '최근 표지', createdAt: '2026-10-21 10:00:00' },
      { id: 3, cover: '이전 표지', createdAt: '2026-10-20 10:00:00' },
    ];
    const g = composeGrid(made, plan9.slice(0, 5), new Map(), 9);
    expect(kinds(g)).toEqual(['p5', 'p4', 'p3', 'p2', 'p1', 'm7', 'm3', '-', '-']);
    expect(g[5]).toMatchObject({ kind: 'made', setId: 7, slot: null, state: 'made' });
  });

  it('칸이 모자라면 만든 세트가 먼저 자리를 차지하고 계획 뒤쪽 칸이 빠진다(9칸)', () => {
    const g = composeGrid([{ id: 1, cover: '표지', createdAt: '' }], plan9, new Map(), 9);
    expect(kinds(g)).toEqual(['p8', 'p7', 'p6', 'p5', 'p4', 'p3', 'p2', 'p1', 'm1']);
  });

  it('만든 세트가 9개를 넘으면 가장 최근 9개만 — 가장 최근이 왼쪽 위, 계획 칸은 없다', () => {
    const made = Array.from({ length: 11 }, (_, i) => ({ id: 20 - i, cover: `표지 ${i}`, createdAt: '' }));
    const g = composeGrid(made, [{ title: '계획', pillarId: 'x', locked: false, origin: 'ai' }], new Map(), 9);
    expect(kinds(g)).toEqual(['m20', 'm19', 'm18', 'm17', 'm16', 'm15', 'm14', 'm13', 'm12']);
  });

  it('칸 상태 3가지(FR-HM-4): 칸에 이은 세트는 그 칸 자리에 만듦, 올렸다고 표시하면 올림 — 그림 없는 칸도 올림', () => {
    const made = [{ id: 5, cover: '이은 세트', createdAt: '' }];
    const marks = new Map<number, HomeMark>([
      [1, { setId: 5, postedAt: null, delayDays: 0 }],
      [0, { setId: null, postedAt: '2026-10-25', delayDays: 0 }],
    ]);
    const g = composeGrid(made, plan9.slice(0, 3), new Map(), 9, marks);
    expect(kinds(g)).toEqual(['p3', 'm5', 'p1', '-', '-', '-', '-', '-', '-']);
    expect(g[1]).toMatchObject({ kind: 'made', setId: 5, slot: 1, state: 'made' });
    expect(g[2]).toMatchObject({ kind: 'plan', slot: 0, state: 'posted' });
    marks.set(1, { setId: 5, postedAt: '2026-10-28', delayDays: 0 });
    expect(composeGrid(made, plan9.slice(0, 3), new Map(), 9, marks)[1]).toMatchObject({ kind: 'made', state: 'posted' });
  });
});

describe('거의 같은 제목 규칙 (결정 2026-10-24)', () => {
  // 데모 격자(site/data/demo.json 2026-10-22)의 실제 제목 — 1번은 만든 카드, 2~9번은 계획
  const DEMO = ['하얀 화면에서 이틀 헤맨 이야기', '하얀 화면에서 이틀 헤맨 순서', '에러 메시지, 내 말로 풀면', '수업 과제로 만든 첫 웹페이지', '에러를 그대로 AI에 붙여 넣기까지', '비전공자가 막힌 단어, 내 말로', '회비를 정리하려고 만든 페이지', '막힌 데서 AI한테 묻는 순서', '용어부터 막힐 때 내가 푸는 법'];
  const ctx = (o: Partial<PlanContext> = {}): PlanContext => ({
    count: 0, maxChars: 99, pillarIds: ['x'], grounding: { source: [], brand: [], userInput: [] }, commonTerms: [], madeTitles: [], overlapThreshold: 0.4, lockedIdx: [], ...o,
  });
  const codes = (titles: string[], o: Partial<PlanContext> = {}) => {
    const d = { titles: titles.map((title) => ({ title, pillar_id: 'x' })) };
    return planRules(ctx({ count: titles.length, ...o })).flatMap((r) => r(d)).filter((i) => i.code.startsWith('title_like')).map((i) => `${i.code} ${i.where}`);
  };

  it('이미 만든 카드와 거의 같은 계획 제목(데모 1·2번)은 걸린다', () => {
    expect(codes(DEMO.slice(1), { madeTitles: [DEMO[0]!] })).toEqual(['title_like_made titles.0.title']);
  });

  it('계획 제목끼리 거의 같으면 뒤 칸이 걸린다', () => {
    expect(codes(['막힌 데서 AI한테 묻는 순서', '하얀 화면에서 이틀 헤맨 이야기', '하얀 화면에서 이틀 헤맨 순서'])).toEqual(['title_like_other titles.2.title']);
  });

  it('서로 다른 제목은 통과한다 — 낱말 하나(「내 말로」「만든 페이지」)만 겹친 쌍도 코드는 막지 않는다(프롬프트 v4 몫)', () => {
    expect(codes(DEMO.slice(2), { madeTitles: [DEMO[0]!] })).toEqual([]);
    // 공개 fixture me 의 v3 계획 9개(devlog 2026-10-22-04)
    const me = ['AI 도구, 설치만 하고 멈췄다면', '설명 말고 직접 만든 걸로', '계정이 대외활동으로 이어질 때', '새 도구 첫날, 다들 하는 실수', '바이브코딩, 첫 화면은 뭐부터?', '소문 말고 공식 문서로 확인한 것', '협업은 어디서 시작됐을까', '완성 화면 뒤에 숨은 과정', '업데이트 떴는데 뭐가 바뀐 거지?'];
    expect(codes(me)).toEqual([]);
  });

  it('사용자가 고정한 칸은 고치라고 하지 않는다 — 고정한 칸과 겹치는 AI 칸이 걸린다', () => {
    expect(codes(['하얀 화면에서 이틀 헤맨 이야기', '하얀 화면에서 이틀 헤맨 순서'], { lockedIdx: [1] })).toEqual(['title_like_other titles.0.title']);
    expect(codes(['하얀 화면에서 이틀 헤맨 이야기', '하얀 화면에서 이틀 헤맨 순서'], { lockedIdx: [0, 1] })).toEqual([]);
  });
});

describe('30일 뒤 미리보기 API', () => {
  it('프로필 사진·만든 세트·계획이 없어도 열린다 — 사진은 null, 9칸 모두 빈칸', async () => {
    const t = setup([]);
    const v = await t.view();
    expect(v.profile.profileImage).toBeNull();
    expect(v.cells).toHaveLength(9);
    expect(v.cells.every((c) => c.kind === 'empty')).toBe(true);
    expect(v.plan).toBeNull();
  });

  it('계획을 만들면 AI 1번으로 9칸이 계획 칸이 되고, 축 이름이 붙는다', async () => {
    const t = setup([{ structured: nine() }]);
    expect((await t.makePlan()).phase).toBe('done');
    const v = await t.view();
    expect(v.cells.map((c) => c.kind)).toEqual(Array(9).fill('plan'));
    expect(atSlot(v, 1)).toMatchObject({ title: '제목 나', pillarName: '만든 것', locked: false, origin: 'ai' });
    expect(v.counts).toMatchObject({ made: 0, plan: 9 });
  });

  it('제목에 프로필·브랜딩·사용자 답에 없는 숫자가 있으면 재작성한다', async () => {
    const bad = nine();
    bad.titles[0]!.title = '30일 만에 팔로워';
    const t = setup([{ structured: bad }, { structured: nine() }]);
    const s = await t.makePlan();
    expect(s.phase).toBe('done');
    const runs = t.db.prepare("SELECT kind, status FROM ai_runs WHERE task = 'series_plan' ORDER BY attempt").all();
    expect(runs).toEqual([
      { kind: 'generate', status: 'rule_error' },
      { kind: 'rewrite', status: 'ok' },
    ]);
  });

  it('이미 만든 카드 세트의 표지 제목을 계획 프롬프트(v4)에 넣는다 — 강조 표시·줄바꿈은 빼고', async () => {
    const t = setup([{ structured: nine() }], { made: ['하얀 화면에서\n**이틀** 헤맨 이야기'] });
    setSetting(t.db, 'prompts.activeVersions', { series_plan: 'v4' });
    expect((await t.makePlan()).phase).toBe('done');
    expect(t.provider.calls[0]!.prompt).toContain('## 이미 만든 게시물 (표지 제목, 최신순)\n- 하얀 화면에서 이틀 헤맨 이야기');
  });

  it('이미 만든 카드와 거의 같은 계획 제목이 나오면 재작성한다', async () => {
    const bad = nine();
    bad.titles[0]!.title = '하얀 화면에서 이틀 헤맨 순서';
    const t = setup([{ structured: bad }, { structured: nine() }], { made: ['하얀 화면에서\n**이틀** 헤맨 이야기'] });
    expect((await t.makePlan()).phase).toBe('done');
    const runs = t.db.prepare("SELECT kind, status, issues_json FROM ai_runs WHERE task = 'series_plan' ORDER BY attempt").all() as Array<{ kind: string; status: string; issues_json: string }>;
    expect(runs.map((r) => [r.kind, r.status])).toEqual([['generate', 'rule_error'], ['rewrite', 'ok']]);
    expect(JSON.parse(runs[0]!.issues_json)).toMatchObject([{ code: 'title_like_made', where: 'titles.0.title' }]);
  });

  it('「올렸어요」를 한 칸은 프로필 판이 바뀌어도 다시 만들 때 그대로 — 「고정」만 한 칸은 같은 프로필 판일 때만 (결정 2026-10-25)', async () => {
    const NEW = [P('d'.repeat(16), '새 축 하나'), P('e'.repeat(16), '새 축 둘'), P('f'.repeat(16), '새 축 셋')];
    const fresh = { titles: Array.from({ length: 9 }, (_, i) => ({ title: `새 ${'가나다라마바사아자'[i]}`, pillar_id: NEW[i % 3]!.id })) };
    // AI 가 남길 칸을 옛 축 ID 그대로 옮겨 써도 규칙에 걸리지 않아야 한다
    fresh.titles[2] = { title: '제목 다', pillar_id: PILLARS[2]!.id };
    const t = setup([{ structured: nine() }, { structured: fresh }]);
    await t.makePlan();
    markPosted(t.db, 1, 2, '2026-10-25');
    expect((await t.req('PUT', '/plan/4', { locked: true })).status).toBe(200);
    const sid = createSession(t.db, 1, {});
    saveProfileVersion(t.db, 1, { ...profileContent(), pillars: NEW }, { reason: 'alternative', sessionId: sid, basedOn: null, jobId: null, activate: true });
    expect((await t.makePlan()).phase).toBe('done');
    const slots = latestPlan(t.db, 1)!.slots;
    expect(slots[2]).toMatchObject({ title: '제목 다', locked: true });
    // 고정만 한 4번 칸(제목 마)은 새 프로필에서 남지 않고, 나머지 8칸은 새 제목(칸 순서는 줄무늬 맞추기로 바뀔 수 있다)
    expect(slots.some((x) => x.title === '제목 마')).toBe(false);
    expect(slots.filter((x, i) => i !== 2 && x.title.startsWith('새 ') && !x.locked)).toHaveLength(8);
  });

  it('계획을 만들면 같은 축이 같은 열(3칸 간격)에 이어지지 않게 칸 순서를 맞춘다 — AI 는 축을 차례로 돌려 줘도 (결정 2026-10-25)', async () => {
    const t = setup([{ structured: nine() }]);
    await t.makePlan();
    const ids = latestPlan(t.db, 1)!.slots.map((s) => s.pillarId);
    expect(ids.filter((x, i) => i + 3 < ids.length && x === ids[i + 3])).toHaveLength(0);
    expect([...ids].sort()).toEqual(nine().titles.map((x) => x.pillar_id).sort());
  });

  it('이미 있는 계획은 「칸 순서 맞추기」로만(AI 없음) — 올린 칸은 그 자리', async () => {
    const t = setup([]);
    const pid = Number((t.db.prepare('SELECT id FROM brand_profiles ORDER BY id DESC LIMIT 1').get() as { id: number }).id);
    savePlan(t.db, 1, pid, nine().titles.map((x) => ({ title: x.title, pillarId: x.pillar_id, locked: false, origin: 'ai' as const })), null);
    markPosted(t.db, 1, 4, '2026-10-25');
    const before = latestPlan(t.db, 1)!.slots;
    const r = (await (await t.req('POST', '/plan/arrange')).json()) as { changed: boolean };
    expect(r.changed).toBe(true);
    const after = latestPlan(t.db, 1)!.slots;
    expect(after[4]).toEqual(before[4]);
    const ids = after.map((s) => s.pillarId);
    expect(ids.filter((x, i) => i + 3 < ids.length && x === ids[i + 3]).length).toBeLessThan(6);
    expect(((await (await t.req('POST', '/plan/arrange')).json()) as { changed: boolean }).changed).toBe(false);
  });

  it('칸을 고치고 고정하면, 다시 만들어도 고정한 칸은 그대로다', async () => {
    const t = setup([{ structured: nine() }, { structured: nine('새') }]);
    await t.makePlan();
    expect((await t.req('PUT', '/plan/2', { title: '내가 쓴 제목', locked: true })).status).toBe(200);
    let v = await t.view();
    expect(atSlot(v, 2)).toMatchObject({ title: '내가 쓴 제목', locked: true, origin: 'edit' });
    await t.makePlan();
    v = await t.view();
    expect(atSlot(v, 2)).toMatchObject({ title: '내가 쓴 제목', locked: true, origin: 'edit' });
    expect(atSlot(v, 0)).toMatchObject({ title: '새 가', locked: false });
  });

  it('고친 제목이 고정 템플릿 표지에 안 들어가면(9자 × 2줄) 저장하지 않고 이유를 알린다', async () => {
    const t = setup([{ structured: nine() }]);
    await t.makePlan();
    const r = await t.req('PUT', '/plan/0', { title: '가'.repeat(19) });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toContain('18자 이내');
  });

  it('고정한 템플릿이 없으면 계획을 만들지 않고 할 일을 알려 준다', async () => {
    const t = setup([], { template: false });
    const s = await t.makePlan();
    expect(s.phase).toBe('failed');
    expect(s.error?.hint).toContain('「템플릿」');
  });
});
