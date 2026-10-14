// 브랜딩 폰트 목록 (FR-BR-3: "상업적 사용 가능한 무료 한글 폰트 목록에서만", 수용 기준: 라이선스 정보를 같이 표시).
// 결정(CLAUDE.md 2026-10-14): OFL 만, 8종 × 굵기 2개, npm 패키지 위주. 각 항목은 넣을 때 라이선스 파일 원문을 확인했다 (2026-10-14).
// AI(brand_visual)는 이 목록의 id 로만 고르고, 코드가 목록 밖 id 를 막는다.

export type FontRole = 'title' | 'body';

export interface FontEntry {
  id: string;
  name: string;
  /** CSS font-family */
  family: string;
  /** 제목용·본문용 중 어디에 어울리는지 */
  roles: FontRole[];
  /** 앱이 불러오는 굵기 */
  weights: number[];
  style: 'sans' | 'serif' | 'display';
  license: { name: 'SIL OFL 1.1'; copyright: string; reservedFontName: string | null };
  /** 어디서 받았고 라이선스 원문을 어디서 확인했는지 */
  source: { kind: 'npm'; package: string; version: string; licenseFile: string } | { kind: 'repo'; url: string; commit: string; licenseFile: string };
}

const OFL = 'SIL OFL 1.1' as const;

export const FONTS: FontEntry[] = [
  {
    id: 'pretendard',
    name: 'Pretendard',
    family: 'Pretendard',
    roles: ['title', 'body'],
    weights: [400, 700],
    style: 'sans',
    license: { name: OFL, copyright: 'Copyright (c) 2021, Kil Hyung-jin', reservedFontName: 'Pretendard' },
    source: { kind: 'npm', package: 'pretendard', version: '1.3.9', licenseFile: 'dist/LICENSE.txt' },
  },
  {
    id: 'noto-sans-kr',
    name: 'Noto Sans KR',
    family: 'Noto Sans KR',
    roles: ['title', 'body'],
    weights: [400, 700],
    style: 'sans',
    license: { name: OFL, copyright: 'Google Inc.', reservedFontName: null },
    source: { kind: 'npm', package: '@fontsource/noto-sans-kr', version: '5.3.1', licenseFile: 'LICENSE' },
  },
  {
    id: 'noto-serif-kr',
    name: 'Noto Serif KR',
    family: 'Noto Serif KR',
    roles: ['title', 'body'],
    weights: [400, 700],
    style: 'serif',
    license: { name: OFL, copyright: 'Google Inc.', reservedFontName: null },
    source: { kind: 'npm', package: '@fontsource/noto-serif-kr', version: '5.3.1', licenseFile: 'LICENSE' },
  },
  {
    id: 'suit',
    name: 'SUIT',
    family: 'SUIT',
    roles: ['title', 'body'],
    weights: [400, 700],
    style: 'sans',
    license: { name: OFL, copyright: 'Copyright (c) 2022, SUNN', reservedFontName: 'SUIT' },
    source: { kind: 'npm', package: '@sun-typeface/suit', version: '2.0.5', licenseFile: 'LICENSE' },
  },
  {
    id: 'gowun-dodum',
    name: '고운돋움',
    family: 'Gowun Dodum',
    roles: ['body'],
    // 이 폰트는 굵기가 하나뿐이다
    weights: [400],
    style: 'sans',
    license: { name: OFL, copyright: 'Copyright 2021 The Gowun Dodum Project Authors', reservedFontName: null },
    source: { kind: 'npm', package: '@fontsource/gowun-dodum', version: '5.3.0', licenseFile: 'LICENSE' },
  },
  {
    id: 'gowun-batang',
    name: '고운바탕',
    family: 'Gowun Batang',
    roles: ['title', 'body'],
    weights: [400, 700],
    style: 'serif',
    license: { name: OFL, copyright: 'Copyright 2021 The Gowun Batang Project Authors', reservedFontName: null },
    source: { kind: 'npm', package: '@fontsource/gowun-batang', version: '5.3.0', licenseFile: 'LICENSE' },
  },
  {
    id: 'ibm-plex-sans-kr',
    name: 'IBM Plex Sans KR',
    family: 'IBM Plex Sans KR',
    roles: ['title', 'body'],
    weights: [400, 700],
    style: 'sans',
    license: { name: OFL, copyright: 'Copyright 2018 IBM Corp.', reservedFontName: null },
    source: { kind: 'npm', package: '@fontsource/ibm-plex-sans-kr', version: '5.3.0', licenseFile: 'LICENSE' },
  },
  {
    id: 'paperlogy',
    name: '페이퍼로지',
    family: 'Paperlogy',
    roles: ['title'],
    weights: [700, 800],
    style: 'display',
    license: { name: OFL, copyright: 'Copyright 2024 The PAPERLOGY Authors', reservedFontName: null },
    // npm 에 없어 레포에 넣었다 (app/public/fonts/paperlogy). 출처는 배포 저장소의 커밋 — 제3자 사이트가 아니다
    source: {
      kind: 'repo',
      url: 'https://github.com/Freesentation/paperlogy',
      commit: '8ef35f53b318c7ca914c52b1b382b9a8bad07a61',
      licenseFile: 'OFL license.txt',
    },
  },
];

export const fontById = (id: string): FontEntry | undefined => FONTS.find((f) => f.id === id);

/** 프롬프트에 넣을 목록 (id · 이름 · 어울리는 쓰임 · 느낌) */
export function formatFontsForPrompt(): string {
  return FONTS.map((f) => `- ${f.id}: ${f.name} (${f.roles.map((r) => (r === 'title' ? '제목' : '본문')).join('·')}, ${f.style})`).join('\n');
}
