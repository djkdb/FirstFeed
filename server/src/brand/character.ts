// 개성 캐릭터 이미지 프롬프트 기계(2026-11-08 사용자 지시 — 실사 프롬프트 제작기를 레퍼런스로, 그대로 옮기지 않고 구조만).
// 단계마다 고른 값 → 정해 둔 영어 구절을 이어 붙여 프롬프트를 만든다. 순수 함수라 화면이 그대로 불러 즉시 보여 주고, 서버는 저장 전 같은 검사를 한다.
// - AI 는 그림을 만들지 않는다(비목표). 프롬프트만 뽑는다
// - 생김새는 사용자가 고른 값만 들어간다 — AI 가 지어내지 않는다(결정 2026-10-15 「캐릭터 생김새는 지어내지 않는다」와 같은 뜻: 여기서는 사용자가 직접 정한다)
// - 실사 사람 · 실존 인물 이름 · 「in the style of …」(작가 화풍 흉내)는 금지 — 카드 그림 규칙(C안)과 같은 이유. 몸매 · 성인 옵션 같은 민감 항목은 두지 않는다
import type { Palette, PaletteRole } from '../reels/model.ts';

export type CharacterKind = 'human' | 'animal' | 'object' | 'creature';

interface Opt {
  id: string;
  ko: string;
  en: string;
}
const o = (id: string, ko: string, en: string): Opt => ({ id, ko, en });

/** 선택지 표 — 화면 · 프롬프트 · AI 추천의 스키마가 모두 이 표에서 나온다 */
export const CHARACTER_OPTIONS = {
  kind: [o('human', '사람형 캐릭터', 'an original illustrated human-like mascot character'), o('animal', '동물', 'an original animal mascot character'), o('object', '사물', 'an original object mascot character'), o('creature', '상상 생물', 'an original fantasy creature mascot character')],
  species: {
    human: [o('round', '동글동글 2등신', 'with a round, simple two-head-tall body'), o('slim', '길쭉한 3~4등신', 'with a simple three-to-four-head-tall body'), o('blob', '얼굴만 큰 말랑이', 'with a big round head and a tiny body')],
    animal: [o('cat', '고양이', 'a cat'), o('dog', '강아지', 'a puppy'), o('rabbit', '토끼', 'a rabbit'), o('bear', '곰', 'a bear cub'), o('fox', '여우', 'a fox'), o('penguin', '펭귄', 'a penguin'), o('hamster', '햄스터', 'a hamster'), o('owl', '부엉이', 'an owl'), o('otter', '수달', 'an otter'), o('duck', '오리', 'a duckling')],
    object: [o('laptop', '노트북', 'a laptop'), o('mug', '머그컵', 'a coffee mug'), o('book', '책', 'a book'), o('plant', '화분', 'a potted plant'), o('camera', '카메라', 'a camera'), o('note', '메모지', 'a sticky note'), o('robot', '작은 로봇', 'a small robot'), o('cloud', '구름', 'a cloud')],
    creature: [o('ghost', '꼬마 유령', 'a little ghost'), o('slime', '슬라임', 'a jelly slime'), o('dragon', '아기 용', 'a baby dragon'), o('star', '별 요정', 'a star sprite'), o('dino', '공룡', 'a baby dinosaur'), o('alien', '외계인', 'a tiny alien')],
  },
  style: [
    o('flat', '플랫 벡터', 'flat vector illustration'),
    o('webtoon', '웹툰', 'Korean webtoon-style illustration'),
    o('chibi', 'SD 미니', 'chibi illustration with big head proportions'),
    o('sticker', '스티커', 'die-cut sticker illustration with a white outline'),
    o('watercolor', '수채화', 'soft watercolor illustration'),
    o('crayon', '크레용 낙서', 'hand-drawn crayon doodle illustration'),
    o('pixel', '픽셀', '16-bit pixel art illustration'),
    o('clay', '클레이 느낌', 'soft clay-like 3D illustration, toy figure look'),
    o('lineart', '선 하나 낙서', 'minimal single-line doodle illustration'),
    o('storybook', '그림책', "children's picture book illustration"),
  ],
  line: [o('clean', '깔끔한 선', 'clean even outlines'), o('bold', '굵은 선', 'thick bold outlines'), o('sketchy', '연필 느낌 선', 'loose sketchy lines'), o('none', '선 없음', 'no outlines, shape-based')],
  shading: [o('flat', '단색', 'flat colors without shading'), o('cel', '2단 명암', 'two-tone cel shading'), o('soft', '부드러운 그라데이션', 'soft gradient shading'), o('grain', '종이 질감', 'subtle paper grain texture')],
  eyes: [o('dot', '점 눈', 'simple dot eyes'), o('round', '동그란 눈', 'big round shiny eyes'), o('sleepy', '졸린 눈', 'half-closed sleepy eyes'), o('smile', '웃는 눈(^^)', 'happy closed curved eyes'), o('glasses', '안경 쓴 눈', 'round glasses over the eyes')],
  hair: [o('none', '없음', ''), o('short', '짧은 머리', 'short tidy hair'), o('bob', '단발', 'a bob cut'), o('long', '긴 머리', 'long straight hair'), o('curly', '곱슬', 'fluffy curly hair'), o('bun', '똥머리', 'a top bun'), o('beanie', '비니로 덮음', 'a beanie covering the hair')],
  marking: [o('none', '없음', ''), o('spots', '점박이', 'small round spots'), o('stripes', '줄무늬', 'soft stripes'), o('patch', '한쪽 눈 얼룩', 'a color patch around one eye'), o('blush', '볼터치', 'rosy cheek blush'), o('sticker', '몸에 작은 스티커', 'a small sticker on its body')],
  outfit: [o('none', '없음', ''), o('hoodie', '후드티', 'a hoodie'), o('shirt', '셔츠', 'a collared shirt'), o('apron', '앞치마', 'an apron'), o('overalls', '멜빵바지', 'overalls'), o('raincoat', '우비', 'a raincoat'), o('scarf', '목도리', 'a knitted scarf'), o('cape', '망토', 'a small cape')],
  accessory: [
    o('headphones', '헤드폰', 'headphones'),
    o('cap', '모자', 'a cap'),
    o('backpack', '백팩', 'a small backpack'),
    o('laptop', '노트북 들기', 'holding a tiny laptop'),
    o('coffee', '커피 들기', 'holding a coffee cup'),
    o('pencil', '연필 들기', 'holding a big pencil'),
    o('book', '책 들기', 'holding a book'),
    o('camera', '카메라 메기', 'a camera strap around the neck'),
    o('flower', '꽃 꽂기', 'a small flower on the head'),
    o('badge', '이름표', 'a blank round badge'),
  ],
  personality: [
    o('cheerful', '밝음', 'cheerful'),
    o('calm', '차분함', 'calm'),
    o('curious', '호기심', 'curious'),
    o('nerdy', '덕후 기질', 'nerdy and focused'),
    o('confident', '자신감', 'confident'),
    o('shy', '수줍음', 'a little shy'),
    o('playful', '장난기', 'playful'),
    o('grumpy', '시큰둥 귀염', 'grumpy but cute'),
  ],
  expression: [o('smile', '미소', 'a gentle smile'), o('grin', '활짝', 'a big grin'), o('wink', '윙크', 'a playful wink'), o('focused', '집중', 'a focused look'), o('surprised', '놀람', 'a surprised face'), o('thinking', '생각 중', 'a thinking face')],
  pose: [o('wave', '손 흔들기', 'waving hello'), o('thumbs', '엄지 척', 'giving a thumbs up'), o('point', '가리키기', 'pointing to the side'), o('hold', '소품 들어 보이기', 'holding up its item proudly'), o('sit', '앉아 있기', 'sitting comfortably'), o('jump', '폴짝', 'jumping with joy'), o('peek', '빼꼼', 'peeking from the side')],
  background: [o('plain', '브랜드 바탕색', 'a plain solid background'), o('white', '흰 바탕(누끼용)', 'a plain white background'), o('gradient', '부드러운 그라데이션', 'a soft two-color gradient background')],
  aspect: [o('1:1', '1:1 정사각', 'square 1:1 composition'), o('4:5', '4:5 피드', 'vertical 4:5 composition'), o('9:16', '9:16 릴스', 'vertical 9:16 composition')],
} as const;

type IdsOf<T extends readonly Opt[]> = T[number]['id'];
type Options = typeof CHARACTER_OPTIONS;

export interface CharacterSpec {
  /** 그림 프롬프트에는 넣지 않는다(이미지 모델이 글자로 그려 넣는다) — 앱 안 이름 · 카드 프롬프트가 부르는 이름. 영문 한 낱말 */
  name: string;
  kind: CharacterKind;
  species: string;
  style: IdsOf<Options['style']>;
  line: IdsOf<Options['line']>;
  shading: IdsOf<Options['shading']>;
  eyes: IdsOf<Options['eyes']>;
  hair: IdsOf<Options['hair']>;
  marking: IdsOf<Options['marking']>;
  outfit: IdsOf<Options['outfit']>;
  /** 최대 2개 */
  accessories: Array<IdsOf<Options['accessory']>>;
  /** 최대 2개 */
  personality: Array<IdsOf<Options['personality']>>;
  expression: IdsOf<Options['expression']>;
  pose: IdsOf<Options['pose']>;
  background: IdsOf<Options['background']>;
  aspect: IdsOf<Options['aspect']>;
  /** 몸 · 옷 · 소품 색 — 팔레트 칸 이름(팔레트를 바꾸면 따라간다) */
  bodyColor: PaletteRole;
  accentColor: PaletteRole;
  /** 사용자가 덧붙이는 영어 한 줄(선택) — 규칙 검사를 거친다 */
  extra: string;
}

export const defaultCharacter = (): CharacterSpec => ({
  name: '',
  kind: 'animal',
  species: 'cat',
  style: 'flat',
  line: 'clean',
  shading: 'cel',
  eyes: 'round',
  hair: 'none',
  marking: 'blush',
  outfit: 'hoodie',
  accessories: ['laptop'],
  personality: ['curious'],
  expression: 'smile',
  pose: 'wave',
  background: 'plain',
  aspect: '1:1',
  bodyColor: 'primary',
  accentColor: 'accent',
  extra: '',
});

const find = (list: readonly Opt[], id: string) => list.find((x) => x.id === id);

export interface PromptPart {
  /** 화면에 보일 단계 이름 */
  step: string;
  /** 고른 값(한국어) */
  picked: string;
  /** 프롬프트에 들어간 구절 — 비어 있으면 「없음」을 고른 것 */
  phrase: string;
}

const ROLE_KO: Record<PaletteRole, string> = { primary: '주색', secondary: '보조색', accent: '강조색', background: '바탕색', text: '글자색' };

/** 고른 값 → 단계별 구절. 「반영 확인」이 이 목록을 그대로 보여 준다 */
export function characterParts(s: CharacterSpec, palette: Palette): PromptPart[] {
  const C = CHARACTER_OPTIONS;
  const kind = find(C.kind, s.kind)!;
  const species = find(C.species[s.kind], s.species);
  const parts: PromptPart[] = [
    { step: '종류', picked: kind.ko, phrase: kind.en },
    { step: s.kind === 'human' ? '몸 비율' : '무엇', picked: species?.ko ?? '-', phrase: s.kind === 'human' ? (species?.en ?? '') : species ? `shaped like ${species.en}` : '' },
    { step: '그림체', picked: find(C.style, s.style)?.ko ?? '-', phrase: find(C.style, s.style)?.en ?? '' },
    { step: '선', picked: find(C.line, s.line)?.ko ?? '-', phrase: find(C.line, s.line)?.en ?? '' },
    { step: '채색', picked: find(C.shading, s.shading)?.ko ?? '-', phrase: find(C.shading, s.shading)?.en ?? '' },
    { step: '눈', picked: find(C.eyes, s.eyes)?.ko ?? '-', phrase: find(C.eyes, s.eyes)?.en ?? '' },
  ];
  if (s.kind === 'human') parts.push({ step: '머리', picked: find(C.hair, s.hair)?.ko ?? '-', phrase: find(C.hair, s.hair)?.en ?? '' });
  else parts.push({ step: '무늬', picked: find(C.marking, s.marking)?.ko ?? '-', phrase: find(C.marking, s.marking)?.en ?? '' });
  const outfit = find(C.outfit, s.outfit);
  parts.push(
    { step: '몸 색', picked: `${ROLE_KO[s.bodyColor]} ${palette[s.bodyColor]}`, phrase: `main color ${palette[s.bodyColor]}` },
    { step: '옷', picked: outfit?.ko ?? '-', phrase: outfit?.en ? `wearing ${outfit.en} in ${palette[s.accentColor]}` : '' },
    { step: '소품', picked: s.accessories.map((a) => find(C.accessory, a)?.ko).filter(Boolean).join(' · ') || '없음', phrase: s.accessories.map((a) => find(C.accessory, a)?.en).filter(Boolean).join(' and ') },
    { step: '강조 색', picked: `${ROLE_KO[s.accentColor]} ${palette[s.accentColor]}`, phrase: `accent color ${palette[s.accentColor]}` },
    { step: '성격', picked: s.personality.map((p) => find(C.personality, p)?.ko).filter(Boolean).join(' · ') || '없음', phrase: s.personality.length ? `a ${s.personality.map((p) => find(C.personality, p)?.en).filter(Boolean).join(', ')} personality` : '' },
    { step: '표정', picked: find(C.expression, s.expression)?.ko ?? '-', phrase: find(C.expression, s.expression)?.en ?? '' },
    { step: '포즈', picked: find(C.pose, s.pose)?.ko ?? '-', phrase: find(C.pose, s.pose)?.en ?? '' },
    {
      step: '배경',
      picked: find(C.background, s.background)?.ko ?? '-',
      phrase: s.background === 'plain' ? `a plain solid ${palette.background} background` : s.background === 'gradient' ? `a soft gradient background from ${palette.background} to ${palette.secondary}` : (find(C.background, s.background)?.en ?? ''),
    },
    { step: '비율', picked: find(C.aspect, s.aspect)?.ko ?? '-', phrase: find(C.aspect, s.aspect)?.en ?? '' },
  );
  if (s.extra.trim()) parts.push({ step: '덧붙인 말', picked: s.extra.trim(), phrase: s.extra.trim() });
  return parts;
}

/** 같은 캐릭터를 다시 뽑을 때 늘 붙이는 「고정 설명」— 생김새 · 색만(포즈 · 표정 · 배경 · 비율 빼고). 카드 그림 프롬프트가 참고하는 설명 */
export function characterDna(s: CharacterSpec, palette: Palette): string {
  const p = Object.fromEntries(characterParts(s, palette).map((x) => [x.step, x.phrase])) as Record<string, string>;
  const look = [p['몸 비율'] ?? p['무엇'], p['눈'], p['머리'] ?? p['무늬'], p['몸 색'], p['옷'], p['소품'], p['강조 색']].filter(Boolean).join(', ');
  return `${p['종류']}, ${look}. ${p['그림체']}, ${p['선']}, ${p['채색']}.`;
}

const TAIL = 'Illustrated character, not photorealistic. Clean silhouette, centered, full body visible, no text, no letters, no watermark, no logo.';
// 한 덩어리 부정문으로 — 쉼표로 끊으면 「real photo」 같은 뒤 조각이 부정 밖으로 나와 사진 표현으로 읽힌다(카드 그림 규칙 withoutNegations 와 같은 읽기)
const AVOID = 'Avoid photorealistic rendering or real photos or extra limbs or a cropped head or a busy background.';

export interface CharacterPrompts {
  /** 캐릭터 한 장(고른 포즈 · 표정 · 배경 · 비율) */
  main: string;
  /** 캐릭터 시트 — 같은 캐릭터의 앞 · 옆 · 뒤 + 표정 6개(일관성용) */
  sheet: string;
  /** 고정 설명 — 다시 뽑을 때 · 카드 그림이 부를 때 */
  dna: string;
  /** 한국어 풀이(사람이 읽는 것 — 프롬프트에는 안 넣음) */
  ko: string;
  parts: PromptPart[];
}

export function characterPrompts(s: CharacterSpec, palette: Palette): CharacterPrompts {
  const parts = characterParts(s, palette);
  const p = Object.fromEntries(parts.map((x) => [x.step, x.phrase])) as Record<string, string>;
  const dna = characterDna(s, palette);
  const scene = [p['성격'] ? `It has ${p['성격']}, showing ${p['표정']}` : `It shows ${p['표정']}`, p['포즈']].filter(Boolean).join(', ');
  const main = [dna, `${scene}.`, `Set on ${p['배경']}, ${p['비율']}.`, p['덧붙인 말'] ? `${p['덧붙인 말']}.` : '', TAIL, AVOID].filter(Boolean).join(' ');
  const sheet = [
    'Character reference sheet of one consistent character:',
    dna,
    'Show the same character three times in a row (front view, side view, back view), and below it six facial expressions (happy, surprised, thinking, sad, laughing, determined).',
    'Identical proportions, colors and details in every view.',
    `Plain white background, wide 16:9 sheet layout. ${TAIL} ${AVOID}`,
  ].join(' ');
  const ko = parts
    .filter((x) => x.phrase)
    .map((x) => `${x.step}: ${x.picked}`)
    .join(' · ');
  return { main, sheet, dna, ko, parts };
}

export interface CharacterIssue {
  level: 'error' | 'warn';
  code: string;
  message: string;
}

// 카드 그림 규칙(server/src/brand/visual.ts)과 같은 모양 — 사진 표지 · 실존 인물 이름 · 화풍 흉내
const PHOTO_WORDS = /\b(?:photos?|photograph(?:s|y|ic)?|photo-?realistic|hyper-?realistic|realistic|lifelike|cinematic|dslr|\d{2}mm|bokeh|shot on|film still|octane|unreal engine)\b/i;
const NAME_LIKE = /\b[A-Z][a-z]+(?:[ -][A-Z][a-z]+)+\b/;
const STYLE_OF = /\b(?:in the )?style of\b|\bby (?:artist )?[A-Z][a-z]+/i;
/** 민감 항목은 선택지에 없다 — 덧붙인 말로도 넣지 못하게 */
const SENSITIVE = /\b(?:sexy|nude|naked|lingerie|bikini|cleavage|seductive|nsfw|erotic|busty|gore|blood)\b/i;

/** 저장 · 복사 전 검사. 고른 값은 표 안의 구절이라 늘 안전하고, 사용자가 쓴 이름 · 덧붙인 말만 잰다 */
export function characterIssues(s: CharacterSpec): CharacterIssue[] {
  const out: CharacterIssue[] = [];
  const C = CHARACTER_OPTIONS;
  if (!find(C.kind, s.kind) || !find(C.species[s.kind], s.species)) out.push({ level: 'error', code: 'bad_option', message: '종류 · 무엇을 다시 고르세요.' });
  if (s.accessories.length > 2) out.push({ level: 'error', code: 'too_many_accessories', message: '소품은 2개까지 — 많으면 캐릭터가 복잡해져 다시 뽑을 때 달라져요.' });
  if (s.personality.length > 2) out.push({ level: 'error', code: 'too_many_personality', message: '성격은 2개까지 골라요.' });
  if (s.name && !/^[A-Za-z][A-Za-z0-9]{0,15}$/.test(s.name)) out.push({ level: 'error', code: 'bad_name', message: '이름은 영문 한 낱말(16자 이내)로 — 카드 그림 프롬프트가 이 이름으로 부르는데, 프롬프트는 영어라서요.' });
  const extra = s.extra.trim();
  if (extra) {
    if (/[ㄱ-ㆎ가-힣]/.test(extra)) out.push({ level: 'error', code: 'extra_not_english', message: '덧붙인 말은 영어로 써 주세요(그림 프롬프트는 영어).' });
    if (extra.length > 160) out.push({ level: 'error', code: 'extra_too_long', message: '덧붙인 말은 160자 이내로.' });
    const photo = PHOTO_WORDS.exec(extra);
    if (photo) out.push({ level: 'error', code: 'extra_photo', message: `「${photo[0]}」 — 사진처럼 만드는 말은 쓸 수 없어요. 캐릭터는 그림체로만 뽑아요(실사 사람 금지 · 결정 2026-10-15).` });
    const named = STYLE_OF.exec(extra) ?? NAME_LIKE.exec(extra);
    if (named) out.push({ level: 'error', code: 'extra_named', message: `「${named[0]}」 — 실존 인물 · 작가 이름이나 「…풍으로」는 쓸 수 없어요. 그림체 단계에서 골라 주세요.` });
    const bad = SENSITIVE.exec(extra);
    if (bad) out.push({ level: 'error', code: 'extra_sensitive', message: `「${bad[0]}」 — 계정 캐릭터에 쓸 수 없는 말이에요.` });
  }
  if (!s.name) out.push({ level: 'warn', code: 'no_name', message: '이름을 정하면 카드 그림 프롬프트가 이 캐릭터를 이름으로 불러요.' });
  return out;
}
