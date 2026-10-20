// 자기 평가가 풀이 표시를 제대로 보는가 (결정 2026-10-15 · 카드 풀이·그림 사람 규칙, card_body_review v3).
//   npm run eval:gloss-review -- [--runs=2] [--prompt card_body_review=v3]
// 카드 측정(v1/v2 각 6회)에서는 표시가 빠진 풀이가 한 번도 나오지 않아 「표시 빠진 풀이를 자기 평가가 잡는가」를 잴 수 없었다.
// 그래서 본문은 고정한 입력(card_body v2 실제 출력 me 1회를 바탕으로 고친 것)을 쓰고 **자기 평가만 실제 AI** 로 부른다.
// 재작성은 0회(결과 하나에 자기 평가 한 번). 결과: tests/results/<날짜>-gloss-review.md
import fs from 'node:fs';
import path from 'node:path';
import { env, getSetting, setSetting } from '../server/src/config.ts';
import { parsePromptArgs } from './prompt-args.ts';
import { openDb } from '../server/src/db/index.ts';
import { AiService } from '../server/src/ai/adapter.ts';
import { ClaudeCodeProvider } from '../server/src/ai/providers/claude-code.ts';
import type { AiProvider, ProviderRunInput, ProviderRunOutput } from '../server/src/ai/types.ts';
import { closeBrowser } from '../server/src/render/browser.ts';
import { generateBody, type BodyOutput } from '../server/src/cards/body.ts';
import { addTestSource, seedBrand } from '../server/src/cards/testing/setup.ts';

const args = process.argv.slice(2);
const arg = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const runs = Number(arg('runs') ?? 2);
const promptVersions: Record<string, string> = parsePromptArgs(args, path.join(env.repoRoot, 'prompts'));
const versions: Record<string, string> = { ...getSetting(null, 'prompts.activeVersions'), card_body: 'v2', card_body_review: 'v3', ...promptVersions };
const date = new Date().toLocaleDateString('sv-SE');

/** 본문 생성은 고정 입력, 자기 평가만 실제 CLI 로 */
class ReviewOnlyProvider implements AiProvider {
  readonly id = 'review-only';
  private readonly real = new ClaudeCodeProvider();
  private readonly body: BodyOutput;
  constructor(body: BodyOutput) {
    this.body = body;
  }
  detect() {
    return this.real.detect();
  }
  run(input: ProviderRunInput): Promise<ProviderRunOutput> {
    if (input.prompt.includes('「결과」를 검토한다')) return this.real.run(input);
    return Promise.resolve({ structured: structuredClone(this.body), text: '', model: input.model, durationMs: 1 });
  }
}

const TAG = '태그는 노트에 붙이는 이름표 같은 거예요.';
const MD = 'Markdown은 # 같은 간단한 기호로 제목이나 목록을 표시하는 글 파일 형식이에요.';
const base = (): BodyOutput => ({
  cards: [
    {
      title: '폴더 대신 태그로 묶여요',
      text: `예전에는 같은 주제 노트를 모으려면 폴더를 직접 만들어야 했어요.\n\n모아 1.2에서는 노트에 태그를 붙이면 자동으로 묶여요. **태그 하나로 같은 주제 노트가 한 화면에 모여요.**\n\n${TAG}`,
      evidence: '태그를 붙이면 노트가 자동으로 묶인다. 예전에는 폴더를 직접 만들어야 했는데, 이제 태그 하나로 같은 주제 노트가 한 화면에 모인다.',
      image: null,
      glosses: [{ sentence: TAG, term: '태그' }],
    },
    {
      title: "검색창에 '어제'라고 써 보세요",
      text: '검색창에 날짜를 쓰면 그날 쓴 노트만 보여요.\n\n날짜 대신 **"어제"라고 써도 돼요.**\n\n저는 회의록을 찾을 때 이 기능을 제일 많이 썼어요.',
      evidence: '검색창에 날짜를 쓰면 그날 쓴 노트만 보인다. "어제"라고 써도 된다. 회의록을 찾을 때 제일 많이 썼다.',
      image: null,
      glosses: [],
    },
    {
      title: '공유 링크는 7일 뒤 사라져요',
      text: '공유 링크는 7일이 지나면 사라져요.\n\n링크를 보낸 사람이 일주일 지나서 열면 안 열려요.\n\n**오래 둘 자료는 내보내기로 따로 저장해 두세요.**',
      evidence: '공유 링크는 7일 뒤 사라진다. 링크를 보낸 사람이 일주일 지나서 열면 안 열린다는 뜻이라, 오래 둘 자료는 내보내기로 따로 저장해야 한다.',
      image: null,
      glosses: [],
    },
    {
      title: '내보내기는 Markdown만 돼요',
      text: `내보내기는 Markdown 파일로만 돼요. **PDF로 바로 뽑는 기능은 아직 없어요.**\n\n${MD}\n\nPDF가 꼭 필요하다면 이 점을 미리 알아 두세요.`,
      evidence: '내보내기는 Markdown 파일로만 된다. PDF 로 바로 뽑는 기능은 아직 없다.',
      image: null,
      glosses: [{ sentence: MD, term: 'Markdown' }],
    },
    {
      title: '무료는 노트 500개까지예요',
      text: '무료 요금제는 노트를 500개까지 만들 수 있어요.\n\n500개를 넘기면 새 노트를 만들 수 없어요. **기존 노트는 그대로 볼 수 있어요.**',
      evidence: '무료 요금제는 노트 500개까지다. 500개를 넘기면 새 노트를 만들 수 없고, 기존 노트는 그대로 볼 수 있다.',
      image: null,
      glosses: [],
    },
  ],
  closing: { headline: '오늘 노트에\n태그 하나 붙여 보기', sub: '다시 보고 싶다면 저장해 두세요' },
});

/** 고친 입력 네 가지 — 기대: control 은 풀이 관련 fact 없음, 나머지는 해당 카드에 fact */
const CASES: Array<{ id: string; what: string; expect: string; body: () => BodyOutput }> = [
  { id: 'control', what: '실제 v2 출력 그대로(풀이 2개 모두 표시, 내용 맞음)', expect: '풀이 관련 fact 없음', body: base },
  {
    id: 'unmarked',
    what: '풀이 문장은 그대로 두고 표시(glosses)만 지움 — 지난번 「Markdown은 …」·「태그는 이름표…」 모양',
    expect: 'cards.0 · cards.3 에 fact (표시 없는 소재 밖 풀이)',
    body: () => {
      const b = base();
      for (const c of b.cards) c.glosses = [];
      return b;
    },
  },
  {
    id: 'wrong',
    what: 'Markdown 풀이를 틀린 내용으로(표시는 있음): 「Markdown은 PDF처럼 모양이 고정된 문서 형식이에요.」',
    expect: 'cards.3 에 fact (틀린 풀이)',
    body: () => {
      const b = base();
      const wrong = 'Markdown은 PDF처럼 모양이 고정된 문서 형식이에요.';
      b.cards[3]!.text = b.cards[3]!.text.replace(MD, wrong);
      b.cards[3]!.glosses = [{ sentence: wrong, term: 'Markdown' }];
      return b;
    },
  },
  {
    id: 'claim',
    what: '풀이에 소재에 없는 기능 주장을 더함(표시는 있음): 「Markdown 파일은 어떤 메모 앱에서든 그대로 열려요.」',
    expect: 'cards.3 에 fact (풀이를 핑계로 더한 사실)',
    body: () => {
      const b = base();
      const claim = 'Markdown 파일은 어떤 메모 앱에서든 그대로 열려요.';
      b.cards[3]!.text = b.cards[3]!.text.replace(MD, claim);
      b.cards[3]!.glosses = [{ sentence: claim, term: 'Markdown' }];
      return b;
    },
  },
];

const source = fs
  .readFileSync(path.join(env.repoRoot, 'tests/fixtures/generated/sources/ai-tool-memo.md'), 'utf8')
  .replace(/^\s*<!--[\s\S]*?-->\s*/, '')
  .trim();
const lines = [
  `# 자기 평가의 풀이 판정 · ${date}`,
  '',
  `- 프롬프트: card_body@${versions.card_body} (요구 사항으로 보임), card_body_review@${versions.card_body_review}, self_review@${versions.self_review} · 모델 opus · 경우마다 ${runs}회 · 재작성 0회`,
  '- 소재: tests/fixtures/generated/sources/ai-tool-memo.md (AI 생성) × me(시안 A) — 실제·공개 / 실제·비공개: 자료 없음',
  '- 본문은 고정 입력(card_body v2 측정 me 1회 실제 출력을 바탕으로), **자기 평가만 실제 AI**. 카드 측정에서 표시 빠진 풀이가 한 번도 나오지 않아 따로 잰다',
  '',
  '| 경우 | 무엇을 바꿨나 | 기대 | 회차별 결과 |',
  '|---|---|---|---|',
];
const details: string[] = [];
for (const c of CASES) {
  const results: string[] = [];
  for (let n = 1; n <= runs; n++) {
    console.log(`[풀이 판정] ${c.id} ${n}/${runs} …`);
    const db = openDb(':memory:');
    setSetting(db, 'prompts.activeVersions', versions);
    setSetting(db, 'ai.maxRewrites', 0);
    const { dataDir, pillars } = await seedBrand('me', 'real', 'A', db);
    const sourceId = addTestSource(db, source);
    const ai = new AiService({ db, provider: new ReviewOnlyProvider(c.body()) });
    const cover = { headline: '모아 1.2\n**태그** 하나면 끝', sub: '폴더 안 만들어도 같은 주제 노트가 한 화면에 모여요', pillarId: pillars[0]!.id, chip: null };
    try {
      const r = await generateBody(ai, 1, { sourceId, cover, requested: null, coverJobId: null }, undefined, dataDir);
      const run = db.prepare("SELECT issues_json FROM ai_runs WHERE task = 'card_body' ORDER BY id DESC LIMIT 1").get() as { issues_json: string | null };
      const issues = (JSON.parse(run.issues_json ?? '[]') as Array<{ level: string; code: string; where?: string; message: string; from?: string }>).filter((i) => i.from === 'review');
      const facts = issues.filter((i) => i.level === 'error');
      results.push(`${n}회: ${r.status === 'saved' ? '저장' : '재작성 필요'} · fact ${facts.map((f) => f.where).join(', ') || '없음'}`);
      details.push(`### ${c.id} · ${n}회`, '', ...issues.map((i) => `- ${i.level === 'error' ? i.code.replace('review_', '') : 'style'} · ${i.where ?? ''}: ${i.message}`), issues.length ? '' : '(지적 없음)\n');
    } catch (err) {
      results.push(`${n}회: 오류 ${(err as Error).message}`);
    }
    console.log(`  → ${results.at(-1)}`);
  }
  lines.push(`| ${c.id} | ${c.what} | ${c.expect} | ${results.join('<br>')} |`);
}
await closeBrowser();
lines.push('', '## 자기 평가 지적 전문', '', ...details);
const out = path.join(env.repoRoot, 'tests/results', `${date}-gloss-review.md`);
fs.writeFileSync(out, lines.join('\n'));
console.log(`[풀이 판정] ${path.relative(env.repoRoot, out)} 에 저장`);
