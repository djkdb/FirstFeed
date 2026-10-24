import { describe, expect, it } from 'vitest';
import { fieldOf, placeOf, plain, reasonLines, wordDiff } from './rewriteText.ts';

// 확인 실행(2026-10-25)에서 실제로 남은 기록과 같은 모양
const issues = [
  { code: 'number_not_in_source', where: 'cards.3.text', message: '소재·프로필·메모에 없는 숫자 "1" 을(를) 썼습니다.', from: 'rule' as const },
  { code: 'number_not_in_source', where: 'cards.3.text', message: '소재·프로필·메모에 없는 숫자 "2" 을(를) 썼습니다.', from: 'rule' as const },
  { code: 'gloss_term_not_in_source', where: 'cards.4.glosses.0', message: '풀이한 용어 "만들지 않은 목록을 먼저 불러오기" 이 소재 원문에 없습니다. 소재에 나온 용어만 풀이하세요.', from: 'rule' as const },
  { code: 'review_style', where: 'cards.1', message: '말투가 조금 딱딱합니다', from: 'review' as const },
];

describe('「AI 가 고친 곳」 사람 말로 (결정 2026-10-25)', () => {
  it('카드 번호 + 이유 한 줄 — 규칙 코드 · 칸 경로를 보이지 않고, 같은 카드 · 같은 규칙은 한 줄로', () => {
    const lines = reasonLines(issues, 'body');
    expect(lines).toEqual([
      { place: '카드 5', reason: '소재에 없는 숫자 「1」 「2」가 있어 고쳤어요' },
      { place: '카드 6', reason: '소재에 없는 용어 「만들지 않은 목록을 먼저 불러오기」를 풀이해서 고쳤어요(풀이는 소재에 나온 용어만)' },
    ]);
    for (const l of lines) expect(`${l.place}${l.reason}`).not.toMatch(/[a-z]+_[a-z_]+|cards\.\d/);
  });

  it('카드 번호는 세트 화면과 같게(1번이 표지), 표지 후보는 후보 번호, 모르는 규칙은 일반 문장', () => {
    expect(placeOf('cards.0.text', 'body')).toBe('카드 2');
    expect(placeOf('titles.2.headline', 'cover')).toBe('표지 후보 3');
    expect(placeOf(null, 'body')).toBe('본문');
    expect(fieldOf('cards.4.glosses.0.term', 'body')).toBe('카드 6 · 풀이 용어');
    expect(fieldOf('titles.0.sub', 'cover')).toBe('표지 후보 1 · 부제');
    expect(reasonLines([{ code: 'new_rule_x', where: 'cards.0', message: '?', from: 'rule' }], 'body')[0]!.reason).toBe('규칙에 걸린 곳이 있어 고쳤어요');
  });

  it('전후는 바뀐 낱말만 지움 · 더함, 마크다운 강조 기호는 지운다', () => {
    const segs = wordDiff('**본 것 두 가지와** 하려던 것\n1. 에러', '**본 것 두 가지와** 하려던 것\n- 에러');
    expect(segs.map((s) => s.text).join('')).not.toContain('**');
    expect(segs.filter((s) => s.kind === 'del').map((s) => s.text.trim())).toEqual(['1.']);
    expect(segs.filter((s) => s.kind === 'add').map((s) => s.text.trim())).toEqual(['-']);
    expect(plain('**굵게**\n\n다음 줄')).toBe('굵게 다음 줄');
  });

  it('빈 쪽(없던 칸 · 지운 칸)은 통째로 더함 · 지움', () => {
    expect(wordDiff(null, '새 글')).toEqual([{ kind: 'add', text: '새 글' }]);
    expect(wordDiff('옛 글', null)).toEqual([{ kind: 'del', text: '옛 글' }]);
  });
});
