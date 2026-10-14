import { describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider, type FakeStep } from '../ai/testing/fake-provider.ts';
import { text, type ProfileContent } from '../identity/model.ts';
import { addAnsweredTurn, createSession, saveProfileVersion } from '../identity/store.ts';
import { latestKit } from './store.ts';
import type { WordsCandidates } from './types.ts';
import { enoughAfterDropping, generateWords, pickCandidates, wordsRules, type WordsOutput } from './words.ts';

const limits = { handleMax: 30, nameMax: 30, bioMax: 130 };
const allowed = ['AI 도구를 직접 써 보고 정리', '대학생', '캐릭터 ZUN 으로 대신한다', '문의는 @zun.studio'];
const c = (value: string) => ({ value, why: '이유' });
const base: WordsOutput = {
  handles: ['zun.ai.note', 'zun_tools', 'try.with.zun', 'zun.daily', 'note.zun', 'zun.lab'].map(c),
  display_names: ['ZUN | AI 도구 정리', '써 보고 정리하는 ZUN', 'AI 도구 일기', 'ZUN 노트', '대학생 AI 정리', 'ZUN 의 도구함'].map(c),
  bios: [
    'AI 도구를 직접 써 보고 정리해요 · 대학생 눈높이',
    '캐릭터 ZUN 과 함께 AI 도구 정리',
    '써 보고 정리한 AI 도구 · 대학생용',
    '대학생이 직접 써 본 AI 도구',
    'AI 도구, 써 보고 정리합니다',
    'ZUN 이 써 본 AI 도구 정리',
  ].map(c),
};
const codes = (d: WordsOutput) => wordsRules(limits, allowed, []).flatMap((r) => r(d)).map((i) => `${i.where}:${i.code}`);

describe('글 후보 규칙 (FR-BR-1)', () => {
  it('규칙을 지킨 후보는 통과', () => {
    expect(codes(base)).toEqual([]);
  });

  it('아이디 규칙·중복', () => {
    const d = { ...base, handles: [c('ZUN.AI'), c('zun..ai'), c('zun_tools'), c('zun_tools'), ...base.handles.slice(4)] };
    expect(codes(d)).toEqual(['handles.0:handle_rule', 'handles.1:handle_rule', 'handles.3:duplicate_candidate']);
  });

  it('바이오: 상한(150 − 링크 자리 20 = 130자, 이모지는 2자), 주소, 없는 @아이디, 없는 영문 이름·숫자', () => {
    const d = {
      ...base,
      bios: [
        c('가'.repeat(129) + '🚀'), // 129 + 2 = 131 > 130
        c('정리 모음은 linktr.ee/zun 에서'),
        c('협업 문의 @someone.else'),
        c('문의는 @zun.studio 로'), // 허용 출처에 있는 아이디
        c('Notion 으로 주 3회 정리'),
        ...base.bios.slice(5),
      ],
    };
    expect(codes(d)).toEqual(['bios.0:too_long', 'bios.1:url_in_bio', 'bios.2:mention_not_in_source', 'bios.4:number_not_in_source', 'bios.4:english_not_in_source']);
  });

  it('표시 이름: 30자 넘으면 실패, 영문은 지어낸 이름일 수 있어 보지 않고 숫자만 본다', () => {
    const d = { ...base, display_names: [c('ZUN Lab'), c('정리 1500'), c('가'.repeat(31)), ...base.display_names.slice(3)] };
    expect(codes(d)).toEqual(['display_names.1:number_not_in_source', 'display_names.2:too_long']);
  });

  it('걸린 후보만 빼고 목록마다 5개 — 빼도 5개가 남으면 다시 쓰지 않는다', () => {
    const d = { ...base, bios: [c('정리는 bit.ly/x'), ...base.bios.slice(1)] };
    const errors = wordsRules(limits, allowed, []).flatMap((r) => r(d));
    expect(enoughAfterDropping(errors, d)).toBe(true);
    const { picked, dropped } = pickCandidates(d, errors);
    expect([picked.handles.length, picked.displayNames.length, picked.bios.length]).toEqual([5, 5, 5]);
    expect(picked.bios.map((b) => b.value)).not.toContain('정리는 bit.ly/x');
    expect(dropped).toEqual([{ kind: 'bios', value: '정리는 bit.ly/x', reasons: [expect.stringContaining('url_in_bio')] }]);
  });

  it('빼고 나서 5개가 안 되면 다시 쓴다', () => {
    const d = { ...base, bios: [c('a.com'), c('b.com'), ...base.bios.slice(2)] };
    expect(enoughAfterDropping(wordsRules(limits, allowed, []).flatMap((r) => r(d)), d)).toBe(false);
  });
});

describe('generateWords 흐름 (가짜 공급자)', () => {
  function setup(steps: FakeStep[]) {
    const db = openDb(':memory:');
    const sid = createSession(db, 1, { S1: { choices: ['대학생'] } });
    addAnsweredTurn(db, sid, '계기', 'AI 도구를 직접 써 보고 정리', 'text');
    const content: ProfileContent = {
      accountLine: '학생에게 써 본 AI 도구 정리',
      accountLineOrigin: 'interview',
      audience: '대학생',
      audienceOrigin: 'interview',
      pillars: [{ id: 'a'.repeat(16), name: '써 보고 정리', description: 'AI 도구를 직접 써 보고 정리', evidence: [], origin: 'interview', expiresAt: null }],
      dropped: [],
      voiceRules: [text('쉽게', 'interview')],
      avoid: [],
      unknown: [],
      presence: { text: '안 한다 — 캐릭터 ZUN 으로 대신한다', source: 'S6', origin: 'interview' },
    };
    const pid = saveProfileVersion(db, 1, content, { reason: 'interview', sessionId: sid, basedOn: null, jobId: null, activate: true });
    const provider = new FakeProvider(steps);
    return { db, pid, provider, ai: new AiService({ db, provider }) };
  }

  it('6개 중 1개가 걸리면 다시 쓰지 않고 빼고 5개를 저장 — 어느 프로필 판으로 만들었는지 함께', async () => {
    const out = { ...base, bios: [c('링크는 bit.ly/x'), ...base.bios.slice(1)] };
    const { db, pid, ai, provider } = setup([{ structured: out }, { structured: { issues: [] } }]);
    const r = await generateWords(ai, 1);
    expect(r.rewrites).toBe(0);
    expect(provider.calls.map((x) => x.model)).toEqual(['opus', 'opus']); // 걸린 후보를 빼고 받아들일 결과도 자기 평가를 거친다
    expect(r.candidates.bios).toHaveLength(5);
    expect(r.dropped[0]).toMatchObject({ kind: 'bios', value: '링크는 bit.ly/x' });
    expect(latestKit<WordsCandidates>(db, 1, 'words')).toMatchObject({ profileId: pid });
  });

  it('바이오 상한은 설정의 링크 자리를 뺀 값이 프롬프트에 들어간다', async () => {
    const { ai, provider } = setup([{ structured: base }, { structured: { issues: [] } }]);
    await generateWords(ai, 1);
    expect(provider.calls[0]!.prompt).toContain('**130자 이하**');
    expect(provider.calls[1]!.prompt).toContain('계정 소개(무엇을 주는 계정인가)도, 콘텐츠 축도 하나도 담지 않으면 broken');
  });
});
