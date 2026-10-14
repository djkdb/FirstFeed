import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { openDb, type Db } from '../db/index.ts';
import { setSetting } from '../config.ts';
import { quoteInSources } from '../rules/grounding.ts';
import type { Rule } from '../rules/types.ts';
import { AiService } from './adapter.ts';
import { generateChecked } from './loop.ts';
import { FakeProvider, type FakeStep } from './testing/fake-provider.ts';

const SOURCE = '첫 달에 팔로워 1,500명을 모았다.';
const Schema = z.object({ quote: z.string() });
type Out = z.infer<typeof Schema>;
const quoteRule: Rule<Out> = (d) =>
  quoteInSources(d.quote, [SOURCE]) ? [] : [{ level: 'error', code: 'quote_not_in_source', message: '인용이 원문에 없음', where: 'quote', from: 'rule' }];

const good = { structured: { quote: '첫 달에 팔로워 1,500명을 모았다.' } };
const bad = { structured: { quote: '팔로워가 2,000명이 됐다' } };
const noIssues = { structured: { issues: [] } };

function setup(steps: FakeStep[]) {
  const db = openDb(':memory:');
  const provider = new FakeProvider(steps);
  return { db, provider, ai: new AiService({ db, provider }) };
}
const runs = (db: Db) => db.prepare('SELECT attempt, task, kind, status FROM ai_runs ORDER BY id').all();
const req = { task: 'smoke_extract', prompt: '원문에서 인용하라', schema: Schema, rules: [quoteRule] };

describe('생성 → 규칙 → 자기 평가 → 재작성 루프', () => {
  it('규칙과 자기 평가를 통과하면 결과를 돌려준다', async () => {
    const { db, ai } = setup([good, noIssues]);
    const r = await generateChecked(ai, req);
    expect(r).toMatchObject({ ok: true, data: { quote: SOURCE }, rewrites: 0, calls: 2 });
    expect(runs(db)).toMatchObject([
      { kind: 'generate', status: 'ok', task: 'smoke_extract' },
      { kind: 'review', status: 'ok', task: 'self_review' },
    ]);
  });

  it('코드 규칙 위반이면 자기 평가 없이 바로 재작성하고, 재작성 프롬프트에 문제와 직전 답을 넣는다', async () => {
    const { db, ai, provider } = setup([bad, good, noIssues]);
    const r = await generateChecked(ai, req);
    expect(r).toMatchObject({ ok: true, rewrites: 1 });
    const rewritePrompt = provider.calls[1]!.prompt;
    expect(rewritePrompt).toContain('quote_not_in_source');
    expect(rewritePrompt).toContain('팔로워가 2,000명이 됐다');
    expect(runs(db)).toMatchObject([
      { kind: 'generate', status: 'rule_error' },
      { kind: 'rewrite', status: 'ok' },
      { kind: 'review', status: 'ok' },
    ]);
  });

  it('자기 평가가 사실 오류(fact)를 찾으면 재작성한다', async () => {
    const fact = { structured: { issues: [{ kind: 'fact', where: 'quote', message: '원문과 다름' }] } };
    const { ai } = setup([good, fact, good, noIssues]);
    const r = await generateChecked(ai, req);
    expect(r).toMatchObject({ ok: true, rewrites: 1, calls: 4 });
  });

  it('자기 평가의 말투 지적(style)은 경고만 하고 재작성하지 않는다', async () => {
    const style = { structured: { issues: [{ kind: 'style', where: 'quote', message: '딱딱함' }] } };
    const { ai } = setup([good, style]);
    const r = await generateChecked(ai, req);
    expect(r).toMatchObject({ ok: true, rewrites: 0, warnings: [{ code: 'review_style', level: 'warn' }] });
  });

  it('재작성 2회(설정값) 뒤에도 규칙 위반이면 결과 없이 실패한다', async () => {
    const { db, ai } = setup([bad, bad, bad]);
    const r = await generateChecked(ai, req);
    expect(r.ok).toBe(false);
    expect(r).not.toHaveProperty('data'); // 저장할 수 있는 칸은 없고, 구제 단계용 rejected 만 있다
    expect(r).toHaveProperty('rejected');
    expect(r).toMatchObject({ rewrites: 2, errors: [{ code: 'quote_not_in_source' }] });
    expect(runs(db)).toMatchObject([{ status: 'rule_error' }, { status: 'rule_error' }, { status: 'rule_error' }]);
  });

  it('자기 평가 호출이 실패해도 코드 규칙을 통과한 결과는 살리고 경고로 남긴다', async () => {
    const { ai } = setup([good, { text: '평가 불가' }, { text: '여전히 불가' }]);
    const r = await generateChecked(ai, req);
    expect(r).toMatchObject({ ok: true, warnings: [{ code: 'review_failed' }] });
  });

  it('selfReview: false 면 자기 평가를 부르지 않는다', async () => {
    const { ai, provider } = setup([good]);
    const r = await generateChecked(ai, { ...req, selfReview: false });
    expect(r.ok).toBe(true);
    expect(provider.calls).toHaveLength(1);
  });

  it('자기 평가는 과제별 설정의 self_review 모델(opus)로 부른다', async () => {
    const { ai, provider } = setup([good, noIssues]);
    await generateChecked(ai, req);
    expect(provider.calls.map((c) => c.model)).toEqual(['sonnet', 'opus']);
  });

  it('과제별 자기 평가 기준은 self_review v2 에만 들어가고, v1 은 기준 없이도 그대로 돈다', async () => {
    const v1 = setup([good, noIssues]);
    setSetting(v1.db, 'prompts.activeVersions', { self_review: 'v1' });
    await generateChecked(v1.ai, { ...req, reviewCriteria: '축이 겹치면 broken' });
    expect(v1.provider.calls[1]!.prompt).not.toContain('축이 겹치면 broken');

    const v2 = setup([good, noIssues]);
    setSetting(v2.db, 'prompts.activeVersions', { self_review: 'v2' });
    await generateChecked(v2.ai, { ...req, reviewCriteria: '축이 겹치면 broken' });
    expect(v2.provider.calls[1]!.prompt).toContain('## 이 과제에서 따로 볼 것\n축이 겹치면 broken');
  });

  it('acceptByDropping: 걸린 후보만 빼도 충분하면 다시 쓰지 않고, 뺄 문제를 dropped 로 넘긴다', async () => {
    const { ai, provider } = setup([bad, noIssues]);
    const r = await generateChecked(ai, { ...req, selfReview: false, acceptByDropping: (errors) => errors.length === 1 });
    expect(r).toMatchObject({ ok: true, rewrites: 0, dropped: [{ code: 'quote_not_in_source' }] });
    expect(provider.calls).toHaveLength(1);
  });

  it('acceptByDropping 으로 받아들일 결과도 자기 평가를 거치고, 평가가 찾은 문제까지 합쳐 다시 판단한다', async () => {
    const fact = { structured: { issues: [{ kind: 'fact', where: 'x', message: '원문과 다름' }] } };
    // 첫 결과: 규칙 1건 → 빼면 충분 → 자기 평가 → fact 1건 더 → 합쳐서 2건이면 부족 → 재작성 → 두 번째는 깨끗
    const { ai, provider } = setup([bad, fact, good, noIssues]);
    const r = await generateChecked(ai, { ...req, acceptByDropping: (errors) => errors.length <= 1 });
    expect(provider.calls.map((c) => c.model)).toEqual(['sonnet', 'opus', 'sonnet', 'opus']);
    expect(r).toMatchObject({ ok: true, rewrites: 1, dropped: [] });
  });

  it('lateRules: 앞 규칙을 통과했을 때만 돌고, 걸리면 같은 재작성 한도로 다시 쓴다 (렌더링 넘침 자리)', async () => {
    const long = { structured: { quote: '첫 달에 팔로워 1,500명을 모았다.' } };
    let seen = 0;
    const late = async (d: Out) => {
      seen++;
      return seen === 1 ? [{ level: 'error' as const, code: 'text_overflow', message: `넘침 (${d.quote.length}자)`, where: 'quote', from: 'rule' as const }] : [];
    };
    const { ai, provider } = setup([bad, long, long, noIssues]);
    const r = await generateChecked(ai, { ...req, lateRules: [late] });
    // 1번째: 앞 규칙 위반 → 그리지 않고 재작성 / 2번째: 앞 규칙 통과 → 그림 → 넘침 → 재작성 / 3번째: 통과 → 자기 평가
    expect(seen).toBe(2);
    expect(r).toMatchObject({ ok: true, rewrites: 2 });
    expect(provider.calls[2]!.prompt).toContain('[text_overflow]');
  });

  it('lateRules 문제도 재작성 2회 한도 안에서 — 끝까지 넘치면 결과 없이 실패', async () => {
    const late = async () => [{ level: 'error' as const, code: 'text_overflow', message: '넘침', where: 'quote', from: 'rule' as const }];
    const { ai, provider } = setup([good, good, good]);
    const r = await generateChecked(ai, { ...req, lateRules: [late] });
    expect(r).toMatchObject({ ok: false, rewrites: 2 });
    expect(provider.calls).toHaveLength(3);
  });
});
