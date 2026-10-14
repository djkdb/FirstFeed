// 브랜딩 폰트를 화면에 불러온다 (목록: server/src/brand/fonts.ts). 미리보기가 실제 폰트로 보여야 고를 수 있어서.
// 브랜드 화면을 열 때만 불러온다 — 한글 폰트는 무거워서 첫 화면에 싣지 않는다.
import suit400 from '@sun-typeface/suit/fonts/static/woff2/SUIT-Regular.woff2?url';
import suit700 from '@sun-typeface/suit/fonts/static/woff2/SUIT-Bold.woff2?url';

let loaded: Promise<void> | null = null;

export function loadBrandFonts(): Promise<void> {
  loaded ??= (async () => {
    await Promise.all([
      import('pretendard/dist/web/static/pretendard-dynamic-subset.css'),
      import('@fontsource/noto-sans-kr/400.css'),
      import('@fontsource/noto-sans-kr/700.css'),
      import('@fontsource/noto-serif-kr/400.css'),
      import('@fontsource/noto-serif-kr/700.css'),
      import('@fontsource/gowun-dodum/400.css'),
      import('@fontsource/gowun-batang/400.css'),
      import('@fontsource/gowun-batang/700.css'),
      import('@fontsource/ibm-plex-sans-kr/400.css'),
      import('@fontsource/ibm-plex-sans-kr/700.css'),
    ]);
    // CSS 가 없는 폰트는 FontFace 로 직접 등록한다 (SUIT: 패키지에 CSS 없음, 페이퍼로지: 레포의 public/fonts)
    const faces = [
      new FontFace('SUIT', `url(${suit400})`, { weight: '400' }),
      new FontFace('SUIT', `url(${suit700})`, { weight: '700' }),
      new FontFace('Paperlogy', 'url(/fonts/paperlogy/Paperlogy-7Bold.woff2)', { weight: '700' }),
      new FontFace('Paperlogy', 'url(/fonts/paperlogy/Paperlogy-8ExtraBold.woff2)', { weight: '800' }),
    ];
    await Promise.all(faces.map(async (f) => document.fonts.add(await f.load())));
  })();
  return loaded;
}
