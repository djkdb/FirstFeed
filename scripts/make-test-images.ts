// 그림 바탕 표지(시안 F)의 명암비 테스트 그림 3장을 만든다 (결정 2026-10-18 · 그림 바탕 표지).
//   node scripts/make-test-images.ts → tests/fixtures/generated/images/{light,dark,busy}.png (1080×1920 — 4:5 표지는 가운데를 잘라 쓴다)
// 실제 사용자 그림 대신 쓰는 AI·코드 생성 자료. 밝은 그림(흰 글자가 가장 안 읽힘)·어두운 그림·복잡한 그림(밝고 어두운 점이 섞임)
import path from 'node:path';
import { chromium } from 'playwright';
import { env } from '../server/src/config.ts';

const W = 1080;
const H = 1920;
const out = path.join(env.repoRoot, 'tests/fixtures/generated/images');
const scenes: Record<string, string> = {
  // 밝은 하늘색~흰색, 아래쪽(제목 자리)이 가장 밝다
  light: `const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'#bfe3ff');g.addColorStop(.6,'#f4fbff');g.addColorStop(1,'#ffffff');c.fillStyle=g;c.fillRect(0,0,W,H);
    c.fillStyle='#ffe9a8';c.beginPath();c.arc(W*.7,H*.35,260,0,7);c.fill();`,
  // 짙은 남색 밤하늘
  dark: `const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0b1026');g.addColorStop(1,'#1c2448');c.fillStyle=g;c.fillRect(0,0,W,H);
    c.fillStyle='#ffffff';for(let i=0;i<120;i++){c.globalAlpha=r()*.8;c.fillRect(r()*W,r()*H,3,3)}c.globalAlpha=1;`,
  // 흰 줄무늬·밝은 점·어두운 덩어리가 섞인 복잡한 그림 (고정 씨앗이라 매번 같다)
  busy: `c.fillStyle='#6b7a8f';c.fillRect(0,0,W,H);
    for(let i=0;i<40;i++){c.fillStyle=i%2?'#ffffff':'#1d1d1d';c.fillRect(0,i*48,W,24)}
    for(let i=0;i<400;i++){c.fillStyle=['#ffd166','#ef476f','#06d6a0','#ffffff','#073b4c'][i%5];c.beginPath();c.arc(r()*W,r()*H,10+r()*60,0,7);c.fill()}`,
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.error(`[테스트 그림] 그리기 오류: ${e.message}`));
for (const [name, draw] of Object.entries(scenes)) {
  await page.setContent(`<canvas id="c" width="${W}" height="${H}"></canvas><script>{
    // 같은 페이지에 다시 쓰면 전역 선언이 남아 두 번째부터 실패한다 — 블록으로 감싼다
    let s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647;const W=${W},H=${H};const c=document.getElementById('c').getContext('2d');${draw}}</script>`);
  await page.locator('#c').screenshot({ path: path.join(out, `${name}.png`) });
  console.log(`[테스트 그림] ${name}.png`);
}
await browser.close();
