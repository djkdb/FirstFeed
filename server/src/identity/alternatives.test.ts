// 「다른 방향 2개 더」 (가짜 공급자)
import { describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider, type FakeStep } from '../ai/testing/fake-provider.ts';
import { chooseDirection, directionOf, runAlternatives, type Direction } from './alternatives.ts';
import { text, type ProfileContent } from './model.ts';
import { activeProfile, addAnsweredTurn, createSession, saveProfileVersion } from './store.ts';

const ANS = [
  '써 보고 알게 된 걸 정리해 두면 나 같은 학생한테 도움이 되겠다 싶었다',
  '발표 원문이나 공식 문서를 직접 보고 써 본 것만 쓴다',
  '본 그날 바로 다르게 해 볼 수 있는 것 하나',
  '만드는 과정에서 막혔던 부분을 기록해 두는 편이다',
  '같은 학생들이 자주 하는 실수를 모아 두고 싶다',
];

function setup(steps: FakeStep[]) {
  const db = openDb(':memory:');
  const sid = createSession(db, 1, { S2: { choices: ['IT·AI', '개발'] } });
  ANS.forEach((a, i) => addAnsweredTurn(db, sid, `질문 ${i + 1}`, a, 'text'));
  const base: ProfileContent = {
    accountLine: '학생에게 써 본 도구 정리',
    accountLineOrigin: 'interview',
    audience: '대학생',
    audienceOrigin: 'interview',
    pillars: ['써 보고 정리', '원문 확인', '오늘 바로'].map((name, i) => ({
      id: `${i}`.repeat(16),
      name,
      description: `${name} 설명`,
      evidence: [{ quote: ANS[i]!, source: `A${i + 1}`, sourceLabel: `인터뷰 ${i + 1}번 답`, weight: 'primary' as const }],
      origin: 'interview' as const,
      expiresAt: null,
    })),
    dropped: [],
    voiceRules: [text('쉽게', 'interview')],
    avoid: [],
    unknown: [],
    presence: { text: '안 한다', source: 'S6', origin: 'interview' },
  };
  const baseId = saveProfileVersion(db, 1, base, { reason: 'interview', sessionId: sid, basedOn: null, jobId: null, activate: true });
  const provider = new FakeProvider(steps);
  return { db, baseId, provider, ai: new AiService({ db, provider }) };
}

// 축 이름에 숫자를 쓰면 "답에 없는 숫자" 규칙에 걸린다 (테스트 자료도 규칙을 지킨다)
const KO = ['하나', '둘', '셋', '넷'];
const dir = (angle: string, quotes: Array<[string, string]>): Direction => ({
  angle,
  account_line: `${angle} 계정`,
  audience: '대학생',
  pillars: quotes.map(([quote, source], i) => ({ name: `${angle} ${KO[i]}`, description: `${angle} ${KO[i]} 설명`, evidence: [{ quote, source }] })),
  voice_rules: ['a', 'b', 'c'],
  avoid: [],
  unknown: [],
});
const good0 = dir('제작기', [
  [ANS[3]!, 'A4'],
  [ANS[0]!, 'A1'],
  [ANS[2]!, 'A3'],
]);
const good1 = dir('실수 모음', [
  [ANS[4]!, 'A5'],
  [ANS[1]!, 'A2'],
  [ANS[2]!, 'A3'],
]);
const fake1 = dir('지어낸 방향', [
  ['나는 유튜브도 한다', 'A1'],
  [ANS[1]!, 'A2'],
  [ANS[2]!, 'A3'],
]);
const noIssues = { structured: { issues: [] } };

describe('다른 방향 2개 더 (FR-ID-5)', () => {
  it('두 방향이 규칙·자기 평가를 통과하면 둘 다 고를 수 있고, 고르면 새 판이 바로 활성 — 축은 모두 새 ID', async () => {
    const { db, ai, baseId, provider } = setup([{ structured: { directions: [good0, good1] } }, noIssues]);
    const r = await runAlternatives(ai, baseId);
    expect(r.directions.map((d) => d.ok)).toEqual([true, true]);
    expect(provider.calls.map((c) => c.model)).toEqual(['opus', 'opus']); // 생성 1 + 자기 평가 1
    expect(provider.calls[1]!.prompt).toContain('지금 판과 같은 방향'); // 방향 판정 기준이 자기 평가에 들어감

    const newId = chooseDirection(ai, r, 1);
    const active = activeProfile(db, 1)!;
    expect(active).toMatchObject({ id: newId, reason: 'alternative', basedOn: baseId, accountLine: '실수 모음 계정', accountLineOrigin: 'alternative' });
    expect(active.pillars.every((p) => p.origin === 'alternative' && /^[0-9a-f]{16}$/.test(p.id))).toBe(true);
    // 지금 판의 축 ID 와 이어 붙이지 않는다
    expect(active.pillars.some((p) => ['0000000000000000', '1111111111111111', '2222222222222222'].includes(p.id))).toBe(false);
    expect(active.presence).toEqual({ text: '안 한다', source: 'S6', origin: 'interview' }); // 보여 주는 방식은 그대로
  });

  it('재작성 2회 뒤에도 한쪽만 규칙을 통과하면 통과한 쪽만 고를 수 있고, 실패한 쪽은 이유가 남는다', async () => {
    const out = { structured: { directions: [good0, fake1] } };
    const { ai, baseId } = setup([out, out, out]);
    const r = await runAlternatives(ai, baseId);
    expect(r.directions.map((d) => d.ok)).toEqual([true, false]);
    expect(r.rewrites).toBe(2);
    expect(r.directions[1]!.reasons.join(' ')).toMatch(/quote_not_in_source/);
    expect(() => chooseDirection(ai, r, 1)).toThrow(/고를 수 없는 방향/);
  });

  it('자기 평가가 "지금 판과 같은 방향"(broken)으로 본 방향은 재작성하고, 끝까지 그러면 그 방향만 뺀다', async () => {
    const same = { structured: { issues: [{ kind: 'broken', where: 'directions.0', message: '지금 판과 같은 방향: 제작기 하나 ↔ 써 보고 정리' }] } };
    const out = { structured: { directions: [good0, good1] } };
    const { ai, baseId } = setup([out, same, out, same, out, same]);
    const r = await runAlternatives(ai, baseId);
    expect(r.directions.map((d) => d.ok)).toEqual([false, true]);
    expect(r.directions[0]!.reasons[0]).toMatch(/지금 판과 같은 방향/);
  });

  it('근거 있는 축이 3개 미만인 방향은 내지 않는다 (too_few_pillars)', async () => {
    const thin = dir('얇은 방향', [
      [ANS[0]!, 'A1'],
      ['지어낸 인용', 'A2'],
    ]);
    const out = { structured: { directions: [good0, thin] } };
    const { ai, baseId } = setup([out, out, out]);
    const r = await runAlternatives(ai, baseId);
    expect(r.directions[1]!.reasons.join(' ')).toMatch(/too_few_pillars/);
  });

  it('어느 방향의 문제인지 알 수 없는 지적은 두 방향 모두의 문제로 본다', () => {
    expect(directionOf({ level: 'error', code: 'x', message: '', where: 'directions.1.pillars.0 / directions.0.pillars.2', from: 'review' })).toBe(1);
    expect(directionOf({ level: 'error', code: 'x', message: '', where: 'pillars.0', from: 'review' })).toBeNull();
  });
});
