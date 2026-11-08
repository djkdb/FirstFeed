// 인터뷰 다양화(2026-11-08): 방식별 답 저장 · 근거 무게 · 프롬프트에 보이는 줄 · v3 경로(가짜 AI)
import { describe, expect, it } from 'vitest';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider } from '../ai/testing/fake-provider.ts';
import { setSetting } from '../config.ts';
import { openDb } from '../db/index.ts';
import { answerTurn, askNext } from './flow.ts';
import { formatCoverage, formatTranscript, type Followup } from './followup.ts';
import { buildSources, formatSourcesForPrompt } from './sources.ts';
import { addTurn, createSession, listTurns } from './store.ts';

const survey = { S1: { choices: ['대학생'], text: '경영학과' }, S2: { choices: ['IT·AI'] } };
const q = (p: Partial<Followup>): Followup => ({
  question: '질문',
  why: '',
  lens: 'opinion',
  format: 'open',
  examples: ['예시 하나', '전혀 다른 예시'],
  options: [],
  sample: '',
  scaleLeft: '',
  scaleRight: '',
  target: '',
  ready_for_profile: false,
  ...p,
});

function setup() {
  const db = openDb(':memory:');
  const ai = new AiService({ db, provider: new FakeProvider([]) });
  const sid = createSession(db, 1, survey);
  return { db, ai, sid };
}

describe('방식별 답 저장 — 무엇이 사용자가 직접 쓴 글인지 서버가 정한다', () => {
  it('둘 중 고르기: 고르기만 하면 보조 근거(choice), 이유를 쓰면 답 글은 이유만(직접 입력)', () => {
    const { db, ai, sid } = setup();
    addTurn(db, sid, q({ format: 'this_or_that', options: ['정리해서 보여 주기', '겪은 이야기로'], examples: [] }), 'j');
    expect(() => answerTurn(ai, sid, 1, '', false, '없는 선택지')).toThrow('둘 중 하나');
    answerTurn(ai, sid, 1, '', false, '겪은 이야기로');
    expect(listTurns(db, sid)[0]).toMatchObject({ answer: '겪은 이야기로', answerKind: 'choice', pick: '겪은 이야기로' });
    addTurn(db, sid, q({ format: 'this_or_that', options: ['혼자 파기', '같이 하기'], examples: [] }), 'j');
    answerTurn(ai, sid, 2, '혼자 오래 붙잡고 있어야 머리에 남아요', false, '혼자 파기');
    const t = listTurns(db, sid)[1]!;
    expect(t).toMatchObject({ answer: '혼자 오래 붙잡고 있어야 머리에 남아요', answerKind: 'text', pick: '혼자 파기' });
    const src = buildSources(survey, listTurns(db, sid));
    expect(src.find((s) => s.id === 'A1')).toMatchObject({ weight: 'supporting', countsAsUserInput: false });
    // 대조 원문은 이유만 — 선택지 글(AI 가 쓴 것)은 주 근거에 섞이지 않는다
    expect(src.find((s) => s.id === 'A2')).toMatchObject({ weight: 'primary', text: '혼자 오래 붙잡고 있어야 머리에 남아요' });
    expect(formatSourcesForPrompt(src)).toContain('「혼자 파기」를 고름 · 아래는 고른 이유');
  });
  it('고쳐 쓰기: 예시 문장 그대로면 「예시를 그대로 보냄」(근거 아님), 고쳤으면 직접 입력', () => {
    const { db, ai, sid } = setup();
    const sample = '오늘은 에러 메시지 읽는 법을 정리해 봤어요.';
    addTurn(db, sid, q({ lens: 'voice', format: 'rewrite', sample, examples: [] }), 'j');
    answerTurn(ai, sid, 1, '오늘은 에러 메시지 읽는 법을 정리해 봤어요', false);
    expect(listTurns(db, sid)[0]!.answerKind).toBe('example');
    addTurn(db, sid, q({ lens: 'voice', format: 'rewrite', sample, examples: [] }), 'j');
    answerTurn(ai, sid, 2, '에러 메시지, 겁먹지 말고 첫 줄만 읽어 봐요 ㅎㅎ', false);
    const t = listTurns(db, sid);
    expect(t[1]!.answerKind).toBe('text');
    expect(t[1]!.sample).toBe(sample);
    expect(formatSourcesForPrompt(buildSources(survey, t))).toContain('내 말투로 고쳐 쓴 답');
  });
  it('말투 척도: 칸만 고르면 보조 근거, 1~5 밖은 거절', () => {
    const { db, ai, sid } = setup();
    addTurn(db, sid, q({ lens: 'voice', format: 'scale', scaleLeft: '진지하게', scaleRight: '장난스럽게', examples: [] }), 'j');
    expect(() => answerTurn(ai, sid, 1, '', false, null, 7)).toThrow('칸');
    answerTurn(ai, sid, 1, '', false, null, 4);
    expect(listTurns(db, sid)[0]).toMatchObject({ answerKind: 'choice', pick: '4', answer: '진지하게 ↔ 장난스럽게: 5칸 중 4(장난스럽게 쪽)', scale: { left: '진지하게', right: '장난스럽게' } });
  });
  it('프롬프트 대화 기록 · 각도 목록에 방식과 고른 것이 보인다', () => {
    const { db, ai, sid } = setup();
    addTurn(db, sid, q({ format: 'this_or_that', options: ['정리', '이야기'], examples: [] }), 'j');
    answerTurn(ai, sid, 1, '', false, '이야기');
    const turns = listTurns(db, sid);
    expect(formatTranscript(turns)).toContain('(관점 · 둘 중 고르기)');
    expect(formatTranscript(turns)).toContain('→ 고름: 「이야기」');
    const cov = formatCoverage(turns);
    expect(cov).toContain('opinion(관점) 1');
    expect(cov).toContain('말투를 물었나: 아직 아니오');
  });
});

describe('꼬리질문 v3 경로(가짜 AI)', () => {
  it('v3 활성이면 각도 · 방식 스키마로 받고 규칙 위반은 재작성 — 저장까지', async () => {
    const db = openDb(':memory:');
    setSetting(db, 'prompts.activeVersions', { identity_followup: 'v3' });
    const bad = { question: '이 분야에서 남들 말 중 동의 안 하는 것은?', why: '관점', lens: 'opinion', format: 'this_or_that', examples: [], options: ['하나만'], sample: '', scale_left: '', scale_right: '', target: '관점', ready_for_profile: false };
    const good = { ...bad, options: ['비싼 도구가 답이다', '손에 익은 도구가 답이다'] };
    const provider = new FakeProvider([{ structured: bad }, { structured: good }]);
    const ai = new AiService({ db, provider });
    const sid = createSession(db, 1, survey);
    const r = await askNext(ai, sid);
    expect(r.kind).toBe('asked');
    expect(provider.calls[0]!.prompt).toContain('지금까지 쓴 각도');
    expect(provider.calls[1]!.prompt).toContain('format_pick_two');
    expect(listTurns(db, sid)[0]).toMatchObject({ lens: 'opinion', format: 'this_or_that', options: good.options });
  });
  it('v2 활성이면 예전 스키마 그대로(각도 null · 글로 답하기)', async () => {
    const db = openDb(':memory:');
    setSetting(db, 'prompts.activeVersions', { identity_followup: 'v2' });
    const provider = new FakeProvider([{ structured: { question: '최근에 직접 해 본 것 중 알려 주고 싶은 것은?', why: '', examples: ['가나다라', '마바사아'], options: [], target: '', ready_for_profile: false } }]);
    const ai = new AiService({ db, provider });
    const sid = createSession(db, 1, survey);
    await askNext(ai, sid);
    expect(provider.calls[0]!.prompt).not.toContain('지금까지 쓴 각도');
    expect(listTurns(db, sid)[0]).toMatchObject({ lens: null, format: 'open' });
  });
});
