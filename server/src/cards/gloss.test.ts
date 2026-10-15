// 소재 밖 용어 풀이·비유 표시 (결정 2026-10-15 · 카드 풀이·그림 사람 규칙)
import { describe, expect, it } from 'vitest';
import { glossesStillIn, glossIssues, schemaFor } from './body.ts';

const SOURCE = ['내보내기는 Markdown 파일로만 된다. 태그를 붙이면 노트가 자동으로 묶인다.'];
const card = (text: string, glosses: Array<{ sentence: string; term: string }>) => ({ title: '내보내기는 파일로만', text, evidence: '내보내기는 Markdown 파일로만 된다.', image: null, glosses });

describe('풀이 표시의 코드 규칙', () => {
  it('소재에 나온 용어를 풀이하고 그 문장이 카드 글에 있으면 통과 — 지난번 놓친 「Markdown은 …」 모양', () => {
    const c = card('내보내기는 Markdown 파일로만 돼요.\n\n**Markdown은** 간단한 기호로 제목을 표시하는 글 파일 형식이에요.', [
      { sentence: 'Markdown은 간단한 기호로 제목을 표시하는 글 파일 형식이에요.', term: 'Markdown' },
    ]);
    expect(glossIssues('cards.0', c, SOURCE)).toEqual([]);
  });

  it('소재에 없는 용어를 새로 꺼내 풀이하면 위반', () => {
    const c = card('PDF는 어디서나 같은 모양으로 보이는 문서 형식이에요.', [{ sentence: 'PDF는 어디서나 같은 모양으로 보이는 문서 형식이에요.', term: 'PDF' }]);
    expect(glossIssues('cards.0', c, SOURCE).map((i) => i.code)).toEqual(['gloss_term_not_in_source']);
  });

  it('표시한 문장이 카드 글에 없으면 위반 (표시와 글이 어긋나면 화면이 엉뚱한 문장을 강조한다)', () => {
    const c = card('태그를 붙이면 노트가 묶여요.', [{ sentence: '태그는 노트에 다는 이름표예요.', term: '태그' }]);
    expect(glossIssues('cards.0', c, SOURCE).map((i) => i.code)).toEqual(['gloss_not_in_card']);
  });

  it('공백·문장부호·강조 표시가 달라도 같은 문장으로 본다', () => {
    const c = card('**태그는** 노트에 다는 이름표라고 생각하면 쉬워요!', [{ sentence: '태그는 노트에 다는 이름표라고 생각하면 쉬워요.', term: '태그' }]);
    expect(glossIssues('cards.0', c, SOURCE)).toEqual([]);
  });

  it('사용자가 직접 고쳐 카드 글에서 사라진 풀이 문장은 저장할 때 표시에서 뺀다', () => {
    const c = card('태그를 붙이면 노트가 묶여요.', [{ sentence: '태그는 노트에 다는 이름표예요.', term: '태그' }]);
    expect(glossesStillIn(c)).toEqual([]);
  });
});

describe('프롬프트 판마다 스키마', () => {
  const out = { cards: [{ title: 't', text: 'x', evidence: 'e', image: null }], closing: { headline: 'h', sub: null } };
  it('v1 은 그때 스키마 그대로(풀이 칸 없음) — v1/v2 비교 측정이 같은 조건이 되게', () => {
    expect(schemaFor('v1').safeParse(out).success).toBe(true);
  });
  it('v2 부터는 카드마다 풀이 칸이 있어야 한다(없으면 빈 배열로 답하게)', () => {
    expect(schemaFor('v2').safeParse(out).success).toBe(false);
    expect(schemaFor('v2').safeParse({ ...out, cards: [{ ...out.cards[0], glosses: [] }] }).success).toBe(true);
  });
});
