// FR-ID-6 수용 기준: "프로필을 바꾸면 이후 생성 결과에 반영된다" — 생성기가 받는 입력 단계에서 확인한다
import { describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { saveEdit } from './edit.ts';
import { formatProfileForPrompt, profileForGeneration, profileGroundingTexts } from './for-generation.ts';
import { text, type ProfileContent } from './model.ts';
import { saveProfileVersion } from './store.ts';

const base: ProfileContent = {
  accountLine: '학생에게 써 본 도구 정리',
  accountLineOrigin: 'interview',
  audience: '대학생',
  audienceOrigin: 'interview',
  pillars: [{ id: 'aaaaaaaaaaaaaaaa', name: '써 보고 정리', description: '써 본 도구 정리', evidence: [], origin: 'interview', expiresAt: null }],
  dropped: [],
  voiceRules: [text('쉽게 쓴다', 'interview')],
  avoid: [text('과장된 제목', 'interview')],
  unknown: ['게시물 형식'],
  presence: { text: '안 한다 — 캐릭터로 대신한다', source: 'S6', origin: 'interview' },
};

describe('확정 프로필 → 생성 입력 (FR-ID-6)', () => {
  it('적용 중인 프로필이 없으면 무엇을 하면 되는지 알려 준다', () => {
    expect(() => profileForGeneration(openDb(':memory:'), 1)).toThrow(/적용 중인 브랜드 프로필이 없습니다/);
  });

  it('확정 전 초안은 생성 입력이 아니다', () => {
    const db = openDb(':memory:');
    saveProfileVersion(db, 1, base, { reason: 'interview', sessionId: null, basedOn: null, jobId: null, activate: false });
    expect(() => profileForGeneration(db, 1)).toThrow();
  });

  it('프로필을 바꾸면 생성 입력이 바로 바뀐다 — 말투·축·피할 것·보여 주는 방식', () => {
    const db = openDb(':memory:');
    const v1 = saveProfileVersion(db, 1, base, { reason: 'interview', sessionId: null, basedOn: null, jobId: null, activate: true });
    const before = formatProfileForPrompt(profileForGeneration(db, 1));
    expect(before).toContain('- 쉽게 쓴다');
    expect(before).toContain('- [aaaaaaaaaaaaaaaa] 써 보고 정리: 써 본 도구 정리');

    saveEdit(db, v1, {
      accountLine: base.accountLine,
      audience: base.audience,
      pillars: [{ id: 'aaaaaaaaaaaaaaaa', name: '써 보고 정리', description: '써 본 도구를 한 장으로 정리' }],
      voiceRules: ['반말로 짧게 쓴다'],
      avoid: ['요금제 비교'],
      presence: '손만 보여 준다',
    });
    const after = profileForGeneration(db, 1);
    const prompt = formatProfileForPrompt(after);
    expect(prompt).toContain('- 반말로 짧게 쓴다');
    expect(prompt).not.toContain('쉽게 쓴다');
    expect(prompt).toContain('- 요금제 비교');
    expect(prompt).toContain('보여 주는 방식: 손만 보여 준다');
    expect(after.pillars[0]).toEqual({ id: 'aaaaaaaaaaaaaaaa', name: '써 보고 정리', description: '써 본 도구를 한 장으로 정리' }); // 같은 축 ID
    expect(profileGroundingTexts(after)).toContain('반말로 짧게 쓴다');
  });
});
