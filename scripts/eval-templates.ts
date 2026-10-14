// 템플릿 넘침 측정 (FR-TP-4 수용 기준: 결과 PNG 에 글자가 잘리거나 겹친 경우 0건 — 테스트 세트 기준).
//   npm run eval:templates -- [--label=templates]
// 시안 × 브랜드(me·doyun·seoyeon 고정 키트) × 넘침 테스트 세트(tests/fixtures/generated/overflow/cases.json).
// 판정은 DOM 측정(기준 브라우저 Playwright Chromium 으로만). PNG 는 판정이 실패해도 마지막 단계 크기로 남긴다 —
// 사람이 열어서 "판정 통과인데 눈으로 보면 잘린" 것과 "판정 실패인데 멀쩡한" 것을 세려고(결정 2026-10-15).
// 결과: tests/results/<날짜>-<label>/<시안>-<브랜드>/<case>.png · _sheet.png(한눈에 보기) + tests/results/<날짜>-<label>.md
import fs from 'node:fs';
import path from 'node:path';
import { env, setSetting } from '../server/src/config.ts';
import { openDb } from '../server/src/db/index.ts';
import { closeBrowser, getBrowser } from '../server/src/render/browser.ts';
import { DRAFTS } from '../server/src/templates/index.ts';
import { renderFrame } from '../server/src/templates/render-frame.ts';
import type { BrandLook, FrameContent } from '../server/src/templates/types.ts';

const args = process.argv.slice(2);
const label = args.find((a) => a.startsWith('--label='))?.slice(8) ?? 'templates';
// 날짜는 이 컴퓨터 시간대 기준 — toISOString(UTC)은 한국 새벽에 전날 날짜가 된다(실제로 10-15 새벽에 10-14 로 찍힘)
const date = new Date().toLocaleDateString('sv-SE');
const outDir = path.join(env.repoRoot, 'tests/results', `${date}-${label}`);

const BRANDS: Array<[string, string, string]> = [
  ['me', 'real', '실제 · 공개 (운영자 본인 키트)'],
  ['doyun', 'generated', 'AI 생성'],
  ['seoyeon', 'generated', 'AI 생성'],
];
interface Case {
  id: string;
  shape: string;
  expect: string;
  content: FrameContent;
}
const cases = (JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/generated/overflow/cases.json'), 'utf8')) as { cases: Case[] }).cases;

// 기준 브라우저로만 잰다 — 없으면 멈춘다 (Chrome 으로 잰 숫자는 수용 기준이 아니다)
const db = openDb(':memory:');
setSetting(db, 'render.browser', 'chromium');
const { info } = await getBrowser(db);

interface Row {
  draft: string;
  brand: string;
  c: Case;
  result: '통과' | '줄여서 통과' | '원고 줄이기' | '대체 글꼴';
  scale: number;
  problems: string[];
  shorten: string[];
  png: string | null;
}
const rows: Row[] = [];
fs.rmSync(outDir, { recursive: true, force: true });
for (const d of DRAFTS)
  for (const [id, set] of BRANDS) {
    const look = (JSON.parse(fs.readFileSync(path.join(env.repoRoot, `tests/fixtures/${set}/brands/${id}.json`), 'utf8')) as { look: BrandLook }).look;
    const dir = path.join(outDir, `${d.id}-${id}`);
    fs.mkdirSync(dir, { recursive: true });
    for (const c of cases) {
      const r = await renderFrame(db, d, look, c.content, { captureEvenIfBad: true });
      const result: Row['result'] = r.problems.some((p) => p.code === 'font_fallback') ? '대체 글꼴' : r.ok ? (r.scale < 1 ? '줄여서 통과' : '통과') : '원고 줄이기';
      let png: string | null = null;
      if (r.png) {
        png = path.join(dir, `${c.id}.png`);
        fs.writeFileSync(png, r.png);
      }
      rows.push({ draft: d.id, brand: id, c, result, scale: r.scale, problems: r.problems.map((p) => p.message), shorten: r.shorten.map((s) => s.message), png });
    }
    console.log(`[템플릿 측정] 시안 ${d.id} · ${id}: ${rows.filter((x) => x.draft === d.id && x.brand === id).map((x) => x.result[0]).join('')}`);
  }

// 한눈에 보기: 조합마다 PNG 를 줄여 한 장에 (사람이 열어 보는 용)
const { browser } = await getBrowser(db);
for (const d of DRAFTS)
  for (const [id] of BRANDS) {
    const rs = rows.filter((x) => x.draft === d.id && x.brand === id);
    const cell = (x: Row) =>
      `<figure style="margin:0;width:216px"><div style="height:384px;display:flex;align-items:flex-start">${
        x.png ? `<img style="width:216px;outline:${x.result === '원고 줄이기' ? '4px solid #d33' : 'none'}" src="data:image/png;base64,${fs.readFileSync(x.png).toString('base64')}">` : '<div style="width:216px;height:270px;background:#ccc"></div>'
      }</div><figcaption style="font:13px sans-serif;color:#222">${x.c.id}<br>${x.result}${x.scale < 1 ? ` ${Math.round(x.scale * 100)}%` : ''}</figcaption></figure>`;
    const html = `<body style="margin:0;padding:12px;background:#eee;display:flex;flex-wrap:wrap;gap:10px;width:${8 * 226 + 24}px">${rs.map(cell).join('')}</body>`;
    const page = await browser.newPage({ viewport: { width: 8 * 226 + 24, height: 600 } });
    await page.setContent(html);
    await page.screenshot({ path: path.join(outDir, `${d.id}-${id}`, '_sheet.png'), fullPage: true });
    await page.close();
  }
await closeBrowser();

const count = (rs: Row[], r: Row['result']) => rs.filter((x) => x.result === r).length;
const lines = [
  `# 템플릿 넘침 측정 · ${date} · ${label}`,
  '',
  `- 판정 브라우저: ${info.kind} ${info.version} (기준 브라우저) · 시안 ${DRAFTS.map((d) => d.id).join('·')} × 브랜드 3 × 테스트 세트 ${cases.length}개 = ${rows.length}장`,
  '- 테스트 세트: `tests/fixtures/generated/overflow/cases.json` (AI 생성 원고) · 브랜드: me = 실제·공개(운영자 키트), doyun·seoyeon = AI 생성',
  `- PNG: \`tests/results/${date}-${label}/<시안>-<브랜드>/<case>.png\`, 한눈에 보기 \`_sheet.png\` (빨간 테두리 = 원고 줄이기 판정, 마지막 단계 82% 크기로 찍은 것)`,
  '- 「눈 확인」은 사람이 PNG 를 열어 본 결과 — devlog 에 적는다',
  '',
  '| 시안 | 브랜드 | 통과 | 줄여서 통과 | 원고 줄이기 | 대체 글꼴 |',
  '|---|---|---|---|---|---|',
  ...DRAFTS.flatMap((d) =>
    BRANDS.map(([id]) => {
      const rs = rows.filter((x) => x.draft === d.id && x.brand === id);
      return `| ${d.id} | ${id} | ${count(rs, '통과')} | ${count(rs, '줄여서 통과')} | ${count(rs, '원고 줄이기')} | ${count(rs, '대체 글꼴')} |`;
    }),
  ),
  '',
  '## 테스트 세트별 (기대 → 9개 조합의 결과)',
  '',
  '| case | 모양 | 기대 | 결과 (A-me A-doyun A-seoyeon B-… C-…) |',
  '|---|---|---|---|',
  ...cases.map((c) => `| ${c.id} | ${c.shape} | ${c.expect} | ${rows.filter((x) => x.c.id === c.id).map((x) => (x.result === '줄여서 통과' ? `줄여서 ${Math.round(x.scale * 100)}%` : x.result)).join(' · ')} |`),
  '',
  '## 판정 실패의 이유 (DOM 측정) — 원고를 줄이라는 안내',
  '',
  ...rows.filter((x) => x.result !== '통과' && x.result !== '줄여서 통과').map((x) => `- ${x.draft}-${x.brand} ${x.c.id}: ${[...x.shorten, ...x.problems].slice(0, 3).join(' / ')}`),
  '',
];
fs.writeFileSync(path.join(env.repoRoot, 'tests/results', `${date}-${label}.md`), lines.join('\n'));
console.log(`[템플릿 측정] tests/results/${date}-${label}.md 에 저장`);
