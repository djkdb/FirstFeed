// 카드뉴스 만들기 화면이 쓰는 응답 모양 · 제목 글 도우미 — MakePage · CoverPicker · OverflowEditor 가 같이 쓴다
/** 강조 표시(**)를 뺀 제목 — 화면 글 · 단추 이름에 */
export const plain = (t: string) => t.replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ');

export interface Candidate {
  index: number;
  headline: string;
  sub: string | null;
  chip: string | null;
  png: string;
  scale: number;
}
export interface CoversResult {
  candidates: Candidate[];
  dropped: Array<{ headline: string; sub: string | null; reasons: string[] }>;
  calls: number;
  rewrites: number;
}
export interface Overflow {
  where: string;
  slot: string;
  message: string;
}
export interface Draft {
  cards: Array<{ title: string; text: string }>;
  closing: { headline: string; sub: string | null };
}
export type BodyResult =
  | { status: 'saved'; setId: number; calls: number; rewrites: number }
  | { status: 'needs_edit'; draft: Draft; overflows: Overflow[]; previews: Array<{ where: string; png: string | null }>; calls: number; rewrites: number }
  | { status: 'failed'; errors: string[]; calls: number; rewrites: number };
