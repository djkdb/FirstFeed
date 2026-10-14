// 설문 근거의 대조 원문은 프롬프트에 보이는 "라벨: 답" 줄과 같아야 한다.
// 예전 코드는 답 글자만 대조해서 보이는 줄 그대로 인용하면 실패했고, 테스트도 코드 쪽 동작만 확인해 통과했다 (devlog 2026-10-14-01).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { env } from '../config.ts';
import { checkEvidence } from './profile.ts';
import { buildSources, formatSourcesForPrompt } from './sources.ts';
import { SURVEY, surveyAnswerText, type SurveyAnswers } from './survey.ts';

const survey: SurveyAnswers = { S4: { choices: ['만든 것'] }, S2: { choices: ['IT·AI', '개발'], other: '바이브코딩' } };
const sources = buildSources(survey, []);
const ctx = { sources, overlapThreshold: 0.5, minQuoteChars: 4, commonTerms: [] };
const check = (quote: string, source: string) => {
  const r = checkEvidence({ quote, source }, ctx);
  return r.ok ? 'ok' : r.code;
};

describe('설문 근거 = "라벨: 답" 한 줄', () => {
  it('프롬프트에 보이는 줄을 그대로 인용하면 통과한다 (규칙 문서와 코드가 같은 원문을 본다)', () => {
    const shown = formatSourcesForPrompt(sources).split('\n');
    expect(shown).toContain('[S4] 보여줄 수 있는 것: 만든 것');
    for (const line of shown) {
      const [, id, rest] = /^\[(S\d)\] (.*)$/.exec(line)!;
      expect(check(rest!, id!)).toBe('ok');
    }
  });

  it('라벨만 옮기면 근거가 아니다', () => {
    expect(check('보여줄 수 있는 것', 'S4')).toBe('label_only_quote');
    expect(check('관심 분야', 'S2')).toBe('label_only_quote');
  });

  it('예전 방식대로 답 부분만 인용한 것(이미 저장된 프로필)도 계속 통과한다', () => {
    expect(check('IT·AI, 개발, 바이브코딩', 'S2')).toBe('ok');
  });

  it('모든 고정 테스트 세트에서: 예전 원문(답 글자)은 새 원문의 부분 문자열이다 — 저장된 인용이 깨지지 않는다', () => {
    const dirs = ['tests/fixtures/real/interviews', 'tests/fixtures/generated/interviews'];
    let checked = 0;
    for (const dir of dirs) {
      for (const f of fs.readdirSync(path.join(env.repoRoot, dir)).filter((x) => x.endsWith('.json'))) {
        const fx = JSON.parse(fs.readFileSync(path.join(env.repoRoot, dir, f), 'utf8')) as { survey: SurveyAnswers };
        const now = buildSources(fx.survey, []);
        for (const q of SURVEY) {
          const old = surveyAnswerText(fx.survey[q.id]);
          if (!old) continue;
          const src = now.find((s) => s.id === q.id)!;
          expect(src.text.endsWith(old)).toBe(true);
          if (old.replace(/[\s\p{P}\p{S}]/gu, '').length >= 4) expect(checkEvidence({ quote: old, source: q.id }, { sources: now, overlapThreshold: 0.5, minQuoteChars: 4, commonTerms: [] }).ok).toBe(true);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('라벨 + 답 한두 글자는 통과하지 않는다 — 길이는 답 부분에서만 잰다 (devlog 2026-10-14-02)', () => {
    const long = buildSources({ S4: { choices: ['정보 정리', '만든 것', '과정/비하인드'] } }, []);
    const c = (quote: string) => {
      const r = checkEvidence({ quote, source: 'S4' }, { sources: long, overlapThreshold: 0.5, minQuoteChars: 4, commonTerms: [] });
      return r.ok ? 'ok' : r.code;
    };
    expect(c('보여줄 수 있는 것: 정')).toBe('quote_too_short');
    expect(c('보여줄 수 있는 것: 정보')).toBe('quote_too_short'); // 답 2자
    expect(c('보여줄 수 있는 것: 정보 정리')).toBe('ok'); // 답 4자
    expect(c('보여줄 수 있는 것: 정보 정리, 만든 것, 과정/비하인드')).toBe('ok');
    expect(c('정보 정리, 만든 것')).toBe('ok'); // 라벨 없이 답만
  });

  it('답 전체가 기준보다 짧으면 답 전체를 옮길 때만 통과한다 (짧은 답도 근거에서 빼지 않는다)', () => {
    const short = buildSources({ S5: { choices: ['1'] }, S4: { choices: ['만든 것'] } }, []);
    const c = (quote: string, source: string) => {
      const r = checkEvidence({ quote, source }, { sources: short, overlapThreshold: 0.5, minQuoteChars: 4, commonTerms: [] });
      return r.ok ? 'ok' : r.code;
    };
    expect(c('한 주에 올릴 수 있는 횟수: 1', 'S5')).toBe('ok');
    expect(c('보여줄 수 있는 것: 만든 것', 'S4')).toBe('ok');
    expect(c('만든 것', 'S4')).toBe('ok'); // 답 전체(3자)
    expect(c('보여줄 수 있는 것: 만든', 'S4')).toBe('quote_too_short'); // 답 일부(2자)
  });
});
