// 프로필 만들기가 「근거 있는 축 3개 미만」으로 돌아온 뒤(AI 가상 사용자 테스트 2026-11-28 A0 ①):
// 돌아온 이유가 다음 질문 프롬프트에 보이고, 새 답이 쌓이기 전에는 다시 만들 수 없다
import { describe, expect, it } from 'vitest';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider } from '../ai/testing/fake-provider.ts';
import { getSetting, setSetting } from '../config.ts';
import { openDb } from '../db/index.ts';
import { answerTurn, askNext, FlowError, makeProfile } from './flow.ts';
import { formatProfileGap } from './followup.ts';
import { createSession, getSessionState, setStatus } from './store.ts';

const survey = { S1: { choices: ['대학생'], text: '간호학과' }, S2: { choices: ['음식'] } };
// 서로 다른 질문(같은 질문 규칙 · 각도 규칙에 걸리지 않게). 첫 질문은 말투 척도 — 「말투를 묻기 전 ready 금지」 규칙을 넘게
const QUESTIONS = [
  '글을 쓸 때 진지한 쪽인가요 장난스러운 쪽인가요?',
  '최근 자취하며 해 먹은 한 끼 중 기억나는 건 무엇인가요?',
  '자취 요리에서 남들이 흔히 하는 말 중 동의하지 않는 건?',
  '귀찮은데도 직접 해 먹는 이유는 무엇인가요?',
  '장보기에서 가장 오래 헤맨 일은 무엇이었나요?',
  '부엌에서 이것만은 양보 못 하는 도구 하나는?',
  '친구들이 요리 얘기만 나오면 물어보는 건?',
  '이 계정을 꼭 봤으면 하는 사람은 누구인가요?',
  '실습 주간에 끼니를 챙기는 나만의 방법은?',
  '한 끼 값을 줄이려고 지키는 규칙이 있나요?',
  '냉장고에 늘 있는 재료 세 가지는 무엇인가요?',
  '처음 자취를 시작한 날 무엇을 해 먹었나요?',
] as const;
const LENS = ['voice', 'experience', 'opinion', 'reason', 'struggle', 'quirk', 'others_view', 'audience'] as const;
const question = (n: number, ready = false) => ({
  question: QUESTIONS[(n - 1) % QUESTIONS.length],
  why: '축을 정하려고 물어요',
  lens: LENS[(n - 1) % LENS.length],
  format: n === 1 ? 'scale' : 'open',
  examples: ['예시 하나', '전혀 다른 예시'],
  options: [],
  sample: '',
  scale_left: n === 1 ? '진지하게' : '',
  scale_right: n === 1 ? '장난스럽게' : '',
  target: '축',
  ready_for_profile: ready,
});

/** 질문 n 개를 받고 모두 답한 세션 + 돌아온 상태(needs_more, atTurn = n) */
async function backFromProfile(n: number, missing = ['셋째 축: 직접 한 말 없음', '피할 것']) {
  const db = openDb(':memory:');
  setSetting(db, 'prompts.activeVersions', { identity_followup: 'v6' });
  const provider = new FakeProvider(Array.from({ length: 20 }, (_, i) => ({ structured: question(i + 1, true) })));
  const ai = new AiService({ db, provider });
  const sid = createSession(db, 1, survey);
  for (let i = 1; i <= n; i++) {
    const r = await askNext(ai, sid);
    if (r.kind !== 'asked') throw new Error(`${i}번 질문을 받지 못함: ${JSON.stringify(r)}`);
    if (i === 1) answerTurn(ai, sid, i, '', false, null, 2);
    else answerTurn(ai, sid, i, `${i}번 답 — 실습 끝나고 편의점 도시락만 먹던 때 이야기 ${i}`, false);
  }
  setStatus(db, sid, 'interview', { kind: 'needs_more', message: '돌아옴', missing, atTurn: n });
  return { db, ai, sid, provider };
}

describe('프로필 만들기에서 돌아온 뒤', () => {
  it('돌아온 이유(부족한 것)가 다음 꼬리질문 프롬프트에 보인다 — v6', async () => {
    const { ai, sid, provider } = await backFromProfile(5);
    await askNext(ai, sid);
    const prompt = provider.calls.at(-1)!.prompt;
    expect(prompt).toContain('프로필 만들기에서 돌아온 이유');
    expect(prompt).toContain('- 셋째 축: 직접 한 말 없음');
    expect(prompt).toContain('- 피할 것');
  });

  it('돌아온 적이 없으면 「없음」으로 보인다', () => {
    expect(formatProfileGap([])).toContain('없음');
  });

  it('v5 로 비교 측정할 때도 같은 코드로 돈다(프롬프트에 칸이 없어도 오류 아님)', async () => {
    const { db, ai, sid, provider } = await backFromProfile(3);
    setSetting(db, 'prompts.activeVersions', { identity_followup: 'v5' });
    await askNext(ai, sid);
    expect(provider.calls.at(-1)!.prompt).not.toContain('프로필 만들기에서 돌아온 이유');
  });

  it('AI 가 「충분하다」고 해도 새 답이 정해진 수만큼 쌓이기 전에는 ready 로 두지 않는다', async () => {
    const { db, ai, sid } = await backFromProfile(5);
    const need = getSetting(db, 'identity.retryMinNewAnswers');
    expect(need).toBe(2);
    // 돌아온 직후 질문(새 답 0개)
    const r1 = await askNext(ai, sid);
    expect(r1).toMatchObject({ kind: 'asked', readyForProfile: false });
    answerTurn(ai, sid, 6, '6번 답 — 다이어트 식단 이야기는 하고 싶지 않아요', false);
    const r2 = await askNext(ai, sid); // 새 답 1개
    expect(r2).toMatchObject({ readyForProfile: false });
    answerTurn(ai, sid, 7, '7번 답 — 장 볼 때 영수증을 꼭 챙겨서 한 끼 값을 계산해요', false);
    const r3 = await askNext(ai, sid); // 새 답 2개
    expect(r3).toMatchObject({ readyForProfile: true });
    expect(getSessionState(db, sid)!.status).toBe('ready');
  });

  it('ready 가 되기 전에 다시 만들면 AI 를 부르지 않고 다음 할 일을 알려 준다', async () => {
    const { ai, sid, provider } = await backFromProfile(5);
    const before = provider.calls.length;
    const err = await makeProfile(ai, sid).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FlowError);
    expect((err as FlowError).hint).toContain('이제 프로필 만들기');
    expect(provider.calls.length).toBe(before);
  });

  it('질문을 다 썼으면(최대) ready 가 아니어도 다시 만들 수 있다 — 막히지 않게', async () => {
    const { db, ai, sid } = await backFromProfile(10);
    expect(getSetting(db, 'identity.maxTurns')).toBe(10);
    // 가짜 AI 응답이 프로필 모양이 아니라 실패로 끝나도 된다 — FlowError(막힘)가 아니면 된다
    const err = await makeProfile(ai, sid).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(FlowError);
  });
});
