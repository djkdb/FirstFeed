// 「AI 가 고친 곳」을 사람 말로 (결정 2026-10-25). 규칙 코드 · 칸 경로(cards.3.text) · 마크다운 기호(**)를 화면에 그대로 보이지 않는다.
// 규칙 코드마다 한국어 문장은 이 표 한 곳 — 새 규칙을 더하면 여기에도 한 줄. 표에 없는 코드는 일반 문장으로(코드를 보이지 않는다)
// 카드 번호는 세트 화면의 「1. 표지 · 2. 본문 …」과 같게: 본문 출력 cards.N 은 N + 2번 카드(1번이 표지)

export interface Issue {
  code: string;
  where: string | null;
  message: string;
  from: 'rule' | 'review';
}
export interface Change {
  path: string;
  before: string | null;
  after: string | null;
}
export type Part = 'cover' | 'body';

/** 메시지 속 따옴표 안 값(「"1"」 → 1) — 숫자 · 영문 이름 · 용어 */
const quoted = (m: string) => /"([^"]+)"/.exec(m)?.[1] ?? null;
const list = (vs: string[]) => vs.map((v) => `「${v}」`).join(' ');

/** 규칙 코드 → 무엇이 걸려 고쳤는지 한 줄. vs = 걸린 값들 */
export const REASON: Record<string, (vs: string[]) => string> = {
  number_not_in_source: (vs) => `소재에 없는 숫자${vs.length ? ` ${list(vs)}` : ''}가 있어 고쳤어요`,
  english_not_in_source: (vs) => `소재에 없는 영문 이름${vs.length ? ` ${list(vs)}` : ''}이 있어 고쳤어요`,
  mention_not_in_source: (vs) => `소재에 없는 계정 이름${vs.length ? ` ${list(vs)}` : ''}이 있어 고쳤어요`,
  gloss_term_not_in_source: (vs) => `소재에 없는 용어${vs.length ? ` ${list(vs)}` : ''}를 풀이해서 고쳤어요(풀이는 소재에 나온 용어만)`,
  gloss_not_in_card: () => '풀이 표시한 문장이 카드 글에 없어 고쳤어요',
  quote_not_in_source: () => '근거로 든 인용이 소재 원문에 없어 고쳤어요',
  quote_too_short: () => '근거 인용이 너무 짧아 고쳤어요',
  label_only_quote: () => '근거 인용이 질문 이름만 옮긴 것이라 고쳤어요',
  count_mismatch: () => '표지의 개수(「N가지」)와 본문 카드 수가 달라 고쳤어요',
  cover_fact_missing: (vs) => `표지에 쓴 사실${vs.length ? ` ${list(vs)}` : ''}이 본문에 없어 고쳤어요`,
  dated_number_without_date: (vs) => `기준일이 있는 숫자${vs.length ? ` ${list(vs)}` : ''}를 기준일 없이 써서 고쳤어요`,
  text_overflow: () => '카드에 그려 보니 글이 칸을 넘쳐 줄였어요',
  too_many_lines: () => '카드에 그려 보니 줄 수가 넘쳐 줄였어요',
  text_outside_card: () => '카드에 그려 보니 글이 카드 밖으로 나가 고쳤어요',
  text_outside_safe: () => '인스타 격자에서 잘리는 자리에 글이 걸려 고쳤어요',
  text_overlap: () => '카드에 그려 보니 글끼리 겹쳐 고쳤어요',
  too_long: () => '글자 수 상한을 넘어 줄였어요',
  too_long_for_template: () => '고정한 틀의 글자 수를 넘어 줄였어요',
  duplicate_candidate: () => '다른 후보와 거의 같아 고쳤어요',
  unknown_pillar: () => '프로필에 없는 축을 골라 고쳤어요',
  bad_filename: () => '그림 파일 이름 모양이 맞지 않아 고쳤어요',
  prompt_realistic_person: () => '그림 프롬프트에 실제 사람처럼 보이는 표현이 있어 고쳤어요',
  prompt_named_person: () => '그림 프롬프트에 실존 인물 이름 모양이 있어 고쳤어요',
  prompt_age_appearance: () => '그림 프롬프트에 나이 · 외모 묘사가 있어 고쳤어요',
  prompt_person_not_character: () => '캐릭터 계정인데 그림 프롬프트에 사람이 있어 고쳤어요',
  prompt_not_english: () => '그림 프롬프트를 영어로 다시 썼어요',
  prompt_missing_size: () => '그림 프롬프트에 크기 · 비율이 빠져 더했어요',
  prompt_missing_no_text: () => '그림 프롬프트에 「글자 없음」이 빠져 더했어요',
  hashtag_format: () => '해시태그 모양이 맞지 않아 고쳤어요',
  review_fact: () => '다시 읽어 보니 소재와 다른 사실이 있어 고쳤어요(자기 평가)',
  review_broken: () => '다시 읽어 보니 글이 깨진 곳이 있어 고쳤어요(자기 평가)',
};
const FALLBACK = '규칙에 걸린 곳이 있어 고쳤어요';

/** 칸 경로의 첫 마디로 어느 카드 · 후보인지 */
export function placeOf(where: string | null, part: Part): string {
  const m = where ? /^(cards|titles)\.(\d+)/.exec(where) : null;
  if (!m) return part === 'cover' ? '표지 후보' : '본문';
  const n = Number(m[2]);
  return m[1] === 'cards' ? `카드 ${n + 2}` : `표지 후보 ${n + 1}`;
}

/** 바뀐 칸 이름(어느 카드의 어느 글) */
export function fieldOf(path: string, part: Part): string {
  const place = placeOf(path, part);
  const rest = path.replace(/^(cards|titles)\.\d+\.?/, '');
  const name: Record<string, string> = { text: '글', title: '제목', headline: '제목', sub: '부제', chip: '배지', 'image.prompt': '그림 프롬프트', 'image.filename': '그림 파일 이름' };
  const gloss = /^glosses\.\d+\.(term|sentence)$/.exec(rest);
  if (gloss) return `${place} · 풀이 ${gloss[1] === 'term' ? '용어' : '문장'}`;
  return `${place} · ${name[rest] ?? '글'}`;
}

export interface ReasonLine {
  place: string;
  reason: string;
}

/** 걸린 것들을 「카드 N · 이유」로 — 같은 카드 · 같은 규칙은 한 줄로 모으고 값은 합친다. 자기 평가의 말투 경고(style)는 고친 이유가 아니라 뺀다 */
export function reasonLines(issues: Issue[], part: Part): ReasonLine[] {
  const groups = new Map<string, { place: string; code: string; values: string[] }>();
  for (const i of issues) {
    if (i.code === 'review_style' || i.code === 'review_failed') continue;
    const place = placeOf(i.where, part);
    const key = `${place}|${i.code}`;
    const g = groups.get(key) ?? { place, code: i.code, values: [] };
    const v = quoted(i.message);
    if (v && !g.values.includes(v)) g.values.push(v);
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({ place: g.place, reason: (REASON[g.code] ?? (() => FALLBACK))(g.values) }));
}

/** 화면에 보일 글: 강조 표시(**) 를 지우고 줄바꿈은 공백 하나로 */
export const plain = (s: string | null) => (s ?? '').replace(/\*\*/g, '').replace(/\s*\n+\s*/g, ' ').trim();

export interface Seg {
  kind: 'same' | 'del' | 'add';
  text: string;
}

/** 낱말 단위 전후 비교(가장 긴 공통 부분열). 바뀐 곳만 del(지운 것) · add(더한 것) — 길면 통째로 지움 · 더함 */
export function wordDiff(before: string | null, after: string | null): Seg[] {
  const a = plain(before).split(/(\s+)/).filter(Boolean);
  const b = plain(after).split(/(\s+)/).filter(Boolean);
  if (a.length * b.length > 250_000) return [...(a.length ? [{ kind: 'del' as const, text: a.join('') }] : []), ...(b.length ? [{ kind: 'add' as const, text: b.join('') }] : [])];
  const L = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i]![j] = a[i] === b[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const out: Seg[] = [];
  const push = (kind: Seg['kind'], text: string) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('same', a[i]!);
      i++;
      j++;
    } else if (L[i + 1]![j]! >= L[i]![j + 1]!) push('del', a[i++]!);
    else push('add', b[j++]!);
  }
  while (i < a.length) push('del', a[i++]!);
  while (j < b.length) push('add', b[j++]!);
  // 공백만 바뀐 조각은 같은 것으로 — 띄어쓰기 하나에 취소선이 생기지 않게
  return out.map((s) => (s.kind !== 'same' && !s.text.trim() ? { ...s, kind: 'same' as const } : s));
}
