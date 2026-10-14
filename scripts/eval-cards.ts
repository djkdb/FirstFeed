// 카드뉴스 측정 (FR-MK-1·2·8). 소재 × 짝 브랜드 × N회: 표지 후보 → 첫 후보 고르기 → 본문 → 세트.
//   npm run eval:cards -- [--runs=2] [--only=ai-tool-memo] [--label=cards]
// 결과: tests/results/<날짜>-<label>.md + tests/results/<날짜>-<label>/<소재>-<브랜드>-<회>/NN-*.png (사람이 열어 본다)
// 재작성 사유는 근거 규칙 / 렌더링 넘침 / 개수 불일치 / 자기 평가로 나눈다(ai_runs 의 문제 기록에서).
// 소재는 tests/fixtures/{real,private,generated}/sources/*.md — 세 갈래로 나눠 보고, 자료가 없는 갈래는 「자료 없음」
import fs from 'node:fs';
import path from 'node:path';
import { env, getSetting } from '../server/src/config.ts';
import { openDb, type Db } from '../server/src/db/index.ts';
import { AiService } from '../server/src/ai/adapter.ts';
import { ClaudeCodeProvider } from '../server/src/ai/providers/claude-code.ts';
import { closeBrowser } from '../server/src/render/browser.ts';
import { startStopwatch } from '../server/src/lib/sleep-clock.ts';
import { findUngrounded } from '../server/src/rules/grounding.ts';
import { cardContext } from '../server/src/cards/context.ts';
import { cardCountClaims, countClaims } from '../server/src/cards/count.ts';
import { generateCovers, reasonOf, type CoversResult } from '../server/src/cards/covers.ts';
import { generateBody, type BodyResult } from '../server/src/cards/body.ts';
import { getSet, rendersDir } from '../server/src/cards/store.ts';
import { addTestSource, seedBrand } from '../server/src/cards/testing/setup.ts';

const args = process.argv.slice(2);
const arg = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const runs = Number(arg('runs') ?? 2);
const only = arg('only');
const label = arg('label') ?? 'cards';
const date = new Date().toLocaleDateString('sv-SE');
const outDir = path.join(env.repoRoot, 'tests/results', `${date}-${label}`);

// 소재마다 짝 브랜드와 그 브랜드가 고정한 시안 (브랜드마다 다른 시안으로 — 틀이 달라도 깨지지 않는지)
const PAIRS: Record<string, { person: string; set: string; draft: string }> = {
  'ai-tool-memo': { person: 'me', set: 'real', draft: 'A' },
  'budget-devlog': { person: 'doyun', set: 'generated', draft: 'C' },
  'dessert-visit': { person: 'seoyeon', set: 'generated', draft: 'B' },
};
const SETS: Array<[string, string, string]> = [
  ['real', 'tests/fixtures/real/sources', '실제 · 공개'],
  ['private', 'tests/fixtures/private/sources', '실제 · 비공개'],
  ['generated', 'tests/fixtures/generated/sources', 'AI 생성'],
];

interface Row {
  setLabel: string;
  source: string;
  person: string;
  draft: string;
  run: number;
  covers: CoversResult | null;
  body: BodyResult | null;
  error?: string;
  seconds: number;
  sleptSec: number;
  reasons: Record<string, number>;
  ungrounded: string[];
  countOk: boolean | null;
  cardsText: string[];
  pngDir: string | null;
}

/** 이 회차 ai_runs 에서 재작성을 부른 문제(생성 결과가 rule_error 인 회차의 error 들 + 자기 평가의 fact·broken) */
function rewriteReasons(db: Db): Record<string, number> {
  const out: Record<string, number> = {};
  const rows = db.prepare("SELECT task, status, issues_json FROM ai_runs WHERE issues_json IS NOT NULL").all() as Array<{ task: string; status: string; issues_json: string }>;
  for (const r of rows) {
    if (r.task === 'self_review' || r.status !== 'rule_error') continue;
    for (const i of JSON.parse(r.issues_json) as Array<{ code: string; level: string }>) if (i.level === 'error') out[reasonOf(i.code)] = (out[reasonOf(i.code)] ?? 0) + 1;
  }
  return out;
}

const rows: Row[] = [];
fs.rmSync(outDir, { recursive: true, force: true });
for (const [setKey, dir, setLabel] of SETS) {
  const abs = path.join(env.repoRoot, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs).filter((x) => x.endsWith('.md'))) {
    const name = f.replace(/\.md$/, '');
    if (only && name !== only) continue;
    const pair = PAIRS[name] ?? { person: 'me', set: 'real', draft: 'A' };
    const text = fs.readFileSync(path.join(abs, f), 'utf8').replace(/^\s*<!--[\s\S]*?-->\s*/, '').trim();
    for (let n = 1; n <= runs; n++) {
      console.log(`[카드 측정] ${setKey}/${name} × ${pair.person} (시안 ${pair.draft}) ${n}/${runs} …`);
      const db = openDb(':memory:');
      const ai = new AiService({ db, provider: new ClaudeCodeProvider() });
      const { dataDir } = await seedBrand(pair.person, pair.set, pair.draft, db);
      const sourceId = addTestSource(db, text);
      const row: Row = { setLabel, source: name, person: pair.person, draft: pair.draft, run: n, covers: null, body: null, seconds: 0, sleptSec: 0, reasons: {}, ungrounded: [], countOk: null, cardsText: [], pngDir: null };
      const sw = startStopwatch();
      try {
        row.covers = await generateCovers(ai, 1, sourceId, null, undefined, dataDir);
        const first = row.covers.candidates[0];
        if (!first) throw new Error('보여 줄 표지 후보가 없음');
        row.body = await generateBody(ai, 1, { sourceId, cover: { headline: first.headline, sub: first.sub, pillarId: first.pillarId, chip: first.chip }, requested: null, coverJobId: null }, undefined, dataDir);
        if (row.body.status === 'saved') {
          const set = getSet(db, row.body.setId)!;
          const dest = path.join(outDir, `${name}-${pair.person}-${n}`);
          fs.mkdirSync(dest, { recursive: true });
          for (const c of set.cards) fs.copyFileSync(path.join(rendersDir(dataDir, set.id), c.pngFile), path.join(dest, c.pngFile));
          row.pngDir = path.relative(env.repoRoot, dest);
          // FR-MK-2 수용 기준 재검사: 최종 카드 글에 원문 밖 숫자·영문이 남았나 (규칙을 거쳤어도 다시 센다)
          const ctx = cardContext(db, 1, sourceId, dataDir);
          const bodyCount = set.cards.filter((c) => c.kind === 'body').length;
          for (const c of set.cards) {
            const t = Object.entries(c.content).filter(([k, v]) => typeof v === 'string' && !['kind', 'chip'].includes(k)).map(([, v]) => v as string).join('\n');
            const plain = c.kind === 'cover' ? countClaims(t).reduce((x, cl) => x.replace(cl.text, ' '), t.replace(/\*\*/g, '')) : t;
            for (const u of findUngrounded(plain, { ...ctx.grounding, structural: c.kind === 'cover' ? [] : [bodyCount] }, ctx.commonTerms)) row.ungrounded.push(`${c.idx + 1}번 "${u.value}"`);
            row.cardsText.push(`${c.idx + 1}. [${c.kind}] ${t.replace(/\n/g, ' ⏎ ')}${c.evidence ? `  ← 근거: "${c.evidence}"` : ''}${c.image ? `  🖼 ${c.image.prompt}` : ''}`);
          }
          const claims = cardCountClaims([first.headline, first.sub ?? ''], [text]);
          row.countOk = claims.length ? claims.every((cl) => cl.value === bodyCount) : null;
        }
      } catch (err) {
        row.error = (err as Error).message;
      }
      row.seconds = sw.wallMs() / 1000;
      row.sleptSec = Math.round(sw.sleptMs() / 1000);
      row.reasons = rewriteReasons(db);
      const b = row.body;
      console.log(
        `  → ${row.sleptSec ? `[잠자기 ${row.sleptSec}초] ` : ''}표지 ${row.covers ? `${row.covers.candidates.length}개(뺀 ${row.covers.dropped.length})·재작성 ${row.covers.rewrites}` : '-'} / 본문 ${b ? `${b.status}·재작성 ${b.rewrites}` : row.error ?? '-'} · ${row.seconds.toFixed(0)}초`,
      );
      rows.push(row);
    }
  }
}
await closeBrowser();

const CATS = ['근거 규칙', '렌더링 넘침', '개수 불일치', '자기 평가', '기타'];
const sum = (rs: Row[], f: (r: Row) => number) => rs.reduce((n, r) => n + f(r), 0);
const lines = [
  `# 카드뉴스 측정 · ${date} · ${label}`,
  '',
  `- 프롬프트: ${['cover_titles', 'cover_titles_review', 'card_body', 'card_body_review', 'self_review'].map((k) => `${k}@${getSetting(null, 'prompts.activeVersions')[k] ?? 'v1'}`).join(', ')} · 모델 opus · 소재마다 ${runs}회 · 표지는 후보 중 첫 번째를 고름`,
  '- 짝: ai-tool-memo × me(시안 A) · budget-devlog × doyun(시안 C) · dessert-visit × seoyeon(시안 B) — 프로필·키트는 고정 스냅숏',
  `- PNG: \`tests/results/${date}-${label}/<소재>-<브랜드>-<회>/\``,
  '- 재작성 사유는 재작성을 부른 회차의 코드 규칙 위반 건수(자기 평가의 fact·broken 은 「자기 평가」). 표지 후보에서 빼고 받아들인 것은 「뺀 후보」로 따로',
  '',
];
for (const [, , setLabel] of SETS) {
  const rs = rows.filter((r) => r.setLabel === setLabel);
  lines.push(`## ${setLabel} (${rs.length}회)`, '');
  if (rs.length === 0) {
    lines.push('자료 없음', '');
    continue;
  }
  const saved = rs.filter((r) => r.body?.status === 'saved');
  lines.push('| 지표 | 값 |', '|---|---|');
  lines.push(`| 세트 저장 / 직접 줄이기 필요 / 실패 | ${saved.length} / ${rs.filter((r) => r.body?.status === 'needs_edit').length} / ${rs.filter((r) => r.body?.status === 'failed' || r.error).length} |`);
  lines.push(`| 표지 후보 보인 수 평균 · 뺀 후보 합 | ${(sum(rs, (r) => r.covers?.candidates.length ?? 0) / rs.length).toFixed(1)} · ${sum(rs, (r) => r.covers?.dropped.length ?? 0)} |`);
  lines.push(`| 재작성 (표지 / 본문) 합 | ${sum(rs, (r) => r.covers?.rewrites ?? 0)} / ${sum(rs, (r) => r.body?.rewrites ?? 0)} |`);
  lines.push(`| AI 호출 합 (표지+본문) 평균 | ${(sum(rs, (r) => (r.covers?.calls ?? 0) + (r.body?.calls ?? 0)) / rs.length).toFixed(1)} |`);
  lines.push(`| 한 세트 시간 평균 | ${(sum(rs, (r) => r.seconds) / rs.length).toFixed(0)}초 |`);
  for (const c of CATS) lines.push(`| 재작성 사유 — ${c} | ${sum(rs, (r) => r.reasons[c] ?? 0)} |`);
  lines.push(`| 최종 카드의 원문 밖 숫자·영문 (FR-MK-2, 0이어야) | ${sum(saved, (r) => r.ungrounded.length)} |`);
  lines.push(`| 표지 개수 표현 = 본문 카드 수 (개수 표현 있는 세트) | ${saved.filter((r) => r.countOk === true).length}/${saved.filter((r) => r.countOk !== null).length} |`);
  lines.push(`| 잠자기가 낀 회차 | ${rs.filter((r) => r.sleptSec > 0).length}/${rs.length} |`);
  lines.push('');
  if (setLabel === '실제 · 비공개') continue;
  for (const r of rs) {
    lines.push(`### ${r.source} × ${r.person} (시안 ${r.draft}) · ${r.run}회${r.sleptSec ? ` (잠자기 ${r.sleptSec}초 포함)` : ''}`, '');
    if (r.covers) {
      lines.push(`표지 후보 ${r.covers.candidates.length}개 (호출 ${r.covers.calls}·재작성 ${r.covers.rewrites}): ${r.covers.candidates.map((c) => `「${c.headline.replace(/\*\*/g, '').replace(/\n/g, ' ')}」`).join(' · ')}`);
      if (r.covers.dropped.length) lines.push('', '뺀 후보:', ...r.covers.dropped.map((d) => `- 「${d.headline.replace(/\n/g, ' ')}」 — ${d.reasons.join(' / ')}`));
    }
    const b = r.body;
    if (b) {
      lines.push('', `본문: ${b.status} (호출 ${b.calls}·재작성 ${b.rewrites})${r.pngDir ? ` · PNG \`${r.pngDir}\`` : ''}`);
      if (b.status === 'needs_edit') lines.push(...b.overflows.map((o) => `- 넘침 ${o.where}: ${o.message}`));
      if (b.status === 'failed') lines.push(...b.errors.map((e) => `- ${e}`));
    }
    if (r.error) lines.push('', `오류: ${r.error}`);
    if (r.cardsText.length) lines.push('', ...r.cardsText.map((t) => `- ${t}`));
    if (r.ungrounded.length) lines.push('', `원문 밖 숫자·영문: ${r.ungrounded.join(', ')}`);
    lines.push(`재작성 사유: ${Object.entries(r.reasons).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'}`, '');
  }
}
fs.writeFileSync(path.join(env.repoRoot, 'tests/results', `${date}-${label}.md`), lines.join('\n'));
console.log(`[카드 측정] tests/results/${date}-${label}.md 에 저장`);
