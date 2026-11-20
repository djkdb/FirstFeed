// 카드 세트 → 티스토리 글 한 편(코드만, AI 없음). 근거 규칙을 이미 통과한 원고 · 캡션만 옮기고 새 문장을 짓지 않는다.
// 구성: 카드 그림 전부(표지 → 마무리 순) 다음에 글 — 첫 줄(캡션 첫 줄) · 카드마다 제목과 본문 · 마무리. 인스타 캡션과 같은 해시태그를 태그로
import path from 'node:path';
import type { FrameContent } from '../../templates/types.ts';

export interface BlogPost {
  title: string;
  /** 편집기에 넣을 HTML(그림 뒤에 붙는 글) */
  html: string;
  tags: string[];
  /** 올릴 카드 그림(차례대로) */
  images: string[];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** **강조** → <strong>, 빈 줄 → 문단, 줄바꿈 → <br> */
function para(s: string): string {
  return s
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim()).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}
const plain = (s: string) => s.replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim();

export function buildPost(
  cards: Array<{ content: FrameContent; pngFile: string }>,
  caption: { hook: string; lines: string[]; hashtags: string[] } | null,
  dir: string,
  maxTags: number,
): BlogPost {
  const cover = cards.find((c) => c.content.kind === 'cover')?.content;
  const title = cover && cover.kind === 'cover' ? plain(cover.headline) : '카드뉴스';
  const parts: string[] = [];
  if (caption?.hook) parts.push(para(caption.hook));
  else if (cover && cover.kind === 'cover' && cover.sub) parts.push(para(cover.sub));
  for (const c of cards) {
    const k = c.content;
    if (k.kind === 'body') parts.push(`<h3>${esc(plain(k.title))}</h3>\n${para(k.text)}`);
    if (k.kind === 'closing') parts.push(`<p><strong>${esc(plain(k.headline))}</strong></p>${k.sub ? `\n${para(k.sub)}` : ''}`);
  }
  const tags = [...new Set((caption?.hashtags ?? []).map((t) => t.replace(/^#/, '').trim()).filter(Boolean))].slice(0, maxTags);
  return { title, html: parts.join('\n'), tags, images: cards.map((c) => path.join(dir, c.pngFile)) };
}

/** 블로그 이름 모양 — 「이름.tistory.com」 의 이름(영문 소문자 · 숫자 · 붙임표). 주소를 통째로 넣어도 이름만 꺼낸다 */
export function tistoryName(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const m = /^([a-z0-9-]{1,32})(?:\.tistory\.com)?$/.exec(s);
  return m ? m[1]! : null;
}

/** RSS 글목록에서 제목이 같은 글의 주소(가장 최근 것). 못 찾으면 null */
export function findPostUrl(rss: string, title: string): string | null {
  const norm = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  for (const item of rss.split(/<item[\s>]/).slice(1)) {
    const t = /<title>([\s\S]*?)<\/title>/.exec(item)?.[1];
    const l = /<link>([\s\S]*?)<\/link>/.exec(item)?.[1];
    if (t && l && norm(t) === norm(title)) return norm(l);
  }
  return null;
}
