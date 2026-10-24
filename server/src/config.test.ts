import { describe, expect, it } from 'vitest';
import { DEFAULTS, getSetting, modelForTask, setSetting } from './config.ts';
import { openDb } from './db/index.ts';

describe('설정 읽기 (기본값은 파일, 사용자 값은 DB)', () => {
  it('DB 에 값이 없으면 기본값을 돌려준다', () => {
    const db = openDb(':memory:');
    expect(getSetting(db, 'ai.maxRewrites')).toBe(DEFAULTS['ai.maxRewrites']);
  });

  it('사용자가 바꾼 값이 있으면 그 값을 돌려준다', () => {
    const db = openDb(':memory:');
    setSetting(db, 'ai.maxRewrites', 3);
    expect(getSetting(db, 'ai.maxRewrites')).toBe(3);
  });

  it('과제별 모델은 바꾼 과제만 덮어쓰고 나머지는 기본값을 유지한다', () => {
    const db = openDb(':memory:');
    setSetting(db, 'ai.taskModels', { identity_profile: 'sonnet' });
    expect(modelForTask(db, 'identity_profile')).toBe('sonnet');
    expect(modelForTask(db, 'brand_words')).toBe('opus');
    expect(modelForTask(db, 'smoke_extract')).toBe('sonnet');
  });

  it('과제별 기본 배정: 인터뷰·추출·스모크는 sonnet, 프로필·브랜딩·카피·자기 평가는 opus', () => {
    for (const t of ['identity_followup', 'task_extract', 'smoke_extract']) expect(modelForTask(null, t)).toBe('sonnet');
    for (const t of ['identity_profile', 'brand_words', 'brand_visual', 'card_body', 'cover_titles', 'self_review']) {
      expect(modelForTask(null, t)).toBe('opus');
    }
    expect(modelForTask(null, '아직_없는_과제')).toBe('sonnet');
  });

  it('형식이 다른 값은 저장하지 않는다', () => {
    const db = openDb(':memory:');
    // @ts-expect-error 일부러 잘못된 형식을 넣어 본다
    expect(() => setSetting(db, 'ai.maxRewrites', '3')).toThrow(/형식/);
  });
});

describe('DB 초기 상태', () => {
  it('로컬 사용자 1명과 브랜드 1개로 시작한다', () => {
    const db = openDb(':memory:');
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 1 });
    expect(db.prepare('SELECT user_id, name FROM brands').all()).toEqual([{ user_id: 1, name: '내 브랜드' }]);
  });

  it('활성 프롬프트 버전: 자기 평가·프로필·꼬리질문·브랜딩 시각·바이오 평가 기준·카드 본문은 v3, 카드 본문 평가 기준·시리즈 계획은 v4 (사용자가 과제 하나만 바꿔도 나머지는 유지)', () => {
    const db = openDb(':memory:');
    const v2 = { self_review: 'v2', identity_profile: 'v2', identity_followup: 'v2', brand_visual: 'v2', brand_words_review: 'v2', card_body: 'v3', card_body_review: 'v4', caption_min: 'v1', caption_min_review: 'v2', series_plan: 'v4' };
    expect(getSetting(db, 'prompts.activeVersions')).toEqual(v2);
    setSetting(db, 'prompts.activeVersions', { identity_profile: 'v1' });
    expect(getSetting(db, 'prompts.activeVersions')).toEqual({ ...v2, identity_profile: 'v1' });
  });
});

describe('브랜딩 설정 (결정 2026-10-14 · 브랜딩 키트 설계)', () => {
  it('인스타 글자 제한·링크 자리·명암비 기본값이 설정에 있다', () => {
    expect([getSetting(null, 'brand.handleMax'), getSetting(null, 'brand.displayNameMax'), getSetting(null, 'brand.bioMax')]).toEqual([30, 30, 150]);
    expect(getSetting(null, 'brand.bioLinkReserve')).toBe(20);
    expect(getSetting(null, 'brand.minContrast')).toBe(4.5);
  });
});

describe('영문 약어 허용 목록 (결정 2026-10-14 · 브랜딩 키트 다듬기)', () => {
  it('기본 목록은 짧고, 항목마다 이유가 있다', () => {
    const list = getSetting(null, 'grounding.commonEnglish');
    expect(list.length).toBeLessThanOrEqual(10);
    for (const e of list) expect(e.reason.trim().length).toBeGreaterThan(10);
  });

  it('이유가 빠진 항목은 저장하지 않는다', () => {
    const db = openDb(':memory:');
    expect(() => setSetting(db, 'grounding.commonEnglish', [{ term: 'SNS', reason: '' }])).toThrow(/이유/);
    setSetting(db, 'grounding.commonEnglish', [{ term: 'SNS', reason: '소셜 미디어를 부르는 흔한 말 — 테스트' }]);
    expect(getSetting(db, 'grounding.commonEnglish').map((e) => e.term)).toEqual(['SNS']);
  });
});
