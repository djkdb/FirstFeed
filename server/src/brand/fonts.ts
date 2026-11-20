// 브랜딩 폰트 목록 (FR-BR-3: "상업적 사용 가능한 무료 한글 폰트 목록에서만", 수용 기준: 라이선스 정보를 같이 표시).
// 결정(CLAUDE.md 2026-10-14): OFL 만, 8종 × 굵기 2개, npm 패키지 위주(2026-11-19 검은고딕을 더해 9종 → 같은 날 7종 더해 16종, 2026-11-20 카페24 2종 · 나눔스퀘어 더해 19종). 각 항목은 넣을 때 라이선스 파일 원문을 확인했다 (2026-10-14).
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
  /** OFL 밖에 덧붙은 안내(있을 때만) — 글꼴 목록 화면에 그대로 보인다 */
  noticeKo?: string;
  /** 어디서 받았고 라이선스 원문을 어디서 확인했는지 */
  source:
    | { kind: 'npm'; package: string; version: string; licenseFile: string }
    | { kind: 'repo'; url: string; commit: string; licenseFile: string }
    /** 저작권자 공식 사이트에서 받은 묶음 — git 이 없어 받은 파일의 지문(sha256)으로 판을 남긴다 */
    | {
        kind: 'site';
        url: string;
        /** 받은 묶음(zip)의 sha256 */
        sha256: string;
        downloadedAt: string;
        licenseFile: string;
        /** 레포에 넣은 글꼴 파일 → 그 sha256 (묶음 안의 파일 그대로인지 테스트가 잰다) */
        files: Record<string, string>;
      };
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
  {
    // 2026-11-19 사용자 결정: 두껍고 개성 있는 제목 글꼴 1종 추가(참고한 템플릿 파일의 굵은 제목 느낌 — 그 파일의 글꼴은 라이선스를 확인 못 해 쓰지 않음).
    // 패키지 안 LICENSE 원문 확인: SIL OFL 1.1, 「Copyright 2015 The Black Han Sans Project Authors」, 예약 글꼴 이름 지정 없음. 굵기는 하나뿐
    id: 'black-han-sans',
    name: '검은고딕',
    family: 'Black Han Sans',
    roles: ['title'],
    weights: [400],
    style: 'display',
    license: { name: OFL, copyright: 'Copyright 2015 The Black Han Sans Project Authors', reservedFontName: null },
    source: { kind: 'npm', package: '@fontsource/black-han-sans', version: '5.3.0', licenseFile: 'LICENSE' },
  },
  // 2026-11-19 사용자 지시(「해줘」 — 조사 뒤 제안한 6종 + G마켓 산스). 패키지 안 라이선스 원문을 하나씩 열어 OFL 1.1 · 저작권 줄 · 예약 이름을 확인했다
  {
    id: 'do-hyeon',
    name: '도현',
    family: 'Do Hyeon',
    roles: ['title'],
    weights: [400],
    style: 'display',
    license: { name: OFL, copyright: 'Copyright 2018 The Do Hyeon Project Authors', reservedFontName: null },
    source: { kind: 'npm', package: '@fontsource/do-hyeon', version: '5.3.0', licenseFile: 'LICENSE' },
  },
  {
    id: 'gothic-a1',
    name: 'Gothic A1',
    family: 'Gothic A1',
    roles: ['title', 'body'],
    // 100~900 이 다 있어 아주 두꺼운 제목(900)까지
    weights: [400, 700, 900],
    style: 'sans',
    license: { name: OFL, copyright: '(C) Copyright HanYang I&C Co.,Ltd.', reservedFontName: null },
    source: { kind: 'npm', package: '@fontsource/gothic-a1', version: '5.3.0', licenseFile: 'LICENSE' },
  },
  {
    id: 'bagel-fat-one',
    name: '베이글 팻 원',
    family: 'Bagel Fat One',
    roles: ['title'],
    weights: [400],
    style: 'display',
    license: { name: OFL, copyright: 'Copyright 2022 The Bagel Fat Project Authors', reservedFontName: null },
    source: { kind: 'npm', package: '@fontsource/bagel-fat-one', version: '5.3.0', licenseFile: 'LICENSE' },
  },
  {
    id: 'hahmlet',
    name: '함렛',
    family: 'Hahmlet',
    roles: ['title', 'body'],
    weights: [400, 700],
    style: 'serif',
    license: { name: OFL, copyright: 'Copyright 2020 The Hahmlet Project Authors', reservedFontName: null },
    source: { kind: 'npm', package: '@fontsource/hahmlet', version: '5.3.0', licenseFile: 'LICENSE' },
  },
  {
    id: 'nanum-pen-script',
    name: '나눔손글씨 펜',
    family: 'Nanum Pen Script',
    roles: ['title'],
    weights: [400],
    style: 'display',
    license: { name: OFL, copyright: 'Copyright © 2010 NHN Corporation', reservedFontName: null },
    source: { kind: 'npm', package: '@fontsource/nanum-pen-script', version: '5.3.0', licenseFile: 'LICENSE' },
  },
  {
    id: 'wanted-sans',
    name: '원티드 산스',
    family: 'Wanted Sans',
    roles: ['title', 'body'],
    weights: [400, 700, 900],
    style: 'sans',
    license: { name: OFL, copyright: 'Copyright 2024 The Wanted Sans Project Authors', reservedFontName: null },
    source: { kind: 'npm', package: 'wanted-sans', version: '1.0.3', licenseFile: 'fonts/OFL.txt' },
  },
  {
    // CLAUDE.md 2026-10-13 에 「재배포 조건이 달라 제외」로 적었던 것을 2026-11-19 에 다시 봤다: 공식 페이지가 SIL OFL 이라 밝히고,
    // 받은 묶음에는 라이선스 파일이 없지만 글꼴 파일 안(name 표 13번)에 OFL 1.1 전문 + 「Reserved Font Name <Gmarket Sans Font>」 +
    // 한국어 요약(「라이선스 전문을 포함하여 다른 소프트웨어와 번들하거나 재배포 … 가능」)이 들어 있다 → app/public/fonts/gmarket-sans/OFL.txt 에 그대로 옮겼다.
    // 예약 이름이 있어 글꼴을 고치면 그 이름을 못 쓴다 — 그래서 woff2 로 바꾸거나 잘라 내지 않고 받은 TTF 그대로 쓴다(앱이 고친 판을 만들지 않게)
    id: 'gmarket-sans',
    name: 'G마켓 산스',
    family: 'Gmarket Sans',
    roles: ['title', 'body'],
    weights: [500, 700],
    style: 'sans',
    license: { name: OFL, copyright: 'eBay Korea Co., Ltd.', reservedFontName: 'Gmarket Sans Font' },
    source: {
      kind: 'site',
      url: 'https://corp.gmarket.com/fonts/GmarketSansTTF.zip',
      sha256: 'a2cc0ab9eb3bc868a6f2affd89fa1d4718cb6e1226dcb695b05d0d2ff417ae02',
      downloadedAt: '2026-11-19',
      licenseFile: 'name 표 13번(글꼴 파일 안) → OFL.txt',
      files: {
        'GmarketSansTTFMedium.ttf': 'c6b9a2c10bfdb55975948ce191f9cf638955b5cfdc99149969add5b579262fc1',
        'GmarketSansTTFBold.ttf': 'ff7c354dd1a324e4cecc1223c4f71e74fa81be7027e0c7f6324c475909cacefc',
      },
    },
  },
  // 2026-11-20 사용자 지시(「카페24 나눔스퀘어도 원본 확인해서 넣어줘」). 둘 다 공식 사이트 묶음을 받아 라이선스 원문을 열어 봤다.
  // 두 곳 모두 OFL 1.1 에 「이 글꼴을 쓴 인쇄물 · 광고물(온라인 포함) 이미지는 만든 회사의 프로모션에 쓰일 수 있고, 원치 않으면 요청」이라는 안내가 붙어 있다 —
  // 글꼴 목록 화면에 그대로 보인다(noticeKo)
  {
    // 카페24 묶음의 License-Ssurround.pdf: 「SIL OPEN FONT LICENSE(Version 1.1)에 따라 사용이 허가」 · 임베딩 「모든 범위」 · 예약 이름 지정 없음.
    // 카페24가 직접 낸 woff2 를 그대로 쓴다(우리가 바꾼 판이 아님). PDF 원본도 같은 폴더에
    id: 'cafe24-ssurround',
    name: '카페24 써라운드',
    family: 'Cafe24 Ssurround',
    roles: ['title'],
    weights: [700],
    style: 'display',
    license: { name: OFL, copyright: 'Copyright © Cafe24 Corp.', reservedFontName: null },
    noticeKo: '이 글꼴을 쓴 인쇄물 · 광고물(온라인 포함) 이미지는 카페24 프로모션에 쓰일 수 있어요. 원치 않으면 카페24에 요청할 수 있어요.',
    source: {
      kind: 'site',
      url: 'https://img.cafe24.com/csdstatic/freefonts/download/kr/Cafe24Ssurround-v2.0.zip',
      sha256: 'a5f9c0c8f4cc2d3c00220ace363a893618c5cf59ff5aea184aeced3bd3e9af5c',
      downloadedAt: '2026-11-20',
      licenseFile: 'License-Ssurround.pdf → OFL.txt',
      files: { 'Cafe24Ssurround-v2.0.woff2': '2d726dbf8863d66e6d5cf56e2532c5d14d8a4b514461b565c513c1da6ae2f41a' },
    },
  },
  {
    id: 'cafe24-ohsquare',
    name: '카페24 아네모네',
    family: 'Cafe24 Ohsquare',
    roles: ['title'],
    weights: [400],
    style: 'display',
    license: { name: OFL, copyright: 'Copyright (c) 2020by Cafe24.', reservedFontName: null },
    noticeKo: '이 글꼴을 쓴 인쇄물 · 광고물(온라인 포함) 이미지는 카페24 프로모션에 쓰일 수 있어요. 원치 않으면 카페24에 요청할 수 있어요.',
    source: {
      kind: 'site',
      url: 'https://img.cafe24.com/csdstatic/freefonts/download/kr/Cafe24Ohsquare-v2.0.zip',
      sha256: '393ca34fea52d301153d4145fc54f7e5882ba00e0a86768b7b556523f1d865c4',
      downloadedAt: '2026-11-20',
      licenseFile: 'License-Ohsquare.pdf → OFL.txt',
      files: { 'Cafe24Ohsquare-v2.0.woff2': '20fff7aa821a10a8c0432dd4bcfe3ccc416dec2f116e93f43b15de1ff988215d' },
    },
  },
  {
    // 네이버 고객센터 「네이버 나눔글꼴 라이선스안내」: OFL 1.1 + 「Reserved Font Name Nanum, …」. 묶음에 라이선스 파일이 없어 그 글을 OFL.txt 로 옮겼다.
    // 예약 이름(Nanum)이 있어 G마켓 산스처럼 받은 TTF 를 고치지 않고 그대로 쓴다. npm 의 비공식 패키지(license 칸이 원본과 다름)는 쓰지 않는다
    id: 'nanum-square',
    name: '나눔스퀘어',
    family: 'NanumSquare',
    roles: ['title', 'body'],
    weights: [400, 700, 800],
    style: 'sans',
    license: { name: OFL, copyright: 'Copyright (c) 2010, NAVER Corporation', reservedFontName: 'Nanum' },
    noticeKo: '이 글꼴을 쓴 인쇄물 · 광고물(온라인 포함) 이미지는 나눔글꼴 프로모션에 쓰일 수 있어요. 원치 않으면 네이버에 요청할 수 있어요.',
    source: {
      kind: 'site',
      url: 'https://campaign.naver.com/nanumsquare_neo/download/NaverNanumSquare.zip',
      sha256: '3a5f4f24955d3994552371580c75b19127d8d542c1e63f96f18803e6cd8b1c33',
      downloadedAt: '2026-11-20',
      licenseFile: 'help.naver.com 「네이버 나눔글꼴 라이선스안내」 → OFL.txt',
      files: {
        'NanumSquareR.ttf': '5a51deae5237435d9a0bc0cc6cc30619a914b29801f895698cfdacadcad06e94',
        'NanumSquareB.ttf': 'f737d58294faec9c632189af3a2a3e48e49c03c0256de09db61e879e2857bfbf',
        'NanumSquareEB.ttf': '6608adc320ff8514630d04a53e16cc7a5d54f5cbdbe3769109f311dcb3b48f80',
      },
    },
  },
];

export const fontById = (id: string): FontEntry | undefined => FONTS.find((f) => f.id === id);

/** 프롬프트에 넣을 목록 (id · 이름 · 어울리는 쓰임 · 느낌) */
export function formatFontsForPrompt(): string {
  return FONTS.map((f) => `- ${f.id}: ${f.name} (${f.roles.map((r) => (r === 'title' ? '제목' : '본문')).join('·')}, ${f.style})`).join('\n');
}
