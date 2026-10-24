import { describe, expect, it } from 'vitest';
import { stageText, type Stage } from './jobStage.ts';

const st = (o: Partial<Stage>): Stage => ({ step: 'generate', task: 'identity_profile', call: 1, since: '', reasons: [], ...o });

describe('대기 단계 표시 문구 (결정 2026-10-24 — 서버가 알려 준 단계만)', () => {
  it('정체성: 답변에서 축 찾기 → 근거 확인 → 자기 평가 → 다시 쓰기(걸린 이유)', () => {
    expect(stageText(st({}))?.text).toBe('답변에서 축 찾는 중 (1번째 AI 호출)');
    expect(stageText(st({ step: 'rules' }))?.text).toContain('근거 확인 중');
    expect(stageText(st({ step: 'review', call: 2 }))?.text).toContain('자기 평가');
    const r = stageText(st({ step: 'rewrite', call: 3, reasons: ['인용이 원문에 없음', '축이 겹침'] }));
    expect(r).toEqual({ text: '다시 쓰는 중 (3번째 AI 호출) — 걸린 이유:', reasons: ['인용이 원문에 없음', '축이 겹침'] });
  });

  it('과제마다 무엇을 쓰는지 — 브랜딩 · 카드 · 시리즈 계획', () => {
    expect(stageText(st({ task: 'brand_words' }))?.text).toContain('바이오 후보');
    expect(stageText(st({ task: 'card_body' }))?.text).toContain('본문 카드');
    expect(stageText(st({ task: 'series_plan' }))?.text).toContain('9개 게시물');
    expect(stageText(st({ task: 'series_plan', step: 'rules' }))?.text).toContain('거의 같은 제목');
    expect(stageText(st({ task: 'card_body', step: 'late' }))?.text).toContain('넘치지 않는지');
  });

  it('모르는 과제는 일반 문구, 단계가 없으면 아무것도 보이지 않는다(지어내지 않음)', () => {
    expect(stageText(st({ task: '새_과제' }))?.text).toBe('AI 가 쓰는 중 (1번째 AI 호출)');
    expect(stageText(null)).toBeNull();
    expect(stageText(undefined)).toBeNull();
  });

  it('이유는 앞 3개 · 한 줄 80자까지, 차례 기다림은 호출 번호 없이', () => {
    const long = '가'.repeat(120);
    const r = stageText(st({ step: 'rewrite', reasons: [long, 'b', 'c', 'd'] }))!;
    expect(r.reasons).toHaveLength(3);
    expect([...r.reasons[0]!].length).toBe(80);
    expect(stageText(st({ step: 'queued', call: 4 }))?.text).not.toContain('4번째');
  });
});
