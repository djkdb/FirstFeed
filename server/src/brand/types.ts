// 브랜딩 키트 후보·선택의 모양
export interface TextCandidate {
  value: string;
  why: string;
}

export interface Palette {
  name: string;
  colors: { primary: string; secondary: string; accent: string; background: string; text: string };
  why: string;
}

/** 코드가 잰 명암비 — 화면에 숫자로 보인다 (FR-BR-2) */
export interface PaletteChecked extends Palette {
  contrast: { textOnBackground: number; bestOnPrimary: number };
}

export interface FontPair {
  title: string;
  body: string;
  why: string;
}

export interface ImagePrompt {
  target: 'profile' | 'highlight';
  /** 하이라이트면 어느 축용인지 */
  label: string;
  prompt: string;
  filename: string;
}

export interface WordsCandidates {
  handles: TextCandidate[];
  displayNames: TextCandidate[];
  bios: TextCandidate[];
}

export interface VisualCandidates {
  palettes: PaletteChecked[];
  fontPairs: FontPair[];
  imagePrompts: ImagePrompt[];
}

export interface DroppedCandidate {
  kind: string;
  value: string;
  reasons: string[];
}

export interface Selection {
  handle: string | null;
  displayName: string | null;
  bio: string | null;
  palette: Palette | null;
  titleFont: string | null;
  bodyFont: string | null;
  profileImage: string | null;
}
