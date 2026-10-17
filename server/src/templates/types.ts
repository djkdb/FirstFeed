// 템플릿(FR-TP) 모양. 시안 하나 = 카드 표지·본문·마무리(1080×1350) + 릴스 표지(1080×1920) 네 틀.
export type FrameKind = 'cover' | 'body' | 'closing' | 'reel_cover';

export interface BrandLook {
  palette: { name?: string; primary: string; secondary: string; accent: string; background: string; text: string };
  /** brand/fonts.ts 의 id */
  titleFont: string;
  bodyFont: string;
  handle: string | null;
  displayName: string | null;
  /** 렌더링 페이지에서 쓸 주소(data: 주소). 없으면 글자형 */
  profileImage: string | null;
}

// 글에는 **강조** 와 줄바꿈(\n = 단락)만 쓴다 — 템플릿이 HTML 로 바꾼다
export interface CoverContent {
  kind: 'cover';
  headline: string;
  sub?: string | null;
  chip?: string | null;
}
export interface BodyContent {
  kind: 'body';
  title: string;
  text: string;
  page: number;
  total: number;
  chip?: string | null;
}
export interface ClosingContent {
  kind: 'closing';
  headline: string;
  sub?: string | null;
}
export interface ReelCoverContent {
  kind: 'reel_cover';
  headline: string;
  chip?: string | null;
}
export type FrameContent = CoverContent | BodyContent | ClosingContent | ReelCoverContent;

export const FRAME_SIZE: Record<FrameKind, { width: number; height: number; safe: 'feed' | 'reel' | null }> = {
  // 격자에 보이는 것은 표지·릴스 표지뿐이라 안전 영역(격자 자르기)은 그 둘에만 건다
  cover: { width: 1080, height: 1350, safe: 'feed' },
  body: { width: 1080, height: 1350, safe: null },
  closing: { width: 1080, height: 1350, safe: null },
  reel_cover: { width: 1080, height: 1920, safe: 'reel' },
};

/** 그림 바탕 시안(F)만 쓰는 옵션: 바탕 그림(data: 주소)과 글자 뒤 어두운 띠의 진하기(0~1). 다른 시안은 무시한다 */
export interface PhotoOpts {
  background?: string | null;
  shade?: number;
}

export interface Draft {
  id: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  name: string;
  description: string;
  /** scale: 넘칠 때 글자 크기를 줄이는 비율 (1 = 원래 크기) */
  html(look: BrandLook, content: FrameContent, scale: number, photo?: PhotoOpts): string;
}
