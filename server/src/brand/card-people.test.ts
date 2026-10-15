// 카드 그림의 사람 규칙 (결정 2026-10-15 · 카드 풀이·그림 사람 규칙): C안(실사 금지 · 그림체 허용) + 캐릭터 대체 · 실존 인물 이름 금지
import { describe, expect, it } from 'vitest';
import { cardPeopleRule, imagePromptIssues, type PeopleRule } from './visual.ts';

const codes = (prompt: string, people: PeopleRule = 'illustrated') =>
  imagePromptIssues('cards.0.image', { prompt: `${prompt}, 4:5, 1080x1350, no text`, filename: 'card-02-x.png' }, [], people).map((i) => i.code);

describe('카드 그림 — 그림체 사람은 허용, 사진처럼 보이는 사람은 금지', () => {
  it('그림체 사람·손은 통과', () => {
    expect(codes('Flat vector illustration of a person typing on a laptop at a desk')).toEqual([]);
    expect(codes('Warm gouache illustration of two hands holding a small plate with a cake')).toEqual([]); // 실제 프롬프트 #40 모양
    expect(codes('Simple silhouette of a student walking with a backpack, minimal')).toEqual([]);
  });

  it('사진 표현과 같이 쓴 사람·신체는 위반 — 「그림체」라고 써도 사진 말이 있으면', () => {
    expect(codes('Realistic photo of a woman holding a phone')).toEqual(['prompt_realistic_person']);
    expect(codes('Close-up of two hands holding a ceramic plate, shallow depth of field')).toEqual(['prompt_realistic_person']); // 실제 프롬프트 #44 모양
    expect(codes('Flat illustration of a man at a cafe, cinematic lighting')).toEqual(['prompt_realistic_person']);
  });

  it('그림체 표지가 없는 사람은 사진처럼 나올 수 있어 위반', () => {
    expect(codes('A man sitting at a cafe table with a latte')).toEqual(['prompt_realistic_person']);
  });

  it('사람 없는 사진은 통과(음식·공간 사진은 카드에 흔하다)', () => {
    expect(codes('Close-up food photography of a strawberry tart on a wooden table, no people')).toEqual([]);
    expect(codes('Bright cafe window seats, soft daylight, no people, no hands')).toEqual([]);
  });

  it('나이·외모 특정은 그림체여도 위반', () => {
    expect(codes('Flat illustration of a young woman in her 20s')).toContain('prompt_age_appearance');
    expect(codes('Cartoon of a person with long hair reading')).toContain('prompt_age_appearance');
  });

  it('실존 인물 이름 모양·「style of 이름」은 위반', () => {
    expect(codes('Flat illustration portrait of Steve Jobs on stage')).toContain('prompt_named_person');
    expect(codes('Kim Haneul smiling, flat icon style')).toContain('prompt_named_person');
    expect(codes('Cozy bakery interior in the style of Ghibli, illustration')).toContain('prompt_named_person');
  });

  it('꾸미는 말(「student vibe」)은 사람이 아니다 — 실제 프롬프트 #103', () => {
    expect(codes('Mascot character ZUN, flat vector illustration, approachable student vibe', 'character')).toEqual([]);
  });
});

describe('「보여 주는 방식」에 캐릭터가 있으면 사람 대신 캐릭터', () => {
  it('캐릭터 계정은 그림체 사람도 위반, 캐릭터 이름으로 쓴 그림은 통과', () => {
    expect(codes('Flat illustration of a person typing on a laptop', 'character')).toEqual(['prompt_person_not_character']);
    expect(codes('The mascot character ZUN waving next to a laptop, flat illustration, follow the reference image', 'character')).toEqual([]);
  });

  it('규칙 고르기: 설문 S6 덧붙일 말에 캐릭터·마스코트가 있으면 character', () => {
    expect(cardPeopleRule('안 한다 — 직접 만든 캐릭터(ZUN)로 대신한다')).toBe('character'); // me 프로필 스냅숏
    expect(cardPeopleRule('괜찮다')).toBe('illustrated');
    expect(cardPeopleRule('안 한다')).toBe('illustrated');
    expect(cardPeopleRule(null)).toBe('illustrated');
  });
});

describe('프로필 사진 규칙은 그대로 엄하게', () => {
  it('그림체 손도 위반 (본인이 아닌 사람의 몸)', () => {
    expect(codes('Warm gouache illustration of two hands holding a plate', 'forbid')).toEqual(['prompt_realistic_person']);
  });
  it('하이라이트(any)는 검사하지 않는다', () => {
    expect(codes('Realistic photo of a woman holding a phone', 'any')).toEqual([]);
  });
});
