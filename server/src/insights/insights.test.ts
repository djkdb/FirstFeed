// 성과 분석(FR-IN-2~6 · 결정 2026-11-22) — 48시간 · 빈 값 · 표본 부족 · 잇기 후보 · 제안 규칙 · 수락 → 프로필 새 판 · 만료 · API
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider, type FakeStep } from '../ai/testing/fake-provider.ts';
import { env } from '../config.ts';
import { openDb } from '../db/index.ts';
import { markPosted, linkSet } from '../home/store.ts';
import { profileForGeneration } from '../identity/for-generation.ts';
import { text } from '../identity/model.ts';
import { activeProfile, createSession, saveProfileVersion } from '../identity/store.ts';
import { savePlan } from '../preview/plan.ts';
import { saveCaption } from '../publish/store.ts';
import { fixTemplate } from '../templates/store.ts';
import { analyze, insightTable, rate, titleType, type SetInfo } from './analyze.ts';
import { linkCandidates } from './match.ts';
import { insightsView } from './service.ts';
import { addManual, latestSuggestionBatch, linkPost, listPosts, recordSuggestionRun, saveSuggestions, upsertFetched, type InsightPost } from './store.ts';
import { acceptSuggestion, rejectSuggestion, suggestRules, type SuggestOut } from './suggest.ts';
import type { FetchedPost } from './metricool/tools.ts';

const NOW = Date.parse('2026-11-22T00:00:00Z');
const H = { 'content-type': 'application/json' };
const PA = 'a'.repeat(16);
const PB = 'b'.repeat(16);
const P = (id: string, name: string) => ({ id, name, description: name, evidence: [], origin: 'interview' as const, expiresAt: null });

function setup(steps: FakeStep[] = []) {
  const db = openDb(':memory:');
  const pid = saveProfileVersion(
    db,
    1,
    { accountLine: '계정', accountLineOrigin: 'interview', audience: '누구', audienceOrigin: 'interview', pillars: [P(PA, '써 본 도구'), P(PB, '만든 것')], dropped: [], voiceRules: [text('쉽게', 'interview')], avoid: [], unknown: [], presence: null },
    { reason: 'interview', sessionId: createSession(db, 1, {}), basedOn: null, jobId: null, activate: true },
  );
  const look = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/real/brands/me.json'), 'utf8')).look;
  const tv = fixTemplate(db, 1, 'A', look, {}, 'test', null);
  const madeSet = (headline: string, pillar: string | null) => {
    const src = Number(db.prepare("INSERT INTO sources (brand_id, body) VALUES (1, '원문')").run().lastInsertRowid);
    const set = Number(db.prepare('INSERT INTO card_sets (brand_id, source_id, profile_id, template_version_id, pillar_id, body_count) VALUES (1, ?, ?, ?, ?, 1)').run(src, pid, tv, pillar).lastInsertRowid);
    db.prepare("INSERT INTO cards (set_id, idx, kind, content_json, png_file, render_json) VALUES (?, 0, 'cover', ?, '01-cover.png', '{}')").run(set, JSON.stringify({ headline }));
    return set;
  };
  const provider = new FakeProvider(steps);
  const ai = new AiService({ db, provider });
  return { db, ai, provider, pid, madeSet };
}

const post = (id: string, day: number, o: Partial<FetchedPost> = {}): FetchedPost => ({
  externalId: id,
  url: null,
  type: 'FEED_CAROUSEL_ALBUM',
  publishedAt: `2026-11-${String(day).padStart(2, '0')}T03:00:00.000Z`,
  content: null,
  reach: 100,
  saved: 10,
  shares: 2,
  views: null,
  likes: null,
  comments: null,
  ...o,
});

const base = (o: Partial<InsightPost>): InsightPost => ({
  id: 1,
  source: 'metricool',
  externalId: 'x',
  url: null,
  type: 'FEED_IMAGE',
  publishedAt: '2026-11-01T00:00:00.000Z',
  content: null,
  reach: 100,
  saved: 5,
  shares: 1,
  views: null,
  likes: null,
  comments: null,
  fetchedAt: null,
  setId: null,
  ...o,
});
const OPTS = { now: NOW, matureHours: 48, minSamples: 3, sets: new Map<number, SetInfo>(), pillarNames: new Map<string, string>() };

describe('분석 계산 (FR-IN-3 · 4)', () => {
  it('48시간이 안 지난 게시물 · 게시 시각을 모르는 게시물은 분석에 안 쓴다(집계 중)', () => {
    const r = analyze([base({ id: 1, publishedAt: '2026-11-20T01:00:00.000Z' }), base({ id: 2, publishedAt: '2026-11-19T23:59:00.000Z' }), base({ id: 3, publishedAt: null })], OPTS);
    expect(r.posts.map((p) => p.mature)).toEqual([false, true, false]);
    expect(r.groups.find((g) => g.key === 'format:FEED_IMAGE')!.n).toBe(1);
  });

  it('비율: 분자나 도달이 비었거나 도달 0 이면 null(0 으로 치지 않는다) — 평균에서도 빠진다', () => {
    expect([rate(5, 100), rate(null, 100), rate(5, null), rate(5, 0), rate(0, 50)]).toEqual([0.05, null, null, null, 0]);
    const r = analyze(
      [base({ id: 1, saved: 10 }), base({ id: 2, saved: 20 }), base({ id: 3, saved: null }), base({ id: 4, reach: null }), base({ id: 5, saved: 30 })],
      OPTS,
    );
    const g = r.groups[0]!;
    expect(g.n).toBe(5);
    expect(g.saveRate).toMatchObject({ n: 3, enough: true, formatted: '20.0%' });
    expect(g.shareRate).toMatchObject({ n: 4, enough: true });
  });

  it('값 있는 표본이 3개 미만이면 표본 부족 — 값을 글로 내지 않는다 · 표에서도 빠진다', () => {
    const r = analyze([base({ id: 1 }), base({ id: 2, shares: null })], OPTS);
    expect(r.groups[0]!.saveRate).toMatchObject({ n: 2, enough: false, formatted: null });
    expect(insightTable(r.groups).rows).toEqual([]);
  });

  it('축 · 제목 유형은 이은 세트가 있을 때만, 잇지 않은 게시물은 형식에만', () => {
    const sets = new Map<number, SetInfo>([[9, { title: '**클로드**로 뭘 할 수 있을까?', pillarId: PA }]]);
    const r = analyze([base({ id: 1, setId: 9 }), base({ id: 2 })], { ...OPTS, sets, pillarNames: new Map([[PA, '써 본 도구']]) });
    expect(r.groups.map((g) => [g.key, g.n])).toEqual([
      [`pillar:${PA}`, 1],
      ['format:FEED_IMAGE', 2],
      ['title:question', 1],
    ]);
    expect(r.posts[0]).toMatchObject({ title: '클로드로 뭘 할 수 있을까?', titleType: 'question' });
  });

  it('제목 유형(첫 판): 질문형 먼저 → 숫자형 → 그 외', () => {
    expect(['뭘 할 수 있을까', '이거 써 봤나요?', '어디서 사나요', '3분 만에 끝내기', '다섯 가지 습관', '질문 3개?'].map(titleType)).toEqual(['question', 'question', 'other', 'number', 'other', 'question']);
    // 「…나요 · …가요」 평서문은 질문형이 아니다 · 「…까 · …까요」는 「?」 없이도 질문형 · 전각 「？」 · 전각 숫자도 센다
    expect(['주말에 놀러 가요', '자꾸 생각나요', '오늘 뭐 할까', '이걸로 될까요', '될까요!', '이거 맞아요？', '하루 １번'].map(titleType)).toEqual([
      'other',
      'other',
      'question',
      'question',
      'question',
      'question',
      'number',
    ]);
  });
});

describe('잇기 후보 (자동으로 잇지 않는다)', () => {
  it('「올렸어요」 날짜 앞뒤 범위 안 · 잇지 않은 Metricool 게시물 · 제목/캡션이 겹치는 것이 위로 · 「아니에요」 한 짝은 빠진다', () => {
    const posts = [
      base({ id: 1, publishedAt: '2026-11-10T03:00:00.000Z', content: '오늘은 클로드 코드 스킬 정리' }),
      base({ id: 2, publishedAt: '2026-11-11T03:00:00.000Z', content: '전혀 다른 이야기' }),
      base({ id: 3, publishedAt: '2026-11-20T03:00:00.000Z', content: '클로드 코드 스킬' }), // 범위 밖
      base({ id: 4, publishedAt: '2026-11-10T03:00:00.000Z', content: '클로드 코드 스킬', source: 'manual' }), // 직접 입력은 후보 아님
    ];
    const sets = [{ setId: 9, postedAt: '2026-11-10', title: '**클로드 코드** 스킬', caption: null }];
    const r = linkCandidates(sets, posts, { windowDays: 3, rejected: new Set(), toLocalDate: (iso) => iso.slice(0, 10) });
    expect(r[0]!.candidates.map((c) => c.postId)).toEqual([1, 2]);
    expect(r[0]!.candidates[0]!.score).toBeGreaterThan(r[0]!.candidates[1]!.score);
    const r2 = linkCandidates(sets, posts, { windowDays: 3, rejected: new Set(['1:9']), toLocalDate: (iso) => iso.slice(0, 10) });
    expect(r2[0]!.candidates.map((c) => c.postId)).toEqual([2]);
    // 이미 이은 세트는 후보를 내지 않는다
    expect(linkCandidates(sets, [...posts, base({ id: 5, setId: 9 })], { windowDays: 3, rejected: new Set(), toLocalDate: (iso) => iso.slice(0, 10) })).toEqual([]);
  });
});

/** 축 A(저장 많음) 3개 · 축 B(저장 적음) 3개, 모두 캐러셀 */
function seeded(steps: FakeStep[] = []) {
  const s = setup(steps);
  const ids: number[] = [];
  for (let i = 0; i < 6; i++) ids.push(s.madeSet(i < 3 ? `질문 제목 ${i}일까` : `그냥 제목`, i < 3 ? PA : PB));
  upsertFetched(
    s.db,
    1,
    ids.map((_, i) => post(`p${i}`, i + 1, { reach: 100, saved: i < 3 ? 12 : 3 })),
    '2026-11-21T00:00:00.000Z',
  );
  const posts = listPosts(s.db, 1).sort((a, b) => a.externalId.localeCompare(b.externalId));
  posts.forEach((p, i) => linkPost(s.db, 1, p.id, ids[i]!));
  return { ...s, ids };
}

const good = (): SuggestOut => ({
  suggestions: [{ kind: 'more', groupKey: `pillar:${PA}`, text: '써 본 도구 축의 저장률이 12.0%로 더 높아요.', rule: '써 본 도구 이야기를 더 쓴다', evidence: [{ groupKey: `pillar:${PA}`, metric: 'saveRate', value: '12.0%' }] }],
});

describe('제안 코드 규칙 (FR-IN-5)', () => {
  const ctx = () => {
    const { db } = seeded();
    const { groups } = analyzeFrom(db);
    const t = insightTable(groups);
    return { groups, table: t.rows, grounding: t.grounding, max: 3, maxChars: 80, ruleMaxChars: 80, commonTerms: ['DM'] };
  };
  const analyzeFrom = (db: ReturnType<typeof setup>['db']) => {
    const v = insightsView(db, 1, NOW);
    return { groups: v.groups };
  };
  const codes = (d: SuggestOut) => suggestRules(ctx()).flatMap((r) => r(d)).map((i) => i.code);
  const tweak = (f: (s: SuggestOut['suggestions'][number]) => void) => {
    const d = good();
    f(d.suggestions[0]!);
    return d;
  };

  it('표의 값 그대로 인용하면 통과', () => {
    expect(codes(good())).toEqual([]);
  });
  it('표에 없는 묶음 · 표본 부족 묶음', () => {
    expect(codes(tweak((s) => ((s.groupKey = 'pillar:zzz'), (s.evidence[0]!.groupKey = 'pillar:zzz'))))).toContain('group_not_in_table');
    // 형식 묶음을 3개 미만으로 — 직접 입력 영상 2개
    const c = ctx();
    const small = { ...c, groups: [...c.groups, { key: 'format:FEED_VIDEO', dim: 'format' as const, label: '영상', n: 2, saveRate: { value: 0.1, formatted: null, n: 2, enough: false }, shareRate: { value: null, formatted: null, n: 0, enough: false } }] };
    const d = tweak((s) => ((s.groupKey = 'format:FEED_VIDEO'), (s.evidence[0]!.groupKey = 'format:FEED_VIDEO')));
    expect(suggestRules(small).flatMap((r) => r(d)).map((i) => i.code)).toContain('group_too_small');
  });
  it('표와 다른 값 · 근거에 대상 묶음 없음 · 값 없는 지표', () => {
    expect(codes(tweak((s) => (s.evidence[0]!.value = '13.0%')))).toContain('evidence_value_mismatch');
    // 「12.0%」 를 「12%」 로 줄여 쓴 것은 같은 값(2026-11-24 — 뜻이 같은데 재작성을 쓰지 않게)
    expect(codes(tweak((s) => (s.evidence[0]!.value = '12%')))).not.toContain('evidence_value_mismatch');
    expect(codes(tweak((s) => (s.evidence[0]!.groupKey = 'format:FEED_CAROUSEL_ALBUM')))).toContain('evidence_missing_group');
  });
  it('문장에 표에 없는 숫자 · 영문, 규칙 문장에 숫자 · 길이 · 개수', () => {
    expect(codes(tweak((s) => (s.text = '저장률이 15.5%로 높아요.')))).toContain('number_not_in_table');
    expect(codes(tweak((s) => (s.text = 'Threads 처럼 쓰면 저장률 12.0%')))).toContain('english_not_in_table');
    expect(codes(tweak((s) => (s.rule = '한 주에 3개 더 쓴다')))).toContain('rule_has_number');
    expect(codes(tweak((s) => (s.text = '가'.repeat(81))))).toContain('text_too_long');
    const many = { suggestions: [0, 1, 2, 3].map(() => good().suggestions[0]!) };
    expect(codes(many)).toContain('too_many_suggestions');
  });
});

describe('수락 → 프로필 새 판 · 만료 (FR-IN-6)', () => {
  it('수락하면 출처 insight · 만료일 21일 뒤 항목을 더한 새 판(바로 적용) · 만료 뒤에는 생성 입력에서 빠진다 · 넘기기는 기록만', () => {
    const { db, pid } = seeded();
    saveSuggestions(
      db,
      1,
      'job-1',
      [
        { kind: 'more', groupKey: `pillar:${PA}`, text: 't', rule: '질문으로 끝나는 제목을 더 쓴다', evidence: [] },
        { kind: 'less', groupKey: `pillar:${PB}`, text: 't', rule: '만든 것 소개는 줄인다', evidence: [] },
      ],
      [],
    );
    const [a, b] = insightsView(db, 1, NOW).suggestions;
    const r = acceptSuggestion(db, 1, a!.id, NOW);
    expect(r.expiresAt).toBe('2026-12-13T00:00:00.000Z');
    const p = activeProfile(db, 1)!;
    expect(p).toMatchObject({ reason: 'insight', basedOn: pid });
    expect(p.voiceRules.at(-1)).toEqual({ text: '질문으로 끝나는 제목을 더 쓴다', origin: 'insight', expiresAt: '2026-12-13T00:00:00.000Z' });
    expect(profileForGeneration(db, 1, NOW).voiceRules).toContain('질문으로 끝나는 제목을 더 쓴다');
    expect(profileForGeneration(db, 1, Date.parse('2026-12-13T00:00:01Z')).voiceRules).toEqual(['쉽게']);
    expect(() => acceptSuggestion(db, 1, a!.id, NOW)).toThrow(/이미 반영했거나/);
    rejectSuggestion(db, 1, b!.id);
    expect(activeProfile(db, 1)!.avoid).toEqual([]);
    const v = insightsView(db, 1, Date.parse('2026-12-14T00:00:00Z'));
    expect(v.accepted).toHaveLength(1);
    expect(v.accepted[0]).toMatchObject({ expired: true, inProfile: false });
  });
});

describe('성과 API', () => {
  it('연결 상태 · 잘못된 state 의 돌아온 창은 오류 페이지 · Metricool 숫자는 직접 못 고침 · 직접 입력의 빈 칸은 null', async () => {
    const { db, ai, madeSet } = setup();
    const app = createApp({ db, ai, metricoolFetch: async () => new Response('막음', { status: 599 }) });
    expect(await (await app.request('/api/insights/metricool', { headers: { host: '127.0.0.1:4317' } })).json()).toMatchObject({ connected: false, scope: 'mcp:read' });
    const cb = await app.request('/api/insights/metricool/callback?code=x&state=nope', { headers: { host: '127.0.0.1:4317' } });
    expect(cb.status).toBe(400);
    const html = await cb.text();
    expect(html).toContain('Metricool 을 연결하지 못했어요');
    expect(html).toContain('「연결」을 다시 누르세요');
    const denied = await app.request('/api/insights/metricool/callback?error=%3Cscript%3E', { headers: { host: '127.0.0.1:4317' } });
    expect(await denied.text()).not.toContain('<script>');

    const r = await app.request('/api/insights/posts', {
      method: 'POST',
      headers: { ...H, host: '127.0.0.1:4317' },
      body: JSON.stringify({ publishedAt: '2026-11-01T09:00:00+09:00', type: 'FEED_IMAGE', url: '', content: null, reach: 120, saved: null, shares: 0, views: null, likes: null, comments: null }),
    });
    const v = (await r.json()) as { posts: Array<{ id: number; source: string; saved: number | null; shares: number | null; saveRate: number | null; shareRate: number | null; publishedAt: string }> };
    expect(v.posts[0]).toMatchObject({ source: 'manual', saved: null, shares: 0, saveRate: null, shareRate: 0, publishedAt: '2026-11-01T00:00:00.000Z' });
    const bad = await app.request('/api/insights/posts', { method: 'POST', headers: { ...H, host: '127.0.0.1:4317' }, body: JSON.stringify({ publishedAt: '어제', reach: -1 }) });
    expect(bad.status).toBe(400);

    upsertFetched(db, 1, [post('m1', 3)], '2026-11-21T00:00:00.000Z');
    const m1 = listPosts(db, 1).find((p) => p.externalId === 'm1')!;
    const edit = await app.request(`/api/insights/posts/${m1.id}`, { method: 'DELETE', headers: { host: '127.0.0.1:4317' } });
    expect(edit.status).toBe(400);
    // 한 세트는 게시물 하나에만
    const s = madeSet('제목', PA);
    linkPost(db, 1, m1.id, s);
    const twice = await app.request(`/api/insights/posts/${v.posts[0]!.id}/link`, { method: 'PUT', headers: { ...H, host: '127.0.0.1:4317' }, body: JSON.stringify({ setId: s }) });
    expect(twice.status).toBe(400);
    // 브라우저 연결이 안 되면 다음 할 일과 함께 400
    const conn = await app.request('/api/insights/metricool/connect', { method: 'POST', headers: { host: '127.0.0.1:4317' } });
    expect(conn.status).toBe(400);
  });

  it('홈에서 「올렸어요」 한 세트는 잇기 후보로 나오고, 맞아요 → 이어진다 · 아니에요 → 다시 안 나온다', async () => {
    const { db, ai, pid, madeSet } = setup();
    savePlan(db, 1, pid, [{ title: '첫 칸', pillarId: PA, locked: false, origin: 'ai' }], null);
    const s = madeSet('클로드 코드 스킬 정리', null);
    saveCaption(db, { setId: s, hook: '클로드 코드 스킬 정리', lines: ['한 줄'], hashtags: [], glosses: [], edited: false }, null);
    linkSet(db, 1, 0, s);
    markPosted(db, 1, 0, '2026-11-10');
    upsertFetched(db, 1, [post('m1', 10, { content: '클로드 코드 스킬 정리 한 줄' }), post('m2', 11, { content: '다른 글' })], '2026-11-21T00:00:00.000Z');
    const app = createApp({ db, ai });
    const get = async () => (await (await app.request('/api/insights', { headers: { host: '127.0.0.1:4317' } })).json()) as ReturnType<typeof insightsView>;
    const v = await get();
    expect(v.candidates).toHaveLength(1);
    const [top, second] = v.candidates[0]!.candidates;
    expect(v.posts.find((p) => p.id === top!.postId)!.externalId).toBe('m1');
    await app.request('/api/insights/candidates/reject', { method: 'POST', headers: { ...H, host: '127.0.0.1:4317' }, body: JSON.stringify({ postId: second!.postId, setId: s }) });
    expect((await get()).candidates[0]!.candidates.map((c) => c.postId)).toEqual([top!.postId]);
    await app.request(`/api/insights/posts/${top!.postId}/link`, { method: 'PUT', headers: { ...H, host: '127.0.0.1:4317' }, body: JSON.stringify({ setId: s }) });
    const after = await get();
    expect(after.candidates).toEqual([]);
    // 세트에 축이 없으면 홈에서 이은 계획 칸의 축
    expect(after.posts.find((p) => p.id === top!.postId)).toMatchObject({ setId: s, pillarId: PA });
  });

  it('제안 작업: 표 + 프로필만 보이고, 규칙을 통과한 제안만 저장한다 · 결론 낼 묶음이 없으면 AI 를 부르지 않는다', async () => {
    const empty = setup();
    addManual(empty.db, 1, { publishedAt: '2026-11-01T00:00:00.000Z', type: 'FEED_IMAGE', url: null, content: null, reach: 10, saved: 1, shares: 1, views: null, likes: null, comments: null });
    const app0 = createApp({ db: empty.db, ai: empty.ai });
    const j0 = (await (await app0.request('/api/insights/suggest', { method: 'POST', headers: { host: '127.0.0.1:4317' } })).json()) as { jobId: string };
    await new Promise((r) => setTimeout(r, 20));
    const s0 = (await (await app0.request(`/api/ai/jobs/${j0.jobId}`, { headers: { host: '127.0.0.1:4317' } })).json()) as { result: { status: string } };
    expect(s0.result.status).toBe('not_enough');
    expect(empty.provider.calls).toHaveLength(0);

    const badOut = tweakOut((s) => (s.evidence[0]!.value = '99.9%'));
    const { db, ai, provider } = seeded([{ structured: badOut }, { structured: good() }, { structured: { issues: [] } }]);
    const app = createApp({ db, ai });
    const { jobId } = (await (await app.request('/api/insights/suggest', { method: 'POST', headers: { host: '127.0.0.1:4317' } })).json()) as { jobId: string };
    for (let i = 0; i < 50; i++) {
      const s = (await (await app.request(`/api/ai/jobs/${jobId}`, { headers: { host: '127.0.0.1:4317' } })).json()) as { phase: string };
      if (s.phase !== 'running') break;
      await new Promise((r) => setTimeout(r, 20));
    }
    const prompt = provider.calls[0]!.prompt;
    expect(prompt).toContain(`[pillar:${PA}]`);
    expect(prompt).toContain('12.0%');
    expect(prompt).not.toContain('p0'); // 게시물 ID · 원문은 보이지 않는다
    expect(provider.calls[1]!.prompt).toContain('99.9%'); // 재작성 이유에 걸린 값
    const v = insightsView(db, 1, NOW);
    expect(v.suggestions).toHaveLength(1);
    expect(v.suggestions[0]).toMatchObject({ status: 'pending', rule: '써 본 도구 이야기를 더 쓴다' });
  });
});

function tweakOut(f: (s: SuggestOut['suggestions'][number]) => void): SuggestOut {
  const d = good();
  f(d.suggestions[0]!);
  return d;
}

describe('제안 묶음 — 가장 최근 받기만 (2026-11-24 코드 리뷰)', () => {
  const item = (rule: string) => ({ kind: 'more' as const, groupKey: `pillar:${PA}`, text: 't', rule, evidence: [] });
  it('0개로 끝난 받기 뒤에는 그 전 제안이 보이지 않고, API 로 수락 · 넘기기도 거절한다(다음 할 일과 함께)', async () => {
    const { db, ai } = seeded();
    saveSuggestions(db, 1, 'job-1', [item('질문으로 끝나는 제목을 더 쓴다'), item('써 본 도구 이야기를 더 쓴다')], []);
    const [a, b] = insightsView(db, 1, NOW).suggestions;
    expect(a).toMatchObject({ jobId: 'job-1', status: 'pending' });
    saveSuggestions(db, 1, 'job-2', [], []);
    expect(latestSuggestionBatch(db, 1)).toMatchObject({ jobId: 'job-2', count: 0 });
    expect(insightsView(db, 1, NOW).suggestions).toEqual([]);
    const app = createApp({ db, ai });
    for (const [id, act] of [
      [a!.id, 'accept'],
      [b!.id, 'reject'],
    ] as const) {
      const r = await app.request(`/api/insights/suggestions/${id}/${act}`, { method: 'POST', headers: { host: '127.0.0.1:4317' } });
      expect(r.status).toBe(400);
      expect(((await r.json()) as { error: string }).error).toMatch(/지난번에 받은 제안이라.*가장 최근에 받은 제안에서 고르세요/);
    }
    expect(activeProfile(db, 1)!.reason).toBe('interview');
    // 새로 받은 묶음은 그대로 고를 수 있다
    saveSuggestions(db, 1, 'job-3', [item('만든 것 소개를 더 쓴다')], []);
    const [c] = insightsView(db, 1, NOW).suggestions;
    const ok = await app.request(`/api/insights/suggestions/${c!.id}/accept`, { method: 'POST', headers: { host: '127.0.0.1:4317' } });
    expect(ok.status).toBe(200);
    expect(activeProfile(db, 1)!.voiceRules.at(-1)!.text).toBe('만든 것 소개를 더 쓴다');
    // 제안을 저장하지 않고 끝난 받기도 빈 묶음으로 남길 수 있다
    recordSuggestionRun(db, 1, null);
    expect(insightsView(db, 1, NOW).suggestions).toEqual([]);
  });

  it('없는 제안은 지금처럼 「찾지 못했어요」', async () => {
    const { db, ai } = seeded();
    const r = await createApp({ db, ai }).request('/api/insights/suggestions/999/accept', { method: 'POST', headers: { host: '127.0.0.1:4317' } });
    expect(((await r.json()) as { error: string }).error).toMatch(/찾지 못했어요/);
  });
});
