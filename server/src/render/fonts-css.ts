// 렌더링 페이지에 넣을 @font-face. 폰트 파일은 레포의 OFL 폰트(npm 패키지·app/public/fonts)만 — 기계마다 같은 결과가 나오게.
// 주소는 가짜 origin(FONT_ORIGIN) 아래에 두고, 렌더러가 그 요청을 디스크 파일로 채운다(네트워크로 나가지 않음).
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config.ts';
import { FONTS, fontById, type FontEntry } from '../brand/fonts.ts';

export const FONT_ORIGIN = 'http://render.firstfeed.local';
const PREFIX = `${FONT_ORIGIN}/files/`;

/** 렌더러가 내줄 수 있는 폴더 — 이 밖의 경로는 내주지 않는다 */
export const SERVABLE_DIRS = ['node_modules/@fontsource', 'node_modules/pretendard', 'node_modules/@sun-typeface', 'app/public/fonts'];

const WEIGHT_FILE: Record<number, string> = { 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold' };

function face(family: string, weight: number, rel: string): string {
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(${PREFIX}${rel}) format('woff2');}`;
}

/** fontsource CSS 는 unicode-range 로 잘린 파일 여러 개 — 주소만 바꿔 그대로 쓴다 */
function fontsourceCss(pkg: string, weight: number): string {
  const dir = `node_modules/${pkg}`;
  const css = fs.readFileSync(path.join(env.repoRoot, dir, `${weight}.css`), 'utf8');
  return css
    .replace(/url\(\.\/files\/([^)]+\.woff2)\) format\('woff2'\), url\([^)]+\) format\('woff'\)/g, (_m, f: string) => `url(${PREFIX}${dir}/files/${f}) format('woff2')`)
    .replace(/font-display: swap/g, 'font-display: block');
}

function cssFor(f: FontEntry): string {
  return f.weights
    .map((w) => {
      if (f.source.kind === 'npm' && f.source.package.startsWith('@fontsource/')) return fontsourceCss(f.source.package, w);
      if (f.id === 'pretendard') return face(f.family, w, `node_modules/pretendard/dist/web/static/woff2/Pretendard-${WEIGHT_FILE[w]}.woff2`);
      if (f.id === 'suit') return face(f.family, w, `node_modules/@sun-typeface/suit/fonts/static/woff2/SUIT-${WEIGHT_FILE[w]}.woff2`);
      if (f.id === 'paperlogy') return face(f.family, w, `app/public/fonts/paperlogy/Paperlogy-${w === 700 ? '7Bold' : '8ExtraBold'}.woff2`);
      throw new Error(`폰트 ${f.id} 의 렌더링용 파일을 정하지 않았습니다 — fonts-css.ts 에 더하세요.`);
    })
    .join('\n');
}

/** 고른 폰트들의 @font-face (없는 id 는 오류 — 목록 밖 폰트로 그리지 않는다) */
export function fontFaceCss(ids: string[]): string {
  return [...new Set(ids)]
    .map((id) => {
      const f = fontById(id);
      if (!f) throw new Error(`목록에 없는 폰트 "${id}" 입니다.`);
      return cssFor(f);
    })
    .join('\n');
}

/** 가짜 origin 주소 → 디스크 경로 (허용 폴더 밖이면 null) */
export function fontFileFor(url: string): string | null {
  if (!url.startsWith(PREFIX)) return null;
  const rel = decodeURIComponent(url.slice(PREFIX.length));
  const abs = path.resolve(env.repoRoot, rel);
  const ok = SERVABLE_DIRS.some((d) => abs.startsWith(path.resolve(env.repoRoot, d) + path.sep));
  return ok && fs.existsSync(abs) ? abs : null;
}

export const ALL_FONT_IDS = FONTS.map((f) => f.id);
