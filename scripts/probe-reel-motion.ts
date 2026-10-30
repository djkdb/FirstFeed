// 릴스 계획 실험 c (2026-10-30, docs/service/릴스-계획.md): 브랜드 색 · 글꼴로 3초 모션(제목 등장 + 자막 한 줄)을 프레임마다 찍어 mp4 로.
//   node scripts/probe-reel-motion.ts <출력 폴더> [브랜드 키트 json — 기본 tests/fixtures/generated/brands/demo.json]
// - 렌더링은 카드와 같은 경로(withCardPage: 앱에 넣은 글꼴만 · 바깥 요청 차단). 1080×1920
// - 프레임은 CSS 애니메이션을 멈춰 두고 Web Animations 의 currentTime 으로 시각을 정해 찍는다 — 실시간 녹화가 아니라 매번 같은 결과
// - 제목 · 자막은 릴스 격자 가림(위아래 240px, 결정 2026-10-18 render.safeArea.reel) 안
// - mp4 는 사용자 컴퓨터의 ffmpeg 로(앱이 ffmpeg 를 넣지 않는다). AI · TTS 없음(무음)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { env, getSetting } from '../server/src/config.ts';
import { openDb } from '../server/src/db/index.ts';
import { fontFaceCss } from '../server/src/render/fonts-css.ts';
import { closeBrowser } from '../server/src/render/browser.ts';
import { withCardPage } from '../server/src/render/render.ts';
import { family, inkOn } from '../server/src/templates/base.ts';
import type { BrandLook } from '../server/src/templates/types.ts';

const out = process.argv[2] ?? path.join(env.repoRoot, 'tests/results/reel-motion-probe');
fs.mkdirSync(out, { recursive: true });
const db = openDb(':memory:'); // 설정 기본값(가림 영역 등)만 읽는다
const brandFile = process.argv[3] ?? path.join(env.repoRoot, 'tests/fixtures/generated/brands/demo.json');
const look = (JSON.parse(fs.readFileSync(brandFile, 'utf8')) as { look: BrandLook }).look;
const p = look.palette;
const safe = getSetting(db, 'render.safeArea').reel;
const FPS = 30;
const SECONDS = 3;
const W = 1080;
const H = 1920;
// AI 생성 예시 문장(데모 페르소나) — 개인정보 없음
const TITLE = '에러 메시지,\n끝까지 읽어 본 날';
const LINE = '첫 단어와 줄 번호만 봐도 어디를 볼지 보여요';

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaceCss([look.titleFont, look.bodyFont])}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px}
body{font-family:${family(look.bodyFont)};word-break:keep-all;background:${p.primary};color:${inkOn(p.primary, look)};overflow:hidden}
[data-card]{position:relative;width:${W}px;height:${H}px}
.safe{position:absolute;left:${safe.x + 72}px;right:${W - safe.x - safe.w + 72}px;top:${safe.y + 120}px;bottom:${H - safe.y - safe.h + 120}px;display:flex;flex-direction:column;justify-content:center;gap:56px}
h1{font-family:${family(look.titleFont)};font-size:118px;line-height:1.12;letter-spacing:-.04em;white-space:pre-line;animation:rise .7s cubic-bezier(.2,.8,.2,1) .15s both}
.bar{height:10px;width:220px;background:${p.accent};border-radius:6px;transform-origin:left;animation:grow .5s ease-out .6s both}
.sub{align-self:flex-start;font-size:50px;line-height:1.45;padding:22px 30px;border-radius:20px;background:${p.background};color:${p.text};animation:fade .45s ease-out 1.1s both}
@keyframes rise{from{opacity:0;transform:translateY(60px)}to{opacity:1;transform:none}}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes fade{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
</style></head><body><div data-card><div class="safe">
<h1 data-slot="title">${TITLE}</h1><div class="bar"></div><div class="sub" data-slot="sub">${LINE}</div>
</div></div></body></html>`;

const t0 = Date.now();
const frames = await withCardPage(db, { html, width: W, height: H }, async (page) => {
  await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  const files: string[] = [];
  for (let i = 0; i < FPS * SECONDS; i++) {
    const ms = (i * 1000) / FPS;
    await page.evaluate((t) => document.getAnimations().forEach((a) => (a.currentTime = t)), ms);
    const f = path.join(out, `frame-${String(i).padStart(3, '0')}.png`);
    await page.screenshot({ path: f, type: 'png' });
    files.push(f);
  }
  return files;
});
await closeBrowser();
const captureMs = Date.now() - t0;
const mp4 = path.join(out, 'probe.mp4');
const t1 = Date.now();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(out, 'frame-%03d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
const encodeMs = Date.now() - t1;
const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,nb_frames:format=duration,size', '-of', 'json', mp4]).toString();
console.log(JSON.stringify({ frames: frames.length, captureMs, encodeMs, palette: { bg: p.primary, accent: p.accent }, fonts: [look.titleFont, look.bodyFont], safe, ffprobe: JSON.parse(probe) }, null, 1));
