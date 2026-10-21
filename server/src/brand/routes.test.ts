// 브랜딩 키트 HTTP: 조회 → 글 후보 생성(작업) → 고르기(바로 저장, 이력) — 가짜 공급자
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { setSetting } from '../config.ts';
import { openDb } from '../db/index.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider, type FakeStep } from '../ai/testing/fake-provider.ts';
import type { JobState } from '../ai/jobs.ts';
import { text, type ProfileContent } from '../identity/model.ts';
import { createSession, saveProfileVersion } from '../identity/store.ts';

const H = { host: 'localhost:4317', 'content-type': 'application/json' };
const c = (value: string) => ({ value, why: '이유' });
const WORDS = {
  handles: ['zun.ai.note', 'zun_tools', 'try.with.zun', 'zun.daily', 'note.zun'].map(c),
  display_names: ['ZUN | AI 도구 정리', '써 보고 정리하는 ZUN', 'AI 도구 일기', 'ZUN 노트', '대학생 AI 정리'].map(c),
  bios: ['AI 도구를 직접 써 보고 정리해요', '캐릭터 ZUN 과 함께 AI 도구 정리', '써 보고 정리한 AI 도구', '대학생이 직접 써 본 AI 도구', 'AI 도구, 써 보고 정리합니다'].map(c),
};

function setup(steps: FakeStep[], withProfile = true) {
  const db = openDb(':memory:');
  if (withProfile) {
    const sid = createSession(db, 1, { S1: { choices: ['대학생'] } });
    const content: ProfileContent = {
      accountLine: '대학생이 써 본 AI 도구 정리',
      accountLineOrigin: 'interview',
      audience: '대학생',
      audienceOrigin: 'interview',
      pillars: [{ id: 'a'.repeat(16), name: '써 보고 정리', description: 'AI 도구를 직접 써 보고 정리', evidence: [], origin: 'interview', expiresAt: null }],
      dropped: [],
      voiceRules: [text('쉽게', 'interview')],
      avoid: [],
      unknown: [],
      presence: { text: '캐릭터 ZUN 으로 대신한다', source: 'S6', origin: 'interview' },
    };
    saveProfileVersion(db, 1, content, { reason: 'interview', sessionId: sid, basedOn: null, jobId: null, activate: true });
  }
  const app = createApp({ db, ai: new AiService({ db, provider: new FakeProvider(steps) }) });
  const req = (method: string, path: string, body?: unknown) =>
    app.request(`/api/brand${path}`, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
  const job = async (jobId: string): Promise<JobState> => {
    for (let i = 0; i < 200; i++) {
      const s = (await (await app.request(`/api/ai/jobs/${jobId}`, { headers: H })).json()) as JobState;
      if (s.phase !== 'running') return s;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error('작업이 끝나지 않음');
  };
  return { db, req, job };
}

describe('브랜딩 키트 API', () => {
  it('글 후보를 만들면 조회에 최신 키트와 만든 프로필 판이 함께 나온다', async () => {
    const t = setup([{ structured: WORDS }, { structured: { issues: [] } }]);
    const { jobId } = (await (await t.req('POST', '/words')).json()) as { jobId: string };
    expect((await t.job(jobId)).phase).toBe('done');
    const b = (await (await t.req('GET', '')).json()) as { activeProfile: { id: number }; words: { profileId: number; candidates: { bios: unknown[] } }; limits: { bioUsable: number } };
    expect(b.words.profileId).toBe(b.activeProfile.id);
    expect(b.words.candidates.bios).toHaveLength(5);
    expect(b.limits.bioUsable).toBe(130);
  });

  it('인스타 글자 수 세는 방식은 확인 전이라 조회에 「확인 대기」(countConfirmed: false)가 실리고, 설정을 켜면 바뀐다 (FR-BR-1)', async () => {
    const t = setup([]);
    const get = async () => ((await (await t.req('GET', '')).json()) as { limits: { countConfirmed: boolean } }).limits.countConfirmed;
    expect(await get()).toBe(false);
    setSetting(t.db, 'brand.instagramCountConfirmed', true);
    expect(await get()).toBe(true);
  });

  it('프로필이 없으면 작업이 실패하고 할 일을 알려 준다', async () => {
    const t = setup([], false);
    const { jobId } = (await (await t.req('POST', '/visual')).json()) as { jobId: string };
    const s = await t.job(jobId);
    expect(s.phase).toBe('failed');
    expect(s.error?.hint).toContain('「정체성」');
  });

  it('고르면 바로 저장되고, 바뀐 칸만 덮어써 이력이 쌓인다', async () => {
    const t = setup([]);
    expect((await t.req('PUT', '/selection', { handle: 'zun.ai.note' })).status).toBe(200);
    expect((await t.req('PUT', '/selection', { titleFont: 'paperlogy', bodyFont: 'pretendard' })).status).toBe(200);
    const b = (await (await t.req('GET', '')).json()) as { selection: { handle: string; titleFont: string }; history: Array<{ changed: string }> };
    expect(b.selection).toMatchObject({ handle: 'zun.ai.note', titleFont: 'paperlogy' });
    expect(b.history.map((h) => h.changed)).toEqual(['titleFont,bodyFont', 'handle']);
  });

  it('고친 글도 고정 규칙(아이디 규칙·바이오 상한·주소·명암비·폰트 목록)에 걸리면 저장하지 않는다', async () => {
    const t = setup([]);
    const err = async (body: unknown) => ((await (await t.req('PUT', '/selection', body)).json()) as { error: string }).error;
    expect(await err({ handle: 'ZUN..AI' })).toMatch(/아이디: 영문 소문자.*아이디: 마침표를 연달아/);
    expect(await err({ bio: '가'.repeat(131) })).toContain('130자');
    expect(await err({ bio: '모음은 linktr.ee/zun' })).toContain('링크 칸');
    expect(await err({ palette: { name: '흐림', colors: { primary: '#000000', secondary: '#000000', accent: '#000000', background: '#ffffff', text: '#aaaaaa' }, why: '' } })).toContain('명암비');
    expect(await err({ titleFont: 'gowun-dodum' })).toContain('제목용이 아닙니다');
    expect(await err({ bodyFont: 'comic-sans' })).toContain('목록에 없는');
    expect(await err({})).toContain('바뀐 것이 없습니다');
  });
});
