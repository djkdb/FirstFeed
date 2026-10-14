// 정체성 흐름 전체를 HTTP 로: 설문 → 인터뷰 → 프로필 → 확정 (가짜 공급자)
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { openDb } from '../db/index.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider, type FakeStep } from '../ai/testing/fake-provider.ts';
import { setSetting } from '../config.ts';
import type { JobState } from '../ai/jobs.ts';
import type { SessionState } from './store.ts';

const H = { host: 'localhost:4317', 'content-type': 'application/json' };
type Body = { state: SessionState; minTurns: number; maxTurns: number };

const SURVEY = {
  S1: { choices: ['대학생'], text: '소프트웨어학부 재학 중' },
  S2: { choices: ['IT·AI', '개발'], other: '바이브코딩' },
  S3: { choices: ['포트폴리오'] },
  S4: { choices: ['정보 정리', '만든 것'] },
  S5: { choices: ['4~5'] },
  S6: { choices: ['안 한다'], text: '직접 만든 캐릭터로 대신한다' },
};

const q = (question: string, ready = false, examples = ['예시 답 하나입니다', '전혀 다른 방향의 예시']) => ({
  structured: { question, why: '이유', examples, options: [], target: '빈칸', ready_for_profile: ready },
});

function setup(steps: FakeStep[]) {
  const db = openDb(':memory:');
  const app = createApp({ db, ai: new AiService({ db, provider: new FakeProvider(steps) }) });
  const post = async (path: string, body?: unknown) => app.request(`/api/identity${path}`, { method: 'POST', headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
  const job = async (jobId: string): Promise<JobState> => {
    for (let i = 0; i < 200; i++) {
      const s = (await (await app.request(`/api/ai/jobs/${jobId}`, { headers: H })).json()) as JobState;
      if (s.phase !== 'running') return s;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error('작업이 끝나지 않음');
  };
  const next = async (id: number) => job(((await (await post(`/sessions/${id}/next`)).json()) as { jobId: string }).jobId);
  const answer = async (id: number, turnNo: number, text: string, unknown = false) =>
    (await (await post(`/sessions/${id}/answer`, { turnNo, answer: text, unknown })).json()) as Body;
  return { db, app, post, job, next, answer };
}

const ANSWERS = [
  '써 보고 알게 된 걸 정리해 두면 나 같은 학생한테 도움이 되겠다 싶었다',
  '발표 원문이나 공식 문서를 직접 보고 써 본 것만 쓴다',
  '본 그날 바로 다르게 해 볼 수 있는 것 하나',
];
const ev = (quote: string, source: string) => [{ quote, source }];
const PROFILE = {
  account_line: '학생을 위한 AI 도구 실전 정리',
  audience: 'AI 도구를 막 쓰기 시작한 대학생',
  pillars: [
    { name: '써 본 것만', description: '직접 써 본 도구의 후기', evidence: ev('써 보고 알게 된 걸 정리해 두면', 'A1') },
    { name: '원문 확인', description: '발표 원문과 공식 문서로 확인한 소식', evidence: ev('발표 원문이나 공식 문서를 직접 보고', 'A2') },
    { name: '오늘 바로', description: '그날 바로 해 볼 수 있는 팁 하나', evidence: ev('본 그날 바로 다르게 해 볼 수 있는 것 하나', 'A3') },
  ],
  voice_rules: ['쉽게', '짧게', '확인한 것만'],
  avoid: ['과장된 제목'],
  unknown: [],
};

describe('정체성 흐름 API', () => {
  it('설문 → 인터뷰 3턴 → 프로필 → 확정', async () => {
    const t = setup([
      q('계정을 시작하게 된 계기는 무엇인가요?', true), // 1턴: 충분하다고 해도 최소 3턴 전이라 무시
      q('남과 다르게 하는 점이 있다면 무엇인가요?'),
      q('본 사람이 무엇을 얻어 갔으면 하나요?', true), // 3턴째 질문을 만들 때는 답 2개 → 아직 무시
      q('혹시 더 보여 주고 싶은 작업이 있나요?', true), // 답 3개 뒤 → ready
      { structured: PROFILE },
      { structured: { issues: [] } },
    ]);
    const start = (await (await t.post('/sessions', { survey: SURVEY })).json()) as Body;
    const id = start.state.id;
    expect(start.state.status).toBe('interview');

    for (let i = 0; i < 3; i++) {
      const j = await t.next(id);
      expect(j.result).toMatchObject({ kind: 'asked', readyForProfile: false });
      await t.answer(id, i + 1, ANSWERS[i]!);
    }
    const fourth = await t.next(id);
    expect(fourth.result).toMatchObject({ kind: 'asked', readyForProfile: true });

    const p = await t.job(((await (await t.post(`/sessions/${id}/profile`)).json()) as { jobId: string }).jobId);
    expect(p.result).toMatchObject({ outcome: 'saved', salvaged: false });
    const profileId = (p.result as { profileId: number }).profileId;

    const confirm = await t.post(`/profiles/${profileId}/confirm`);
    expect(await confirm.json()).toEqual({ ok: true });
    const cur = (await (await t.app.request('/api/identity/current', { headers: H })).json()) as Body;
    expect(cur.state).toMatchObject({ status: 'profiled', activeProfileId: profileId, profile: { version: 1, pillars: [{ name: '써 본 것만' }, {}, {}] } });
    expect(cur.state.profile!.pillars[0]!.evidence[0]).toMatchObject({ source: 'A1', sourceLabel: '인터뷰 1번 답' });

    // 직접 수정 → 새 판 바로 활성 → 이력 → 되돌리기 → 다시 새 판 바로 활성 (HTTP)
    const before = cur.state.profile!;
    const edit = {
      accountLine: '학생을 위한 Notion·AI 도구 정리',
      audience: before.audience,
      pillars: before.pillars.map((x) => ({ id: x.id, name: x.name, description: x.description })),
      voiceRules: before.voiceRules.map((v) => v.text),
      avoid: before.avoid.map((v) => v.text),
      presence: before.presence?.text ?? null,
    };
    const put = await t.app.request(`/api/identity/profiles/${before.id}`, { method: 'PUT', headers: H, body: JSON.stringify(edit) });
    expect(await put.json()).toMatchObject({ changes: ['계정 소개'] });
    type Hist = { active: { id: number; reason: string; accountLine: string; pillars: Array<{ id: string }> }; versions: Array<{ version: number; reason: string; isActive: boolean }> };
    const h1 = (await (await t.app.request('/api/identity/profiles', { headers: H })).json()) as Hist;
    expect(h1.versions.map((v) => [v.version, v.reason, v.isActive])).toEqual([
      [2, 'edit', true],
      [1, 'interview', false],
    ]);
    expect(h1.active.pillars.map((x) => x.id)).toEqual(before.pillars.map((x) => x.id));
    await t.post(`/profiles/${before.id}/rollback`);
    const h2 = (await (await t.app.request('/api/identity/profiles', { headers: H })).json()) as Hist;
    expect(h2.active).toMatchObject({ reason: 'rollback', accountLine: before.accountLine });
    expect(h2.versions).toHaveLength(3);
  });

  it('예시를 그대로 보낸 답은 example, 고친 답은 text, 모름은 unknown 으로 서버가 판정해 기록한다', async () => {
    const t = setup([q('계정을 시작한 계기는요?'), q('최근에 만든 것 중 자랑하고 싶은 건?', false, ['첫째 예시 문장입니다', '둘째 예시 문장입니다']), q('피하고 싶은 콘텐츠가 있나요?')]);
    const id = ((await (await t.post('/sessions', { survey: SURVEY })).json()) as Body).state.id;
    await t.next(id);
    await t.answer(id, 1, '예시 답 하나입니다'); // 예시 그대로
    await t.next(id);
    await t.answer(id, 2, '첫째 예시 문장입니다. 조금 고쳤어요'); // 고침
    await t.next(id);
    const last = await t.answer(id, 3, '', true);
    expect(last.state.turns.map((x) => x.answerKind)).toEqual(['example', 'text', 'unknown']);
  });

  it('최소 턴 전에는 프로필을 만들 수 없고, 최대 턴이면 AI 를 부르지 않는다', async () => {
    const t = setup([q('계정을 시작한 계기는요?'), q('최근에 만든 것 중 자랑하고 싶은 건?')]);
    setSetting(t.db, 'identity.maxTurns', 2);
    const id = ((await (await t.post('/sessions', { survey: SURVEY })).json()) as Body).state.id;
    await t.next(id);
    await t.answer(id, 1, '첫 답입니다');
    const early = await t.job(((await (await t.post(`/sessions/${id}/profile`)).json()) as { jobId: string }).jobId);
    expect(early).toMatchObject({ phase: 'failed', error: { message: expect.stringMatching(/아직 프로필을 만들 수 없습니다/) } });
    await t.next(id);
    await t.answer(id, 2, '둘째 답입니다');
    expect((await t.next(id)).result).toEqual({ kind: 'limit' }); // 준비된 가짜 응답이 없어도 통과 = AI 를 부르지 않음
  });

  it('설문이 비었거나 형식이 틀리면 무엇을 고치면 되는지 알려 준다', async () => {
    const t = setup([]);
    const r = await t.post('/sessions', { survey: { S1: { choices: ['대학생'] } } });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toMatch(/S2 관심 분야: 답을 골라 주세요/);
  });
});
