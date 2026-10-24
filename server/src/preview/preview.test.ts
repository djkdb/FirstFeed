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
import { planRules, type PlanContext } from './plan.ts';
import { composeGrid } from './routes.ts';

const H = { host: 'localhost:4317', 'content-type': 'application/json' };
const P = (id: string, name: string) => ({ id, name, description: `${name} 이야기`, evidence: [], origin: 'interview' as const, expiresAt: null });
const PILLARS = [P('a'.repeat(16), '써 본 도구'), P('b'.repeat(16), '만든 것'), P('c'.repeat(16), '활동 기록')];
const look: BrandLook = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/real/brands/me.json'), 'utf8')).look;

/** 축을 돌아가며 9개 — 숫자 없이 */
const nine = (prefix = '제목') => ({ titles: Array.from({ length: 9 }, (_, i) => ({ title: `${prefix} ${'가나다라마바사아자'[i]}`, pillar_id: PILLARS[i % 3]!.id })) });

function setup(steps: FakeStep[], opts: { template?: boolean; made?: string[] } = {}) {
  const db = openDb(':memory:');
  const sid = createSession(db, 1, {});
  const content: ProfileContent = {
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
  };
  saveProfileVersion(db, 1, content, { reason: 'interview', sessionId: sid, basedOn: null, jobId: null, activate: true });
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
    cells: Array<{ kind: string; title?: string; locked?: boolean; origin?: string; pillarName?: string | null }>;
    counts: { made: number; plan: number };
    plan: { slots: Array<{ title: string; locked: boolean }> } | null;
  };
  const makePlan = async () => {
    const { jobId } = (await (await req('POST', '/plan')).json()) as { jobId: string };
    return job(jobId);
  };
  return { db, req, view, makePlan, provider };
}

describe('격자 구성', () => {
  it('만든 세트가 9개 미만이면 만든 표지(최신순) 뒤를 계획 칸으로, 그래도 남으면 빈칸', () => {
    const made = [
      { id: 7, cover: '최근 표지', createdAt: '2026-10-21 10:00:00' },
      { id: 3, cover: '이전 표지', createdAt: '2026-10-20 10:00:00' },
    ];
    const plan = Array.from({ length: 5 }, (_, i) => ({ title: `계획 ${i}`, pillarId: 'x', locked: false, origin: 'ai' as const }));
    const g = composeGrid(made, plan, new Map([['x', '축 X']]), 9);
    expect(g.map((c) => c.kind)).toEqual(['made', 'made', 'plan', 'plan', 'plan', 'plan', 'plan', 'empty', 'empty']);
    expect(g[0]).toMatchObject({ kind: 'made', setId: 7 });
    expect(g[2]).toMatchObject({ kind: 'plan', slot: 0, title: '계획 0', pillarName: '축 X' });
  });

  it('만든 세트가 9개를 넘으면 최신 9개만 — 계획 칸은 없다', () => {
    const made = Array.from({ length: 11 }, (_, i) => ({ id: 20 - i, cover: `표지 ${i}`, createdAt: '' }));
    const g = composeGrid(made, [{ title: '계획', pillarId: 'x', locked: false, origin: 'ai' }], new Map(), 9);
    expect(g.every((c) => c.kind === 'made')).toBe(true);
    expect(g).toHaveLength(9);
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
    expect(v.cells[1]).toMatchObject({ title: '제목 나', pillarName: '만든 것', locked: false, origin: 'ai' });
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

  it('칸을 고치고 고정하면, 다시 만들어도 고정한 칸은 그대로다', async () => {
    const t = setup([{ structured: nine() }, { structured: nine('새') }]);
    await t.makePlan();
    expect((await t.req('PUT', '/plan/2', { title: '내가 쓴 제목', locked: true })).status).toBe(200);
    let v = await t.view();
    expect(v.cells[2]).toMatchObject({ title: '내가 쓴 제목', locked: true, origin: 'edit' });
    await t.makePlan();
    v = await t.view();
    expect(v.cells[2]).toMatchObject({ title: '내가 쓴 제목', locked: true, origin: 'edit' });
    expect(v.cells[0]).toMatchObject({ title: '새 가', locked: false });
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
