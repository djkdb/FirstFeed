// 사용자 시뮬레이션(2026-11-09)에서 찾은 것: 「4번 카드」 아래 card-03 이름 · 캐릭터 이름만 부르는 프롬프트
import { describe, expect, it } from 'vitest';
import { cardImageName, withCharacter } from './imageName.ts';

describe('카드 그림 이름 · 캐릭터 고정 설명', () => {
  it('파일 이름 번호를 화면 카드 번호(idx + 1)로 맞추고 뒤 이름은 남긴다', () => {
    expect(cardImageName(3, 'card-03-sixteen-clicks.png')).toBe('card-04-sixteen-clicks.png');
    expect(cardImageName(1, 'morning-drip.png')).toBe('card-02-morning-drip.png');
    expect(cardImageName(0, 'card-1.png')).toBe('card-01.png');
  });
  it('계정 캐릭터가 있으면 고정 설명을 앞에, 없으면 그대로', () => {
    expect(withCharacter('Flat illustration of Puff ...', { name: 'Puff', dna: 'a little ghost.' })).toBe('Puff: a little ghost. Flat illustration of Puff ...');
    expect(withCharacter('x', null)).toBe('x');
  });
});
