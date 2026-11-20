import { describe, expect, it } from 'vitest';
import { buildLitly } from './litly.ts';
import { buildPost, findPostUrl, tistoryName } from './post.ts';

const cards = [
  { content: { kind: 'cover' as const, headline: '암벽화 사기 전\n**5가지**만 보세요', sub: '부제' }, pngFile: '01-cover.png' },
  { content: { kind: 'body' as const, title: '사이즈', text: '반 치수 **작게**.\n\n오후에 신어 보기 <꼭>', page: 2, total: 4 }, pngFile: '02-body.png' },
  { content: { kind: 'closing' as const, headline: '저장해 두세요' }, pngFile: '03-closing.png' },
];

describe('티스토리 글 만들기', () => {
  it('표지 제목 → 글 제목, 그림은 카드 순서, 글은 이스케이프 · 강조만 살린다', () => {
    const p = buildPost(cards, { hook: '6만 원 날렸어요', lines: [], hashtags: ['#암벽화', '#클라이밍', '#암벽화'] }, '/d', 10);
    expect(p.title).toBe('암벽화 사기 전 5가지만 보세요');
    expect(p.images).toEqual(['/d/01-cover.png', '/d/02-body.png', '/d/03-closing.png']);
    expect(p.html).toContain('<p>6만 원 날렸어요</p>');
    expect(p.html).toContain('<h3>사이즈</h3>');
    expect(p.html).toContain('<strong>작게</strong>');
    expect(p.html).toContain('&lt;꼭&gt;');
    expect(p.tags).toEqual(['암벽화', '클라이밍']);
  });
  it('캡션이 없으면 부제를 첫 문단으로, 태그는 없음', () => {
    const p = buildPost(cards, null, '/d', 10);
    expect(p.html.startsWith('<p>부제</p>')).toBe(true);
    expect(p.tags).toEqual([]);
  });
  it('블로그 이름은 주소를 넣어도 이름만', () => {
    expect(tistoryName('https://ilddan-bal.tistory.com/manage')).toBe('ilddan-bal');
    expect(tistoryName('ilddan')).toBe('ilddan');
    expect(tistoryName('나쁜 이름')).toBeNull();
  });
  it('RSS 에서 같은 제목의 글 주소', () => {
    const rss = '<rss><channel><item><title><![CDATA[다른 글]]></title><link>https://b.tistory.com/1</link></item><item><title>암벽화 사기 전 5가지만 보세요</title><link>https://b.tistory.com/2</link></item></channel></rss>';
    expect(findPostUrl(rss, '암벽화 사기 전 5가지만 보세요')).toBe('https://b.tistory.com/2');
    expect(findPostUrl(rss, '없는 글')).toBeNull();
  });
});

describe('리틀리 채울 것', () => {
  it('키트 · 기록에 있는 값만, 주소를 모르는 글은 뺀다', () => {
    const items = buildLitly({ displayName: '일단 발!', handle: 'ilddan.bal', bio: '바이오' }, 'ilddan', [
      { title: '글 1', url: 'https://ilddan.tistory.com/1' },
      { title: '글 2', url: null },
    ]);
    expect(items.map((i) => i.label)).toEqual(['프로필 이름', '소개', '인스타그램 @ilddan.bal', '블로그', '글 1']);
    expect(items[2]!.value).toBe('https://www.instagram.com/ilddan.bal/');
  });
});
