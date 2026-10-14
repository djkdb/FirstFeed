import { describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider } from '../ai/testing/fake-provider.ts';
import { buildSources } from './sources.ts';
import { profileRules, runProfile, salvage, type ProfileContext, type ProfileDraft } from './profile.ts';

const sources = buildSources(
  {
    S1: { choices: ['대학생'], text: '소프트웨어학부 재학 중' },
    S2: { choices: ['IT·AI', '개발'], other: '바이브코딩' },
  },
  [
    { turnNo: 1, question: '계정을 시작한 계기는 무엇인가요?', answer: '써 보고 알게 된 걸 정리해 두면 나 같은 학생한테 도움이 되겠다 싶었다', answerKind: 'text' },
    { turnNo: 2, question: '남다른 점은?', answer: '발표 원문이나 공식 문서를 직접 보고 써 본 것만 쓴다', answerKind: 'text' },
    { turnNo: 3, question: '얻어 갈 것은?', answer: '본 그날 바로 다르게 해 볼 수 있는 것 하나', answerKind: 'text' },
    { turnNo: 4, question: '무엇을 보여 주고 싶나요?', answer: '만든 앱을 알리고 싶어요', answerKind: 'example' },
  ],
);
const ctx: ProfileContext = { sources, overlapThreshold: 0.5, minQuoteChars: 4, commonTerms: [] };

const pillar = (name: string, description: string, quote: string, source: string) => ({ name, description, evidence: [{ quote, source }] });
const good: ProfileDraft = {
  account_line: '학생을 위한 AI 도구 실전 정리',
  audience: 'AI 도구를 막 쓰기 시작한 대학생',
  pillars: [
    pillar('써 본 것만', '직접 써 본 도구의 후기', '써 보고 알게 된 걸 정리해 두면', 'A1'),
    pillar('원문 확인', '발표 원문과 공식 문서로 확인한 소식', '발표 원문이나 공식 문서를 직접 보고', 'A2'),
    pillar('오늘 바로', '그날 바로 해 볼 수 있는 팁 하나', '본 그날 바로 다르게 해 볼 수 있는 것 하나', 'A3'),
  ],
  voice_rules: ['쉽게', '짧게', '확인한 것만'],
  avoid: ['과장된 제목'],
  unknown: [],
};
const codes = (d: ProfileDraft) => profileRules(ctx).flatMap((r) => r(d)).map((i) => i.code);

describe('프로필 근거 규칙 (FR-ID-4)', () => {
  it('출처의 답 안에 있는 인용만 쓰면 통과', () => {
    expect(codes(good)).toEqual([]);
  });

  it('다른 출처의 문장을 갖다 붙이면 실패 (인용은 그 출처 안에서만 대조)', () => {
    const d = { ...good, pillars: [pillar('원문 확인', '발표 원문 확인', '발표 원문이나 공식 문서를 직접 보고', 'A1'), ...good.pillars.slice(1)] };
    expect(codes(d)).toContain('quote_not_in_source');
  });

  it('질문 글(AI 가 씀)을 인용하면 실패', () => {
    const d = { ...good, pillars: [pillar('계기', '계기', '계정을 시작한 계기는 무엇인가요', 'A1'), ...good.pillars.slice(1)] };
    expect(codes(d)).toContain('quote_not_in_source');
  });

  it('너무 짧은 조각·없는 출처는 실패', () => {
    const d = { ...good, pillars: [pillar('a', 'b', '학생', 'A1'), pillar('c', 'd', '써 보고 알게 된 걸', 'A9'), good.pillars[2]!] };
    expect(codes(d)).toEqual(expect.arrayContaining(['quote_too_short', 'unknown_source']));
  });

  it('예시를 그대로 고른 답만으로 근거를 대는 축은 실패 (예시 답 순환 막기)', () => {
    const d = { ...good, pillars: [...good.pillars, pillar('앱 홍보', '만든 앱 소개', '만든 앱을 알리고 싶어요', 'A4')] };
    expect(codes(d)).toEqual(['example_only_evidence']);
  });

  it('축끼리 겹치면 실패', () => {
    const d = { ...good, pillars: [...good.pillars, pillar('써 본 것만 정리', '직접 써 본 도구의 후기 정리', '나 같은 학생한테 도움이 되겠다', 'A1')] };
    expect(codes(d)).toContain('pillar_overlap');
  });

  it('답에 없는 숫자·영문 이름을 쓰면 실패', () => {
    expect(codes({ ...good, account_line: 'ChatGPT 3가지 정리' })).toEqual(expect.arrayContaining(['english_not_in_source', 'number_not_in_source']));
  });
});

describe('구제 단계 — 재작성 끝까지 실패했을 때', () => {
  const bad = pillar('지어낸 축', '근거 없음', '나는 유튜브도 한다', 'A1');
  const exampleOnly = pillar('앱 홍보', '만든 앱 소개', '만든 앱을 알리고 싶어요', 'A4');

  it('근거 없는 축만 빼고도 3개 이상이면 저장하고, 뺀 축은 「근거 부족」으로', () => {
    const d = { ...good, pillars: [...good.pillars, bad, exampleOnly] };
    const errors = profileRules(ctx).flatMap((r) => r(d));
    const out = salvage(d, errors, ctx, 3);
    expect(out.kind).toBe('saved');
    if (out.kind !== 'saved') return;
    expect(out.draft.pillars.map((p) => p.name)).toEqual(['써 본 것만', '원문 확인', '오늘 바로']);
    expect(out.dropped).toEqual([
      { name: '지어낸 축', description: '근거 없음', reason: '답에서 찾을 수 있는 인용이 없음' },
      { name: '앱 홍보', description: '만든 앱 소개', reason: '예시를 고른 답만 근거로 댐' },
    ]);
    expect(out.salvaged).toBe(true);
  });

  it('빼고 나서 3개 미만이면 인터뷰로 돌아간다', () => {
    const d = { ...good, pillars: [good.pillars[0]!, bad, exampleOnly] };
    const out = salvage(d, profileRules(ctx).flatMap((r) => r(d)), ctx, 3);
    expect(out).toMatchObject({ kind: 'needs_more' });
  });

  it('남는 축에 근거 밖의 문제(지어낸 숫자 등)가 있으면 구제하지 않는다', () => {
    const d = { ...good, account_line: '팔로워 9,999명의 비밀', pillars: [...good.pillars, bad] };
    const out = salvage(d, profileRules(ctx).flatMap((r) => r(d)), ctx, 3);
    expect(out).toMatchObject({ kind: 'failed' });
  });
});

describe('runProfile 흐름 (가짜 공급자)', () => {
  function ai(steps: ConstructorParameters<typeof FakeProvider>[0]) {
    const db = openDb(':memory:');
    return { db, ai: new AiService({ db, provider: new FakeProvider(steps) }) };
  }
  const noIssues = { structured: { issues: [] } };

  it('통과하면 확인된 인용과 출처 이름까지 붙여 돌려준다 (자기 평가 포함)', async () => {
    const { ai: s } = ai([{ structured: good }, noIssues]);
    const r = await runProfile(s, sources);
    expect(r.outcome.kind).toBe('saved');
    if (r.outcome.kind === 'saved') expect(r.outcome.draft.pillars[1]!.evidence[0]!.sourceLabel).toBe('인터뷰 2번 답');
    expect(r.calls).toBe(2);
  });

  it('재작성 2회 뒤에도 근거 없는 축이 남으면 그 축만 빼고 저장한다', async () => {
    const withBad = { ...good, pillars: [...good.pillars, pillar('지어낸 축', '근거 없음', '나는 유튜브도 한다', 'A1')] };
    const { db, ai: s } = ai([{ structured: withBad }, { structured: withBad }, { structured: withBad }]);
    const r = await runProfile(s, sources);
    expect(r.outcome).toMatchObject({ kind: 'saved', salvaged: true, dropped: [{ name: '지어낸 축' }] });
    expect(r.rewrites).toBe(2);
    const statuses = db.prepare('SELECT kind, status FROM ai_runs ORDER BY id').all();
    expect(statuses).toEqual([
      { kind: 'generate', status: 'rule_error' },
      { kind: 'rewrite', status: 'rule_error' },
      { kind: 'rewrite', status: 'rule_error' },
    ]);
  });
});
