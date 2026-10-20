// 카드뉴스 측정 (FR-MK-1·2·8). 소재 × 짝 브랜드 × N회: 표지 후보 → 첫 후보 고르기 → 본문 → 세트.
//   npm run eval:cards -- [--runs=2] [--only=ai-tool-memo] [--set=real] [--caption] [--label=cards] [--prompt card_body=v1 --prompt card_body_review=v2]
// 결과: tests/results/<날짜>-<label>.md + tests/results/<날짜>-<label>/<소재>-<브랜드>-<회>/NN-*.png (사람이 열어 본다)
// 재작성 사유는 근거 규칙 / 렌더링 넘침 / 개수 불일치 / 자기 평가로 나눈다(ai_runs 의 문제 기록에서).
// 소재는 tests/fixtures/{real,private,generated}/sources/*.md — 세 갈래로 나눠 보고, 자료가 없는 갈래는 「자료 없음」
import fs from 'node:fs';
import path from 'node:path';
import { env, getSetting, setSetting } from '../server/src/config.ts';
import { parsePromptArgs } from './prompt-args.ts';
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
import { coverPromiseIssues } from '../server/src/cards/body.ts';
import { datedNumberIssues, datedNumbers } from '../server/src/rules/dated.ts';
import { generateCaption } from '../server/src/publish/caption.ts';
import { captionText, getCaption } from '../server/src/publish/store.ts';
import { addTestSource, seedBrand } from '../server/src/cards/testing/setup.ts';

const args = process.argv.slice(2);
const arg = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const runs = Number(arg('runs') ?? 2);
const only = arg('only');
/** 세 갈래 중 하나만(real · private · generated) — 실제 소재만 다시 잴 때 */
const onlySet = arg('set');
/** 세트마다 최소 캡션까지 만들어 잰다(남은 일 3 · 2026-10-18) */
const withCaption = args.includes('--caption');
const label = arg('label') ?? 'cards';
// 프롬프트 판 고르기(다른 측정 스크립트와 같은 방식): 회차마다 새 DB 의 설정에 넣는다
const promptVersions: Record<string, string> = parsePromptArgs(args, path.join(env.repoRoot, 'prompts'));
const versions: Record<string, string> = { ...getSetting(null, 'prompts.activeVersions'), ...promptVersions };
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
  /** 표지 단계·본문 단계 시간 — 화면의 「보통 N분」 안내를 측정값으로 쓰려고 */
  coverSec: number | null;
  bodySec: number | null;
  sleptSec: number;
  reasons: Record<string, number>;
  ungrounded: string[];
  countOk: boolean | null;
  cardsText: string[];
  /** 본문 단계 자기 평가가 낸 지적 전부(재작성 여부와 상관없이) — 풀이 표시 빠짐을 잡았는지 사람이 읽는다 */
  reviews: string[];
  /** 본문 회차마다 코드 규칙 지적 전문 — 근거 인용 불일치 원인을 보려고(남은 일 4) */
  ruleErrors: string[];
  /** 결정 A·B 다시 세기: 최종 세트에 표지 약속이 빠졌나 · 기준일 없이 남은 기준일 숫자 */
  coverMissing: string[];
  datedMissing: string[];
  caption: null | { status: string; rewrites: number; calls: number; cut: string[]; text: string | null; glosses: string[]; ungrounded: string[]; reviews: string[]; ruleErrors: string[]; error?: string };
  pngDir: string | null;
}

/**
 * 이 회차 ai_runs 에서 **재작성을 부른** 문제만: 생성 회차가 rule_error 이고 같은 과제의 다음 생성이 rewrite 인 것.
 * 처음엔 rule_error 회차를 모두 셌는데, 표지 후보는 걸린 후보만 빼고 받아들여도(acceptByDropping) rule_error 로 남아서
 * "뺀 후보"의 사유가 재작성 사유에 섞였다(2026-10-15 측정 — 결과 파일에 정정)
 */
function rewriteReasons(db: Db): Record<string, number> {
  const out: Record<string, number> = {};
  const rows = db.prepare("SELECT task, kind, status, issues_json FROM ai_runs WHERE task IN ('cover_titles', 'card_body') AND kind IN ('generate', 'rewrite') ORDER BY id").all() as Array<{
    task: string;
    kind: string;
    status: string;
    issues_json: string | null;
  }>;
  rows.forEach((r, i) => {
    const next = rows.slice(i + 1).find((x) => x.task === r.task);
    if (r.status !== 'rule_error' || next?.kind !== 'rewrite' || !r.issues_json) return;
    for (const x of JSON.parse(r.issues_json) as Array<{ code: string; level: string }>) if (x.level === 'error') out[reasonOf(x.code)] = (out[reasonOf(x.code)] ?? 0) + 1;
  });
  return out;
}

const numbersInText = (t: string) => (t.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/,(?=\d{3}(?!\d))/g, ''));

/** 과제의 생성·재작성 회차에 붙은 코드 규칙 지적(error) 전문 */
function taskRuleErrors(db: Db, task: string): string[] {
  const rows = db.prepare("SELECT kind, issues_json FROM ai_runs WHERE task = ? AND kind IN ('generate', 'rewrite') ORDER BY id").all(task) as Array<{ kind: string; issues_json: string | null }>;
  return rows.flatMap((r, n) =>
    (JSON.parse(r.issues_json ?? '[]') as Array<{ level: string; code: string; where?: string; message: string; from?: string }>)
      .filter((x) => x.from === 'rule' && x.level === 'error')
      .map((x) => `${n + 1}번째 ${r.kind === 'generate' ? '생성' : '재작성'} · ${x.code} · ${x.where ?? ''}: ${x.message}`),
  );
}

/** 과제의 생성·재작성 회차에 붙은 자기 평가 지적 */
function taskReviews(db: Db, task: string): string[] {
  const rows = db.prepare("SELECT kind, issues_json FROM ai_runs WHERE task = ? AND kind IN ('generate', 'rewrite') ORDER BY id").all(task) as Array<{ kind: string; issues_json: string | null }>;
  return rows.flatMap((r, n) =>
    (JSON.parse(r.issues_json ?? '[]') as Array<{ level: string; code: string; where?: string; message: string; from?: string }>)
      .filter((x) => x.from === 'review')
      .map((x) => `${n + 1}번째 ${r.kind === 'generate' ? '생성' : '재작성'} · ${x.level === 'error' ? x.code.replace('review_', '') : 'style'} · ${x.where ?? ''}: ${x.message}`),
  );
}

/** 본문 생성·재작성 회차에 붙은 자기 평가 지적 전부 (fact·broken 은 error, style 은 warn) */
function bodyReviews(db: Db): string[] {
  const rows = db.prepare("SELECT kind, issues_json FROM ai_runs WHERE task = 'card_body' AND kind IN ('generate', 'rewrite') ORDER BY id").all() as Array<{ kind: string; issues_json: string | null }>;
  return rows.flatMap((r, n) =>
    (JSON.parse(r.issues_json ?? '[]') as Array<{ level: string; code: string; where?: string; message: string; from?: string }>)
      .filter((x) => x.from === 'review')
      .map((x) => `${n + 1}번째 ${r.kind === 'generate' ? '생성' : '재작성'} · ${x.level === 'error' ? x.code.replace('review_', '') : 'style'} · ${x.where ?? ''}: ${x.message}`),
  );
}

const rows: Row[] = [];
fs.rmSync(outDir, { recursive: true, force: true });
for (const [setKey, dir, setLabel] of SETS) {
  if (onlySet && setKey !== onlySet) continue;
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
      setSetting(db, 'prompts.activeVersions', versions);
      const ai = new AiService({ db, provider: new ClaudeCodeProvider() });
      const { dataDir } = await seedBrand(pair.person, pair.set, pair.draft, db);
      const sourceId = addTestSource(db, text);
      const row: Row = { setLabel, source: name, person: pair.person, draft: pair.draft, run: n, covers: null, body: null, seconds: 0, coverSec: null, bodySec: null, sleptSec: 0, reasons: {}, ungrounded: [], countOk: null, cardsText: [], reviews: [], ruleErrors: [], coverMissing: [], datedMissing: [], caption: null, pngDir: null };
      const sw = startStopwatch();
      try {
        row.covers = await generateCovers(ai, 1, sourceId, null, undefined, dataDir);
        row.coverSec = sw.wallMs() / 1000;
        const first = row.covers.candidates[0];
        if (!first) throw new Error('보여 줄 표지 후보가 없음');
        row.body = await generateBody(ai, 1, { sourceId, cover: { headline: first.headline, sub: first.sub, pillarId: first.pillarId, chip: first.chip }, requested: null, coverJobId: null }, undefined, dataDir);
        row.bodySec = sw.wallMs() / 1000 - row.coverSec;
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
            for (const g of c.glosses ?? []) row.cardsText.push(`   ⚑ 풀이 표시 「${g.term}」: ${g.sentence}`);
          }
          const claims = cardCountClaims([first.headline, first.sub ?? ''], [text]);
          row.countOk = claims.length ? claims.every((cl) => cl.value === bodyCount) : null;
          // A·B 다시 세기 (규칙을 거쳤어도 최종 세트에서 다시)
          const bodyCards = set.cards.filter((c) => c.kind === 'body').map((c) => c.content as { title: string; text: string });
          const asBody = { cards: bodyCards.map((x) => ({ title: x.title, text: x.text, evidence: '', image: null })), closing: { headline: '', sub: null } };
          row.coverMissing = coverPromiseIssues({ headline: first.headline, sub: first.sub, pillarId: null, chip: null }, asBody, ctx.commonTerms).map((x) => x.message);
          const dated = datedNumbers(text);
          const bodyDated = datedNumberIssues(bodyCards.map((x, i) => ({ where: `cards.${i}`, text: `${x.title}\n${x.text}` })), dated);
          row.datedMissing = bodyDated.map((x) => `본문 ${x.where} "${x.number}" (${x.date.text})`);
          if (withCaption) {
            try {
              const cr = await generateCaption(ai, 1, set.id, undefined, dataDir);
              const cap = getCaption(db, set.id);
              const ctext = cap ? captionText(cap) : null;
              const capGround = cap ? findUngrounded([cap.hook, ...cap.lines].join('\n'), { ...ctx.grounding, source: [...ctx.grounding.source, ...set.cards.map((c) => Object.values(c.content).filter((v) => typeof v === 'string').join('\n'))], structural: [] }, ctx.commonTerms).map((u) => u.value) : [];
              const inBody = new Set(bodyCards.flatMap((x) => numbersInText(`${x.title}\n${x.text}`)));
              if (cap) for (const x of datedNumberIssues([{ where: 'caption', text: [cap.hook, ...cap.lines].join('\n') }], dated, inBody)) row.datedMissing.push(`캡션 "${x.number}" (${x.date.text})`);
              row.caption = { status: cr.status, rewrites: cr.rewrites, calls: cr.calls, cut: cr.status === 'saved' ? cr.cutHashtags : [], text: ctext, glosses: (cap?.glosses ?? []).map((g) => `「${g.term}」 ${g.sentence}`), ungrounded: capGround, reviews: taskReviews(db, 'caption_min'), ruleErrors: taskRuleErrors(db, 'caption_min'), ...(cr.status === 'failed' ? { error: cr.errors.join(' / ') } : {}) };
            } catch (err) {
              row.caption = { status: 'error', rewrites: 0, calls: 0, cut: [], text: null, glosses: [], ungrounded: [], reviews: [], ruleErrors: [], error: (err as Error).message };
            }
          }
        }
      } catch (err) {
        row.error = (err as Error).message;
      }
      row.seconds = sw.wallMs() / 1000;
      row.sleptSec = Math.round(sw.sleptMs() / 1000);
      row.reasons = rewriteReasons(db);
      row.reviews = bodyReviews(db);
      row.ruleErrors = taskRuleErrors(db, 'card_body');
      const b = row.body;
      console.log(
        `  → ${row.sleptSec ? `[잠자기 ${row.sleptSec}초] ` : ''}${row.coverSec !== null ? `(표지 ${row.coverSec.toFixed(0)}초${row.bodySec !== null ? ` · 본문 ${row.bodySec.toFixed(0)}초` : ''}) ` : ''}표지 ${row.covers ? `${row.covers.candidates.length}개(뺀 ${row.covers.dropped.length})·재작성 ${row.covers.rewrites}` : '-'} / 본문 ${b ? `${b.status}·재작성 ${b.rewrites}` : row.error ?? '-'} · ${row.seconds.toFixed(0)}초`,
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
  `- 프롬프트: ${['cover_titles', 'cover_titles_review', 'card_body', 'card_body_review', 'self_review'].map((k) => `${k}@${versions[k] ?? 'v1'}`).join(', ')} · 모델 opus · 소재마다 ${runs}회 · 표지는 후보 중 첫 번째를 고름`,
  // 실제로 돌린 짝만(남은 일 5 — 전엔 고정 문구라 실제 소재 회차와 맞지 않았다)
  `- 짝: ${[...new Set(rows.map((r) => `${r.source} × ${r.person}(시안 ${r.draft})`))].join(' · ') || '(없음)'} — 프로필·키트는 고정 스냅숏`,
  `- PNG: \`tests/results/${date}-${label}/<소재>-<브랜드>-<회>/\``,
  '- 재작성 사유는 재작성을 부른 회차의 코드 규칙 위반 건수(자기 평가의 fact·broken 은 「자기 평가」). 표지 후보에서 빼고 받아들인 것은 「뺀 후보」로 따로',
  '',
];
for (const [setKey, , setLabel] of SETS) {
  if (onlySet && setKey !== onlySet) {
    lines.push(`## ${setLabel}`, '', `이번 측정에서 돌리지 않음(--set=${onlySet})`, '');
    continue;
  }
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
  const secs = (f: (r: Row) => number | null) => rs.map(f).filter((x): x is number => x !== null).map((x) => x.toFixed(0)).join(' · ') || '-';
  lines.push(`| 단계 시간 (회차별) 표지 / 본문 | ${secs((r) => r.coverSec)} / ${secs((r) => r.bodySec)}초 |`);
  for (const c of CATS) lines.push(`| 재작성 사유 — ${c} (문제 건수) | ${sum(rs, (r) => r.reasons[c] ?? 0)} |`);
  const dropped: Record<string, number> = {};
  for (const r of rs) for (const d of r.covers?.dropped ?? []) for (const why of d.reasons.slice(0, 1)) {
    const code = /^\[([a-z_]+)\]/.exec(why)?.[1] ?? '';
    dropped[reasonOf(code)] = (dropped[reasonOf(code)] ?? 0) + 1;
  }
  lines.push(`| 뺀 표지 후보의 사유 (재작성 아님) | ${Object.entries(dropped).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'} |`);
  lines.push(`| 최종 카드의 원문 밖 숫자·영문 (FR-MK-2, 0이어야) | ${sum(saved, (r) => r.ungrounded.length)} |`);
  lines.push(`| 표지 개수 표현 = 본문 카드 수 (개수 표현 있는 세트) | ${saved.filter((r) => r.countOk === true).length}/${saved.filter((r) => r.countOk !== null).length} |`);
  lines.push(`| 풀이 표시 (⚑) 합 — card_body v2 부터 | ${sum(saved, (r) => r.cardsText.filter((t) => t.trimStart().startsWith('⚑')).length)} |`);
  lines.push(`| 잠자기가 낀 회차 | ${rs.filter((r) => r.sleptSec > 0).length}/${rs.length} |`);
  lines.push(`| 최종 세트의 표지 약속 빠짐 (결정 A, 0이어야) | ${sum(saved, (r) => r.coverMissing.length)} |`);
  lines.push(`| 기준일 없이 남은 기준일 숫자 (결정 B, 0이어야) | ${sum(saved, (r) => r.datedMissing.length)} |`);
  if (withCaption) {
    const caps = saved.map((r) => r.caption).filter((c): c is NonNullable<Row['caption']> => !!c);
    lines.push(`| 캡션 저장 / 실패 | ${caps.filter((c) => c.status === 'saved').length} / ${caps.filter((c) => c.status !== 'saved').length} |`);
    lines.push(`| 캡션 재작성 합 · 코드 규칙 지적 · 자기 평가 fact·broken | ${sum(saved, (r) => r.caption?.rewrites ?? 0)} · ${sum(saved, (r) => r.caption?.ruleErrors.length ?? 0)} · ${sum(saved, (r) => r.caption?.reviews.filter((x) => !x.includes(' · style · ')).length ?? 0)} |`);
    lines.push(`| 캡션 해시태그 자른 수 · 풀이 표시 · 원문 밖 숫자·영문 | ${sum(saved, (r) => r.caption?.cut.length ?? 0)} · ${sum(saved, (r) => r.caption?.glosses.length ?? 0)} · ${sum(saved, (r) => r.caption?.ungrounded.length ?? 0)} |`);
  }
  lines.push('');
  if (setLabel === '실제 · 비공개') continue;
  for (const r of rs) {
    lines.push(`### ${r.source} × ${r.person} (시안 ${r.draft}) · ${r.run}회${r.sleptSec ? ` (잠자기 ${r.sleptSec}초 포함)` : ''}`, '');
    if (r.covers) {
      lines.push(`표지 후보 ${r.covers.candidates.length}개 (호출 ${r.covers.calls}·재작성 ${r.covers.rewrites}): ${r.covers.candidates.map((c) => `「${c.headline.replace(/\*\*/g, '').replace(/\n/g, ' ')}」`).join(' · ')}`);
      if (r.covers.dropped.length) lines.push('', '뺀 후보:', ...r.covers.dropped.map((d) => `- 「${d.headline.replace(/\n/g, ' ')}」${d.sub ? ` / 부제 「${d.sub.replace(/\n/g, ' ')}」` : ''} — ${d.reasons.join(' / ')}`));
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
    if (r.reviews.length) lines.push('', '본문 자기 평가 지적:', ...r.reviews.map((x) => `- ${x}`));
    if (r.ruleErrors.length) lines.push('', '본문 코드 규칙 지적(전문):', ...r.ruleErrors.map((x) => `- ${x}`));
    if (r.coverMissing.length || r.datedMissing.length) lines.push('', `결정 A·B 다시 세기: ${[...r.coverMissing, ...r.datedMissing].join(' / ')}`);
    if (r.caption) {
      lines.push('', `캡션: ${r.caption.status} (호출 ${r.caption.calls}·재작성 ${r.caption.rewrites})${r.caption.cut.length ? ` · 자른 해시태그 ${r.caption.cut.join(' ')}` : ''}${r.caption.error ? ` · ${r.caption.error}` : ''}`);
      if (r.caption.text) lines.push('', '```', r.caption.text, '```');
      for (const g of r.caption.glosses) lines.push(`- ⚑ 캡션 풀이 표시 ${g}`);
      if (r.caption.ungrounded.length) lines.push(`- 캡션 원문 밖 숫자·영문: ${r.caption.ungrounded.join(', ')}`);
      if (r.caption.ruleErrors.length) lines.push('', '캡션 코드 규칙 지적:', ...r.caption.ruleErrors.map((x) => `- ${x}`));
      if (r.caption.reviews.length) lines.push('', '캡션 자기 평가 지적:', ...r.caption.reviews.map((x) => `- ${x}`));
    }
    lines.push(`재작성 사유: ${Object.entries(r.reasons).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'}`, '');
  }
}
fs.writeFileSync(path.join(env.repoRoot, 'tests/results', `${date}-${label}.md`), lines.join('\n'));
console.log(`[카드 측정] tests/results/${date}-${label}.md 에 저장`);
