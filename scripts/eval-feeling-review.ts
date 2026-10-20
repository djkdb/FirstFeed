// 자기 평가가 「지어낸 감상·동기」를 잡는가 + 정상 문장을 잘못 잡지 않는가 (결정 2026-10-18 · C).
//   npm run eval:feeling-review -- [--runs=2]
// 자연 발생 빈도가 낮아(카드 측정 12회 중 1번) 고정 입력에 그런 문장을 넣어 잰다. 본문·캡션은 고정 입력, **자기 평가만 실제 AI**, 재작성 0회.
// 카드: card_body_review v3 / v4, 캡션: caption_min_review v1 / v2 를 같은 입력으로 나란히. 결과: tests/results/<날짜>-feeling-review.md
import fs from 'node:fs';
import path from 'node:path';
import { env, getSetting, setSetting } from '../server/src/config.ts';
import { openDb } from '../server/src/db/index.ts';
import { AiService } from '../server/src/ai/adapter.ts';
import { ClaudeCodeProvider } from '../server/src/ai/providers/claude-code.ts';
import type { AiProvider, ProviderRunInput, ProviderRunOutput } from '../server/src/ai/types.ts';
import { closeBrowser } from '../server/src/render/browser.ts';
import { generateBody, type BodyOutput } from '../server/src/cards/body.ts';
import { addTestSource, seedBrand } from '../server/src/cards/testing/setup.ts';
import { generateCaption, type CaptionOutput } from '../server/src/publish/caption.ts';

const args = process.argv.slice(2);
const runs = Number(args.find((a) => a.startsWith('--runs='))?.slice(7) ?? 2);
const date = new Date().toLocaleDateString('sv-SE');

/** 생성은 고정 입력, 자기 평가만 실제 CLI. 캡션 경우엔 본문 자기 평가를 「문제 없음」으로 넘긴다(캡션 평가만 재려고) */
class ReviewOnlyProvider implements AiProvider {
  readonly id = 'review-only';
  private readonly real = new ClaudeCodeProvider();
  private readonly body: BodyOutput;
  private readonly caption: CaptionOutput | null;
  constructor(body: BodyOutput, caption: CaptionOutput | null) {
    this.body = body;
    this.caption = caption;
  }
  detect() {
    return this.real.detect();
  }
  run(input: ProviderRunInput): Promise<ProviderRunOutput> {
    const p = input.prompt;
    if (p.includes('「결과」를 검토한다')) {
      if (this.caption && !p.includes('캡션(hook·lines)')) return Promise.resolve({ structured: { issues: [] }, text: '', model: input.model, durationMs: 1 });
      return this.real.run(input);
    }
    if (p.includes('짧은 캡션')) return Promise.resolve({ structured: structuredClone(this.caption), text: '', model: input.model, durationMs: 1 });
    return Promise.resolve({ structured: structuredClone(this.body), text: '', model: input.model, durationMs: 1 });
  }
}

const card = (title: string, text: string, evidence: string) => ({ title, text, evidence, image: null, glosses: [] });
const DESSERT: BodyOutput = {
  cards: [
    card('결론부터, 줄 서도 돼요', '딸기 타르트 때문이라면 **줄 서도 아깝지 않아요.**\n\n다만 주말이면 오픈 시간에 맞춰 가세요.', '결론: 딸기 타르트 때문이라면 줄 서도 아깝지 않다. 다만 주말이면 오픈 시간에 맞춰 가자.'),
    card('주말엔 40분 대기', '평일 오후 3시에는 웨이팅이 없었어요.\n\n주말 오후 1시에는 **40분을 기다렸어요.**', '평일 오후 3시에는 웨이팅이 없었다. 주말 오후 1시에는 40분을 기다렸다.'),
    card('딸기 타르트는 두 번 다 만족', '대표 메뉴인 딸기 타르트는 7,500원이에요.\n\n딸기가 크고 크림이 덜 달아서 **두 번 다 만족했어요.**', '대표 메뉴인 딸기 타르트는 7,500원이다. 딸기가 크고 크림이 덜 달아서 두 번 다 만족했다.'),
    card('아쉬운 건 아메리카노', '디저트에 비해 **커피 맛이 평범했어요.**', '아쉬웠던 건 아메리카노다. 디저트에 비해 커피 맛이 평범했다.'),
  ],
  closing: { headline: '주말 가기 전에\n저장해 두세요', sub: '같이 갈 친구를 댓글로 태그해 주세요' },
};
const BUDGET: BodyOutput = {
  cards: [
    card('주말 세 번을\n통째로 썼어요', '영수증 사진을 찍으면 항목이 알아서 나뉘는 기능을 만들었어요.\n\n3주 동안 **주말 세 번을 통째로** 썼어요.', '영수증 사진을 찍으면 항목이 알아서 나뉘는 기능을 3주 동안 만들었다. 주말 세 번을 통째로 썼다.'),
    card('72%에서\n88%까지', '정확도는 처음 72%였어요.\n\n자주 틀리는 항목 30개를 정리해 넣은 뒤 **88%까지** 올랐어요.', '항목 나누기 정확도는 처음 72%였는데, 자주 틀리는 항목 30개를 따로 정리해 넣은 뒤 88%까지 올랐다.'),
    card('아무도 안 써서\n지운 기능', '카테고리 색을 자동으로 바꾸는 기능은 친구들이 **아무도 안 써서** 지웠어요.', '영수증을 찍으면 자동으로 카테고리 색을 바꾸는 기능은 친구들이 아무도 안 써서 지웠다.'),
  ],
  closing: { headline: '다음 제작기도\n팔로우로 받아 보세요', sub: null },
};
const edit = (b: BodyOutput, f: (c: BodyOutput) => void) => {
  const x = structuredClone(b);
  f(x);
  return x;
};
const CAP: CaptionOutput = { hook: '온실 베이커리, 줄 서도 될까?', lines: ['딸기 타르트는 두 번 다 만족했어요', '주말엔 문 여는 11시에 맞춰 가세요', '저장해 두고 주말에 꺼내 보세요'], hashtags: ['#디저트', '#베이커리'], glosses: [] };

interface Case {
  id: string;
  kind: 'card' | 'caption';
  person: 'seoyeon' | 'doyun';
  what: string;
  /** fact 가 나와야 하는 위치(없으면 fact 가 나오면 과잉 판정) */
  expect: string | null;
  body: BodyOutput;
  caption?: CaptionOutput;
}
const CASES: Case[] = [
  { id: 'card-control', kind: 'card', person: 'seoyeon', what: '정상(소재 그대로)', expect: null, body: DESSERT },
  {
    id: 'card-feeling',
    kind: 'card',
    person: 'seoyeon',
    what: '3번 카드에 「40분을 기다린 날도 이 타르트 하나면 괜찮았어요.」 — 소재는 「40분 기다렸다」·「두 번 다 만족」뿐',
    expect: 'cards.2',
    body: edit(DESSERT, (b) => (b.cards[2]!.text += '\n\n40분을 기다린 날도 이 타르트 하나면 괜찮았어요.')),
  },
  {
    id: 'card-voice',
    kind: 'card',
    person: 'seoyeon',
    what: '말투 규칙을 옮긴 표현(「결론부터 말할게요.」) + 행동 유도(「가 본 분은 그날 웨이팅을 댓글로 알려 주세요」) — 감상 아님',
    expect: null,
    body: edit(DESSERT, (b) => {
      b.cards[0]!.text = `결론부터 말할게요. ${b.cards[0]!.text}`;
      b.closing.sub = '가 본 분은 그날 웨이팅을 댓글로 알려 주세요';
    }),
  },
  { id: 'card-control2', kind: 'card', person: 'doyun', what: '정상(소재 그대로)', expect: null, body: BUDGET },
  {
    id: 'card-motive',
    kind: 'card',
    person: 'doyun',
    what: '1번 카드에 「만드는 사람도 귀찮아서 시작한 기능이에요.」 — 만든 동기는 소재에 없음',
    expect: 'cards.0',
    body: edit(BUDGET, (b) => (b.cards[0]!.text += '\n\n만드는 사람도 귀찮아서 시작한 기능이에요.')),
  },
  { id: 'cap-control', kind: 'caption', person: 'seoyeon', what: '정상 캡션(행동 유도 「저장해 두고 주말에 꺼내 보세요」 포함)', expect: null, body: DESSERT, caption: CAP },
  {
    id: 'cap-feeling',
    kind: 'caption',
    person: 'seoyeon',
    what: '캡션에 「40분 기다린 보람이 있었어요」 — 소재에 없는 감상',
    expect: 'lines',
    body: DESSERT,
    caption: { ...CAP, lines: [...CAP.lines.slice(0, 2), '40분 기다린 보람이 있었어요', CAP.lines[2]!] },
  },
];
const SRC: Record<string, string> = {
  seoyeon: fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/generated/sources/dessert-visit.md'), 'utf8').replace(/^\s*<!--[\s\S]*?-->\s*/, '').trim(),
  doyun: fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/generated/sources/budget-devlog.md'), 'utf8').replace(/^\s*<!--[\s\S]*?-->\s*/, '').trim(),
};
const DRAFT = { seoyeon: 'B', doyun: 'C' } as const;
const COVER = { seoyeon: '온실 베이커리\n**줄 서도** 될까?', doyun: '영수증 찍으면\n**알아서** 나뉘어요' } as const;

const lines = [
  `# 자기 평가의 지어낸 감상·동기 판정 · ${date}`,
  '',
  `- 카드: card_body_review v3 / v4 · 캡션: caption_min_review v1 / v2 (self_review@${getSetting(null, 'prompts.activeVersions').self_review}) · 모델 opus · 경우마다 ${runs}회 · 재작성 0회`,
  '- 소재: AI 생성(dessert-visit × seoyeon 시안 B, budget-devlog × doyun 시안 C) — 실제·공개 / 실제·비공개: 자료 없음',
  '- 생성은 고정 입력, **자기 평가만 실제 AI**. 「잡음」 = 기대 위치에 fact, 「과잉」 = fact 가 나오면 안 되는 경우에 fact',
  '',
  '| 경우 | 무엇 | 기대 | 옛 판 (v3 / v1) | 새 판 (v4 / v2) |',
  '|---|---|---|---|---|',
];
const details: string[] = [];
for (const c of CASES) {
  const cols: string[] = [];
  for (const ver of c.kind === 'card' ? ['v3', 'v4'] : ['v1', 'v2']) {
    const res: string[] = [];
    for (let n = 1; n <= runs; n++) {
      console.log(`[감상 판정] ${c.id} ${ver} ${n}/${runs} …`);
      const db = openDb(':memory:');
      const versions = { ...getSetting(null, 'prompts.activeVersions'), card_body: 'v3', ...(c.kind === 'card' ? { card_body_review: ver } : { card_body_review: 'v4', caption_min_review: ver }) };
      setSetting(db, 'prompts.activeVersions', versions);
      setSetting(db, 'ai.maxRewrites', 0);
      const { dataDir, pillars } = await seedBrand(c.person, 'generated', DRAFT[c.person], db);
      const sourceId = addTestSource(db, SRC[c.person]!);
      const ai = new AiService({ db, provider: new ReviewOnlyProvider(c.body, c.caption ?? null) });
      try {
        const body = await generateBody(ai, 1, { sourceId, cover: { headline: COVER[c.person], sub: null, pillarId: pillars[0]!.id, chip: null }, requested: null, coverJobId: null }, undefined, dataDir);
        let task = 'card_body';
        if (c.kind === 'caption') {
          if (body.status !== 'saved') throw new Error(`본문이 저장되지 않음: ${body.status}`);
          await generateCaption(ai, 1, body.setId, undefined, dataDir);
          task = 'caption_min';
        }
        const run = db.prepare('SELECT issues_json FROM ai_runs WHERE task = ? ORDER BY id DESC LIMIT 1').get(task) as { issues_json: string | null };
        const issues = (JSON.parse(run.issues_json ?? '[]') as Array<{ level: string; code: string; where?: string; message: string; from?: string }>).filter((i) => i.from === 'review');
        const facts = issues.filter((i) => i.level === 'error');
        const hit = c.expect ? facts.some((f) => (f.where ?? '').startsWith(c.expect!)) : null;
        const over = c.expect ? facts.filter((f) => !(f.where ?? '').startsWith(c.expect!)) : facts;
        res.push(`${n}회: ${c.expect ? (hit ? '잡음' : '놓침') : '—'}${over.length ? ` · 과잉 ${over.length}(${over.map((f) => f.where).join(',')})` : ''}`);
        details.push(`### ${c.id} · ${ver} · ${n}회`, '', ...issues.map((i) => `- ${i.level === 'error' ? i.code.replace('review_', '') : 'style'} · ${i.where ?? ''}: ${i.message}`), issues.length ? '' : '(지적 없음)\n');
      } catch (err) {
        res.push(`${n}회: 오류 ${(err as Error).message}`);
      }
      console.log(`  → ${res.at(-1)}`);
    }
    cols.push(res.join('<br>'));
  }
  lines.push(`| ${c.id} | ${c.what} | ${c.expect ? `${c.expect} 에 fact` : 'fact 없음'} | ${cols[0]} | ${cols[1]} |`);
}
await closeBrowser();
lines.push('', '## 자기 평가 지적 전문', '', ...details);
const out = path.join(env.repoRoot, 'tests/results', `${date}-feeling-review.md`);
fs.writeFileSync(out, lines.join('\n'));
console.log(`[감상 판정] ${path.relative(env.repoRoot, out)} 에 저장`);
