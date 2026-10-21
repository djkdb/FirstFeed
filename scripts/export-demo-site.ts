// 소개 페이지(site/) 데모 데이터 내보내기: npm run export:demo-site
//   FIRSTFEED_DATA_DIR=<데모 브랜드 데이터 폴더> npm run export:demo-site
// 지금 DB 의 활성 프로필 · 브랜딩 선택 · 30일 뒤 미리보기(만든 표지 → 계획 칸 표지)에서
// site/data/demo.json 과 site/img/tile-1..9.png(인스타 격자처럼 양옆을 가린 3:4) · avatar.png(있으면)를 만든다.
// 값은 모두 DB 에서 온 것만 — 없는 값은 비워 두고 지어내지 않는다(결정 2026-10-22 · 소개 페이지).
// 쓰기 전에 개인정보 검사(redact.ts 와 같은 규칙)를 돌려 걸리면 아무것도 쓰지 않는다. 이미지는 사람이 직접 열어 확인한다.
// AI 는 부르지 않는다. 계획 칸 표지가 아직 없으면 앱과 같은 경로로 그린다(Playwright 브라우저 필요).
import fs from 'node:fs';
import path from 'node:path';
import { env, getSetting } from '../server/src/config.ts';
import { openDb } from '../server/src/db/index.ts';
import { currentSelection } from '../server/src/brand/store.ts';
import { assetPath } from '../server/src/brand/assets.ts';
import { listSets, rendersDir } from '../server/src/cards/store.ts';
import { activeProfile } from '../server/src/identity/store.ts';
import { findSensitive } from '../server/src/lib/redact.ts';
import { closeBrowser, getBrowser } from '../server/src/render/browser.ts';
import { planCover, previewDir } from '../server/src/preview/covers.ts';
import { latestPlan } from '../server/src/preview/plan.ts';
import { composeGrid } from '../server/src/preview/routes.ts';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE = path.join(root, 'site');
const SOURCE = '앱으로 만든 데모 브랜드 · AI 생성 테스트 자료';
const TILE_WIDTH = 506; // 사이트에서 보이는 크기의 두 배 남짓 — 원본(1012×1350)의 절반

const fail = (msg: string): never => {
  console.error(`[데모 내보내기] ${msg}`);
  process.exit(1);
};

const db = openDb(path.join(env.dataDir, 'firstfeed.sqlite'));
const profile = activeProfile(db, 1) ?? fail(`활성 프로필이 없습니다 (데이터: ${env.dataDir}). 데모 브랜드 데이터 폴더를 FIRSTFEED_DATA_DIR 로 지정하세요.`);
const sel = currentSelection(db, 1);
if (!sel.handle || !sel.displayName || !sel.bio || !sel.palette) fail('브랜딩 선택(아이디 · 이름 · 바이오 · 팔레트)이 다 되지 않았습니다. 앱 「브랜드」에서 고른 뒤 다시 실행하세요.');
const colors = sel.palette!.colors;

// 격자: 앱 미리보기와 같은 구성(만든 표지 최신순 → 계획 칸 → 빈칸)
const plan = latestPlan(db, 1);
const cells = composeGrid(listSets(db, 1), plan?.slots ?? [], new Map(profile.pillars.map((p) => [p.id, p.name])), getSetting(db, 'preview.gridCells'));
const safe = getSetting(db, 'render.safeArea').feed;

const { browser } = await getBrowser(db);
/** 표지 PNG 를 격자처럼 양옆을 가려(render.safeArea.feed) 3:4 로 자르고 줄인다 */
async function crop(png: Buffer): Promise<Buffer> {
  const scale = TILE_WIDTH / safe.w;
  const page = await browser.newPage({ viewport: { width: TILE_WIDTH, height: Math.round(safe.h * scale) } });
  try {
    const left = -safe.x * scale;
    await page.setContent(`<body style="margin:0;overflow:hidden"><img id="i" style="position:absolute;top:0;left:${left}px;width:${Math.round(1080 * scale)}px" src="data:image/png;base64,${png.toString('base64')}"></body>`);
    await page.waitForFunction(() => (document.getElementById('i') as HTMLImageElement).complete);
    return await page.screenshot({ type: 'png' });
  } finally {
    await page.close();
  }
}

const imgDir = path.join(SITE, 'img');
const tiles: Array<{ src?: string; title: string; planned: boolean }> = [];
const files: Array<[string, Buffer]> = [];
for (const [i, c] of cells.entries()) {
  if (c.kind === 'empty') continue;
  let png: Buffer | null = null;
  let title: string;
  if (c.kind === 'made') {
    title = c.headline;
    const p = path.join(rendersDir(env.dataDir, c.setId), '01-cover.png');
    if (fs.existsSync(p)) png = fs.readFileSync(p);
  } else {
    title = c.title;
    const r = await planCover(db, env.dataDir, 1, c.slot);
    if (r.ok) png = fs.readFileSync(path.join(previewDir(env.dataDir), r.file));
    else console.warn(`[데모 내보내기] ${i + 1}번 계획 칸은 표지로 못 그려 색 블록으로: ${r.reason}`);
  }
  const plain = title.replace(/\*\*/g, '').replace(/\n/g, ' ');
  if (png) {
    const name = `tile-${tiles.length + 1}.png`;
    files.push([name, await crop(png)]);
    tiles.push({ src: `img/${name}`, title: plain, planned: c.kind === 'plan' });
  } else tiles.push({ title: plain, planned: c.kind === 'plan' });
}

// 프로필 사진: 올린 파일이 있으면 그대로, 없으면 이름 첫 글자 + 주색(둘 다 DB 값)
let avatar: { src?: string; text?: string; bg?: string };
const avatarFile = sel.profileImage ? assetPath(env.dataDir, sel.profileImage) : null;
if (avatarFile) {
  files.push([`avatar${path.extname(avatarFile)}`, fs.readFileSync(avatarFile)]);
  avatar = { src: `img/avatar${path.extname(avatarFile)}` };
} else avatar = { text: [...sel.displayName!][0], bg: colors.primary };

// 근거 칩: 프로필 축에 붙은 인터뷰 답 인용 하나(코드가 원문 부분 문자열로 확인해 저장한 것). 바이오 자체의 근거는 저장돼 있지 않아 축 이름으로 밝힌다
const ev = profile.pillars.flatMap((p) => p.evidence.filter((e) => e.source.startsWith('A')).map((e) => ({ p, e })))[0];

const demo = {
  source: SOURCE,
  handle: sel.handle,
  name: sel.displayName,
  category: '', // 인스타 「카테고리」는 앱에 없는 값이라 비워 둔다
  bio: sel.bio,
  avatar,
  // 브랜딩 키트 색 — 바탕/글자 짝은 키트의 다섯 색에서만 고른다
  palette: [
    { bg: colors.primary, fg: colors.background },
    { bg: colors.background, fg: colors.text },
    { bg: colors.accent, fg: colors.text },
  ],
  highlights: profile.pillars.map((p) => ({ label: p.name, mark: [...p.name][0] })),
  tiles,
  evidence: ev ? { label: `「${ev.p.name}」 축의 근거 · ${ev.e.sourceLabel}`, quote: ev.e.quote } : { label: '', quote: '' },
};

const json = JSON.stringify(demo, null, 2);
const found = findSensitive(json);
if (found.length) fail(`개인정보 검사에 걸렸습니다(${found.map((f) => f.kind).join(', ')}). 아무것도 쓰지 않았습니다.`);

fs.mkdirSync(imgDir, { recursive: true });
fs.mkdirSync(path.join(SITE, 'data'), { recursive: true });
for (const f of fs.readdirSync(imgDir)) if (/^(tile-\d+|avatar)\.(png|jpg|webp)$/.test(f)) fs.rmSync(path.join(imgDir, f));
for (const [name, buf] of files) fs.writeFileSync(path.join(imgDir, name), buf);
fs.writeFileSync(path.join(SITE, 'data', 'demo.json'), `${json}\n`);
await closeBrowser();
console.log(`[데모 내보내기] site/data/demo.json · 격자 ${tiles.length}칸(만든 ${tiles.filter((t) => !t.planned).length} · 계획 ${tiles.filter((t) => t.planned).length}) · 그림 ${files.length}개`);
console.log('  이미지는 직접 열어 이름·얼굴·연락처가 없는지 확인하세요 — 개인정보 검사는 이미지 속 글자를 보지 못합니다.');
