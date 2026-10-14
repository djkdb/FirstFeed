import { describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { saveProfileVersion } from '../identity/store.ts';
import type { ProfileContent } from '../identity/model.ts';
import { currentSelection, latestKit, saveKit, saveSelection, selectionHistory } from './store.ts';
import type { WordsCandidates } from './types.ts';

const content: ProfileContent = {
  accountLine: 'a',
  accountLineOrigin: 'interview',
  audience: 'b',
  audienceOrigin: 'interview',
  pillars: [],
  dropped: [],
  voiceRules: [],
  avoid: [],
  unknown: [],
  presence: null,
};

describe('브랜딩 키트 저장·선택 이력', () => {
  it('후보 묶음은 어느 프로필 판으로 만들었는지와 함께 남는다', () => {
    const db = openDb(':memory:');
    const p = saveProfileVersion(db, 1, content, { reason: 'interview', sessionId: null, basedOn: null, jobId: null, activate: true });
    const words: WordsCandidates = { handles: [{ value: 'zun.ai', why: '' }], displayNames: [], bios: [] };
    saveKit(db, 1, p, 'words', words, [], 'job-1');
    expect(latestKit<WordsCandidates>(db, 1, 'words')).toMatchObject({ profileId: p, candidates: words });
    expect(latestKit(db, 1, 'visual')).toBeNull();
  });

  it('고를 때마다 새 줄 — 바뀐 칸만 덮어쓰고 나머지는 직전 선택을 이어받는다', () => {
    const db = openDb(':memory:');
    saveSelection(db, 1, null, { handle: 'zun.ai' });
    saveSelection(db, 1, null, { bio: '바이오', titleFont: 'paperlogy' });
    expect(currentSelection(db, 1)).toMatchObject({ handle: 'zun.ai', bio: '바이오', titleFont: 'paperlogy', bodyFont: null });
    expect(selectionHistory(db, 1).map((h) => h.changed)).toEqual(['bio,titleFont', 'handle']);
    expect(db.prepare('SELECT handle FROM brands WHERE id = 1').get()).toEqual({ handle: 'zun.ai' });
  });
});
