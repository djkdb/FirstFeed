// 표시된 풀이 문장의 확인·직접 고치기 (결정 2026-10-18 · FR-PB-1). 표시된 풀이를 모두 확인하거나 고치기 전엔 업로드 폴더를 만들 수 없다.
// 직접 고친 문장은 사용자 글(허용 출처 4번)이라 근거 규칙은 걸지 않고, 같은 고정 틀로 다시 그려 넘침만 본다(바이오·직접 줄이기와 같은 원칙)
import type { Db } from '../db/index.ts';
import { normalizeForQuote } from '../rules/grounding.ts';
import { resolveLook } from '../templates/look.ts';
import { draftById } from '../templates/index.ts';
import { renderFrame } from '../templates/render-frame.ts';
import { getTemplateVersion } from '../templates/store.ts';
import type { BodyContent } from '../templates/types.ts';
import { getSet, replaceCard, updateCardGlosses, type GlossMark } from './store.ts';

export class GlossError extends Error {}

/**
 * 글 속에서 풀이 문장의 실제 자리: 표시는 공백·문장부호·강조(**)가 달라도 같은 문장으로 봤으므로(정규화 대조),
 * 고칠 때는 원래 글의 어느 부분인지 다시 찾는다. 가장 짧은 일치 구간
 */
export function findRawSpan(text: string, sentence: string): [number, number] | null {
  const target = normalizeForQuote(sentence);
  if (!target) return null;
  for (let start = 0; start < text.length; start++) {
    if (!normalizeForQuote(text[start]!) || !target.startsWith(normalizeForQuote(text[start]!))) continue;
    for (let end = start + 1; end <= text.length; end++) {
      const n = normalizeForQuote(text.slice(start, end));
      if (n === target) {
        // 문장 끝 문장부호까지 함께 바꾼다
        let a = start;
        let e = end;
        while (e < text.length && /[.!?。…]/.test(text[e]!)) e++;
        // 강조(**)가 구간 안에서 짝이 안 맞으면 바깥의 짝을 함께 넣는다 — 고친 뒤 짝 잃은 ** 가 남지 않게
        const odd = () => (text.slice(a, e).match(/\*\*/g)?.length ?? 0) % 2 === 1;
        if (odd() && text.slice(a - 2, a) === '**') a -= 2;
        if (odd() && text.slice(e, e + 2) === '**') e += 2;
        return [a, e];
      }
      if (!target.startsWith(n)) break;
    }
  }
  return null;
}

/** 아직 확인하지 않은 풀이 표시 (카드 번호와 함께) — 업로드 폴더를 막는 조건 */
export function uncheckedGlosses(set: NonNullable<ReturnType<typeof getSet>>): Array<{ idx: number; gloss: GlossMark }> {
  return set.cards.flatMap((c) => (c.glosses ?? []).filter((g) => !g.checkedAt).map((gloss) => ({ idx: c.idx, gloss })));
}

export function checkGloss(db: Db, setId: number, idx: number, sentence: string, checked: boolean): GlossMark[] {
  const set = getSet(db, setId);
  const card = set?.cards.find((c) => c.idx === idx);
  const glosses = card?.glosses ?? null;
  if (!glosses || !glosses.some((g) => g.sentence === sentence)) throw new GlossError('그 풀이 표시를 찾지 못했습니다. 화면을 새로고침하세요.');
  const next = glosses.map((g) => (g.sentence === sentence ? { ...g, checkedAt: checked ? new Date().toISOString() : null } : g));
  updateCardGlosses(db, setId, idx, next);
  return next;
}

/**
 * 풀이 문장을 사용자가 직접 고친다(빈 글이면 그 문장을 지운다). 같은 고정 틀 판으로 다시 그려 넘치면 저장하지 않고 이유를 돌려준다.
 * 고친 문장은 사용자 글이라 표시에서 빠진다(확인할 「소재 밖 설명」이 아니다)
 */
export async function editGloss(
  db: Db,
  dataDir: string,
  setId: number,
  idx: number,
  sentence: string,
  replacement: string,
): Promise<{ ok: true } | { ok: false; problems: string[] }> {
  const set = getSet(db, setId);
  const card = set?.cards.find((c) => c.idx === idx);
  if (!set || !card || card.kind !== 'body' || !card.glosses?.some((g) => g.sentence === sentence)) throw new GlossError('그 풀이 표시를 찾지 못했습니다. 화면을 새로고침하세요.');
  const content = card.content as BodyContent;
  const field = findRawSpan(content.text, sentence) ? 'text' : findRawSpan(content.title, sentence) ? 'title' : null;
  if (!field) throw new GlossError('카드 글에서 그 문장을 찾지 못했습니다. 화면을 새로고침하세요.');
  const [a, b] = findRawSpan(content[field], sentence)!;
  const replaced = `${content[field].slice(0, a)}${replacement.trim()}${content[field].slice(b)}`.replace(/\n{3,}/g, '\n\n').trim();
  if (!replaced) return { ok: false, problems: ['카드 글이 비게 됩니다. 문장을 지우지 말고 고쳐 쓰세요.'] };
  const next: BodyContent = { ...content, [field]: replaced };
  const tv = getTemplateVersion(db, set.templateVersionId);
  const draft = tv ? draftById(tv.draftId) : undefined;
  if (!tv || !draft) throw new GlossError('이 세트를 그린 템플릿 판을 찾지 못했습니다.');
  const r = await renderFrame(db, draft, resolveLook(tv.look, dataDir), next);
  if (!r.ok || !r.png) return { ok: false, problems: [...r.shorten.map((x) => x.message), ...r.problems.map((x) => x.message)].slice(0, 3) };
  replaceCard(db, dataDir, setId, idx, {
    content: next,
    png: r.png,
    render: { browser: `${r.browser.kind} ${r.browser.version}`, reference: r.browser.reference, scale: r.scale },
    glosses: card.glosses.filter((g) => g.sentence !== sentence),
  });
  return { ok: true };
}
