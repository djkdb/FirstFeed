// 30일 뒤 내 계정 미리보기 (FR-BR-6 · 결정 2026-10-21) — 격자 구성 · 계획 칸 고치기·고정 · 다시 만들 때 고정 유지 · 근거 규칙
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { AiService } from '../ai/adapter.ts';
import type { JobState } from '../ai/jobs.ts';
import { FakeProvider, type FakeStep } from '../ai/testing/fake-provider.ts';
import { env } from '../config.ts';
import { openDb } from '../db/index.ts';
import { text, type ProfileContent } from '../identity/model.ts';
import { createSession, saveProfileVersion } from '../identity/store.ts';
import { fixTemplate } from '../templates/store.ts';
import type { BrandLook } from '../templates/types.ts';
import { composeGrid } from './routes.ts';

const H = { host: 'localhost:4317', 'content-type': 'application/json' };
const P = (id: string, name: string) => ({ id, name, description: `${name} 이야기`, evidence: [], origin: 'interview' as const, expiresAt: null });
const PILLARS = [P('a'.repeat(16), '써 본 도구'), P('b'.repeat(16), '만든 것'), P('c'.repeat(16), '활동 기록')];
const look: BrandLook = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/real/brands/me.json'), 'utf8')).look;

/** 축을 돌아가며 9개 — 숫자 없이 */
const nine = (prefix = '제목') => ({ titles: Array.from({ length: 9 }, (_, i) => ({ title: `${prefix} ${'가나다라마바사아자'[i]}`, pillar_id: PILLARS[i % 3]!.id })) });

function setup(steps: FakeStep[], opts: { template?: boolean } = {}) {
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
  if (opts.template !== false) fixTemplate(db, 1, 'A', look, { cover: { headline: { charsPerLine: 9, maxLines: 2, maxChars: null } } }, 'playwright-chromium 156', null);
  const app = createApp({ db, ai: new AiService({ db, provider: new FakeProvider(steps) }) });
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
  return { db, req, view, makePlan };
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
