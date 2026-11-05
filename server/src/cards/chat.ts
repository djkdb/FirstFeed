// 카드뉴스 채팅으로 고치기 (FR-MK-3 · 2026-11-04 사용자 지시 · 사용자 결정: 전/후 보고 「적용」).
// 「3번 카드 너무 설명조야」처럼 말하면 그 카드만 다시 쓰고 다시 그린다. 표지는 지시에 「표지」가 있거나 화면에서 고른 때만.
// 흐름은 생성과 같다: AI 가 고친 카드를 내면 → 코드 규칙(바뀐 카드에만) → 실제로 그려 넘침 → 자기 평가 → 걸리면 다시 쓰기(2회).
// 통과한 제안은 세트를 바꾸지 않고 전/후만 보여 주고, 「적용」을 눌러야 세트가 바뀐다. 적용 전 카드를 남겨 되돌릴 수 있다.
// 사용자가 쓴 지시는 허용 출처 4번(사용자가 직접 입력한 문장) — 「11월 15일 마감이라고 넣어줘」의 숫자는 통과한다
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { env, getSetting } from '../config.ts';
import type { AiService, JobContext } from '../ai/adapter.ts';
import { generateChecked } from '../ai/loop.ts';
import { loadPrompt } from '../ai/prompts.ts';
import { assetPath, MIME, type ImageType } from '../brand/assets.ts';
import type { Db } from '../db/index.ts';
import { FlowError } from '../identity/flow.ts';
import { getProfile } from '../identity/store.ts';
import { findUngrounded } from '../rules/grounding.ts';
import type { Issue } from '../rules/types.ts';
import { draftById } from '../templates/index.ts';
import { renderFrame, renderPhotoFrame, type FrameResult } from '../templates/render-frame.ts';
import { getTemplateVersion } from '../templates/store.ts';
import { resolveLook } from '../templates/look.ts';
import type { BodyContent, ClosingContent, CoverContent, FrameContent } from '../templates/types.ts';
import { pillarIndexOf } from '../templates/variant.ts';
import { aiRules, fixedRules, frames, glossesStillIn, type BodyOutput, type ChosenCover } from './body.ts';
import { cardContext, profileBlock, type CardContext } from './context.ts';
import { countClaims } from './count.ts';
import { getSet, rendersDir, type GlossMark } from './store.ts';

const Gloss = z.object({ sentence: z.string().min(1).max(200), term: z.string().min(1).max(40) });
export const ChatSchema = z.object({
  changes: z
    .array(
      z.object({
        where: z.string().regex(/^(cover|closing|cards\.\d+)$/),
        headline: z.string().max(80).nullable(),
        sub: z.string().max(80).nullable(),
        title: z.string().max(60).nullable(),
        text: z.string().max(600).nullable(),
        evidence: z.string().max(400).nullable(),
        glosses: z.array(Gloss).max(5),
      }),
    )
    .max(12),
  reply: z.string().min(1).max(300),
});
export type ChatOutput = z.infer<typeof ChatSchema>;

const issue = (where: string, code: string, message: string): Issue => ({ level: 'error', code, where, message, from: 'rule' });

type CardSet = NonNullable<ReturnType<typeof getSet>>;

/** 저장된 세트 → 본문 생성 결과 모양(같은 규칙 함수를 그대로 쓰려고) */
export function setAsBody(set: CardSet): { cover: ChosenCover; body: BodyOutput } {
  const coverC = set.cards[0]!.content as CoverContent;
  const bodies = set.cards.filter((c) => c.kind === 'body');
  const closing = set.cards.find((c) => c.kind === 'closing')!.content as ClosingContent;
  return {
    cover: { headline: coverC.headline, sub: coverC.sub ?? null, pillarId: set.pillarId, chip: coverC.chip ?? null },
    body: {
      cards: bodies.map((c) => {
        const b = c.content as BodyContent;
        return { title: b.title, text: b.text, evidence: c.evidence ?? '', image: c.image, glosses: (c.glosses ?? []).map((g) => ({ sentence: g.sentence, term: g.term })) };
      }),
      closing: { headline: closing.headline, sub: closing.sub ?? null },
    },
  };
}

/** 위치 → 카드 번호(0 표지, 1..N 본문, N+1 마무리) */
export function idxOf(where: string, n: number): number | null {
  if (where === 'cover') return 0;
  if (where === 'closing') return n + 1;
  const m = /^cards\.(\d+)$/.exec(where);
  return m && Number(m[1]) < n ? Number(m[1]) + 1 : null;
}

/** 제안을 지금 세트에 합친다. 지금과 똑같은 칸은 바뀐 것으로 치지 않는다 */
export function mergeChanges(cover: ChosenCover, body: BodyOutput, out: ChatOutput): { cover: ChosenCover; body: BodyOutput; changed: string[] } {
  const c = { ...cover };
  const d: BodyOutput = structuredClone(body);
  const changed: string[] = [];
  for (const ch of out.changes) {
    if (ch.where === 'cover') {
      const next = { headline: ch.headline ?? c.headline, sub: ch.sub };
      if (next.headline !== c.headline || next.sub !== c.sub) {
        Object.assign(c, next);
        changed.push('cover');
      }
    } else if (ch.where === 'closing') {
      const next = { headline: ch.headline ?? d.closing.headline, sub: ch.sub };
      if (next.headline !== d.closing.headline || next.sub !== d.closing.sub) {
        d.closing = next;
        changed.push('closing');
      }
    } else {
      const i = Number(ch.where.split('.')[1]);
      const cur = d.cards[i];
      if (!cur) continue;
      const next = { ...cur, title: ch.title ?? cur.title, text: ch.text ?? cur.text, evidence: ch.evidence ?? cur.evidence, glosses: ch.glosses };
      if (next.title !== cur.title || next.text !== cur.text || next.evidence !== cur.evidence || JSON.stringify(next.glosses) !== JSON.stringify(cur.glosses ?? [])) {
        d.cards[i] = next;
        changed.push(ch.where);
      }
    }
  }
  return { cover: c, body: d, changed: [...new Set(changed)] };
}

/** 이 문제가 바뀐 칸의 것인가 — 바뀌지 않은 카드(예: 사람이 직접 고친 카드)의 옛 문제로 제안을 막지 않으려고 */
const touches = (where: string | undefined, changed: string[]) =>
  !where || where === 'cards' || changed.some((w) => where === w || where.startsWith(`${w}.`));

/** 바뀌어도 되는 범위: 화면에서 고른 카드, 없으면 표지를 뺀 전부(지시에 「표지」가 있으면 표지도) */
export function allowedWheres(n: number, message: string, targets: number[] | null): Set<string> {
  const all = ['cover', ...Array.from({ length: n }, (_, i) => `cards.${i}`), 'closing'];
  if (targets?.length) return new Set(all.filter((w) => targets.includes(idxOf(w, n)!)));
  return new Set(all.filter((w) => w !== 'cover' || /표지|제목\s*카드|첫\s*(장|카드)/.test(message)));
}

export function chatRules(c: CardContext, cover: ChosenCover, body: BodyOutput, message: string, targets: number[] | null, minQuote: number) {
  const n = body.cards.length;
  const allowed = allowedWheres(n, message, targets);
  // 지시도 사용자가 직접 입력한 문장(허용 출처 4번)
  const withMessage: CardContext = { ...c, grounding: { ...c.grounding, userInput: [...(c.grounding.userInput ?? []), message] } };
  return [
    (o: ChatOutput): Issue[] => {
      const out: Issue[] = [];
      const seen = new Set<string>();
      for (const ch of o.changes) {
        if (idxOf(ch.where, n) === null) out.push(issue(ch.where, 'chat_unknown_card', `"${ch.where}" 는 이 세트에 없는 카드입니다. 본문은 cards.0 ~ cards.${n - 1} 입니다.`));
        else if (!allowed.has(ch.where))
          out.push(issue(ch.where, 'chat_out_of_scope', ch.where === 'cover' ? '지시에 표지 이야기가 없는데 표지를 바꿨습니다. 표지는 그대로 두세요.' : `지시와 관련 없는 ${ch.where} 를 바꿨습니다. 고른 카드만 고치세요.`));
        if (seen.has(ch.where)) out.push(issue(ch.where, 'chat_duplicate', `${ch.where} 를 두 번 적었습니다. 한 번만 적으세요.`));
        seen.add(ch.where);
        if (/^cards\./.test(ch.where) && (!ch.title || !ch.text || !ch.evidence)) out.push(issue(ch.where, 'chat_missing_field', '본문 카드는 title · text · evidence 를 모두 채웁니다(바꾸지 않는 칸은 지금 값 그대로).'));
        if ((ch.where === 'cover' || ch.where === 'closing') && !ch.headline) out.push(issue(ch.where, 'chat_missing_field', 'headline 을 채웁니다(바꾸지 않으면 지금 값 그대로).'));
      }
      const m = mergeChanges(cover, body, o);
      if (m.changed.length === 0) return out;
      const count = n; // 카드 수는 바꾸지 않는다 — 표지의 개수 표현은 지금 본문 수와 맞아야
      for (const p of [...fixedRules(c, m.cover, count), ...aiRules(withMessage, minQuote)].flatMap((r) => r(m.body))) if (touches(p.where, m.changed)) out.push(p);
      if (m.changed.includes('cover')) {
        // 표지 근거: 개수 표현은 개수 규칙이 따로 보므로 빼고 대조(카드 측정과 같은 방식)
        const raw = `${m.cover.headline}\n${m.cover.sub ?? ''}`.replace(/\*\*/g, '');
        const text = countClaims(raw).reduce((t, cl) => t.replace(cl.text, ' '), raw);
        for (const u of findUngrounded(text, { ...withMessage.grounding, structural: [n] }, c.commonTerms))
          out.push(issue('cover', u.kind === 'number' ? 'number_not_in_source' : 'english_not_in_source', `소재·프로필·메모·지시에 없는 ${u.kind === 'number' ? '숫자' : '영문 이름'} "${u.value}" 을(를) 썼습니다.`));
      }
      return out;
    },
  ];
}

/** 표지 그림(시안 F)이 있으면 그 그림을 바탕으로 — 그림 올리기 때와 같은 함수 */
async function renderOne(db: Db, c: CardContext, set: CardSet, cover: ChosenCover, content: FrameContent, dataDir: string): Promise<FrameResult> {
  const pillarIndex = pillarIndexOf(c.profile.pillars, cover.pillarId);
  const tv = getTemplateVersion(db, set.templateVersionId);
  const draft = (tv && draftById(tv.draftId)) || c.template.draft;
  // 세트를 그린 판의 모양(고정 판이 그 뒤에 바뀌었어도 같은 세트는 같은 모양으로)
  const look = tv ? resolveLook(tv.look, dataDir) : c.template.look;
  const file = content.kind === 'cover' && set.coverImage && draft.id === 'F' ? assetPath(dataDir, set.coverImage) : null;
  if (file && fs.existsSync(file)) {
    const url = `data:${MIME[file.split('.').pop() as ImageType]};base64,${fs.readFileSync(file).toString('base64')}`;
    return renderPhotoFrame(db, draft, look, content, url, { pillarIndex });
  }
  return renderFrame(db, draft, look, content, { pillarIndex });
}

export interface ChatChange {
  idx: number;
  kind: 'cover' | 'body' | 'closing';
  before: { content: FrameContent; evidence: string | null };
  content: FrameContent;
  evidence: string | null;
  glosses: GlossMark[];
  pngFile: string;
  render: { browser: string; reference: boolean; scale: number };
}

const baseKey = (set: CardSet) => crypto.createHash('sha256').update(JSON.stringify(set.cards.map((c) => [c.content, c.evidence, c.glosses]))).digest('hex').slice(0, 16);

/** 제안 만들기(AI). 세트는 바꾸지 않는다 */
export async function proposeChat(ai: AiService, brandId: number, setId: number, message: string, targets: number[] | null, job?: JobContext, dataDir = env.dataDir): Promise<{ chatId: number; status: 'proposed' | 'failed' }> {
  const db = ai.db;
  const set = getSet(db, setId);
  if (!set) throw new FlowError('카드 세트를 찾지 못했습니다.', '세트 목록에서 다시 고르세요.');
  const c0 = cardContext(db, brandId, set.sourceId, dataDir);
  // 이 세트를 만든 프로필 판의 축(축 색 변형 번호가 처음 그릴 때와 같게)
  const pillars = getProfile(db, set.profileId)?.pillars ?? c0.profile.pillars;
  const c: CardContext = { ...c0, profile: { ...c0.profile, pillars } };
  const { cover, body } = setAsBody(set);
  const n = body.cards.length;
  const b = c.template.budget;
  const cardsText = [
    `- cover: ${JSON.stringify({ headline: cover.headline, sub: cover.sub })}`,
    ...body.cards.map((x, i) => `- cards.${i} (${i + 2}번 카드): ${JSON.stringify({ title: x.title, text: x.text, evidence: x.evidence, glosses: x.glosses ?? [] })}`),
    `- closing (${n + 2}번 카드): ${JSON.stringify(body.closing)}`,
  ].join('\n');
  const allowed = allowedWheres(n, message, targets);
  const prompt = loadPrompt(db, 'card_chat', {
    scope: targets?.length
      ? `사용자가 고른 카드만 고친다: ${[...allowed].join(', ')}`
      : allowed.has('cover')
        ? '지시에 표지 이야기가 있으니 표지도 고칠 수 있다'
        : '표지(cover)는 고치지 않는다 — 지시에 표지 이야기가 없다',
    cover_chars: String(b.cover?.headline?.charsPerLine ?? 10),
    cover_lines: String(b.cover?.headline?.maxLines ?? 2),
    title_chars: String(b.body?.title?.charsPerLine ?? 15),
    title_lines: String(b.body?.title?.maxLines ?? 2),
    text_chars: String(b.body?.text?.maxChars ?? 250),
    closing_chars: String(b.closing?.headline?.charsPerLine ?? 12),
    closing_lines: String(b.closing?.headline?.maxLines ?? 3),
    body_count: String(n),
    message,
    cards: cardsText,
    profile: profileBlock(c),
    memo: c.source.memo ?? '(없음)',
    source: c.source.body,
  });
  let last: { key: string; rendered: Map<number, FrameResult> } | null = null;
  const r = await generateChecked(
    ai,
    {
      task: 'card_chat',
      prompt: prompt.text,
      promptRef: prompt.ref,
      schema: ChatSchema,
      rules: chatRules(c, cover, body, message, targets, getSetting(db, 'cards.minQuoteChars')),
      reviewCriteria: loadPrompt(db, 'card_body_review', {}).text,
      signal: job?.signal,
      lateRules: [
        async (o) => {
          const m = mergeChanges(cover, body, o);
          const fr = frames(c, m.cover, m.body);
          const rendered = new Map<number, FrameResult>();
          const out: Issue[] = [];
          for (const w of m.changed) {
            const idx = idxOf(w, n)!;
            const res = await renderOne(db, c, set, m.cover, fr[idx]!, dataDir);
            rendered.set(idx, res);
            if (!res.ok || !res.png) out.push(issue(w, res.problems[0]?.code ?? 'text_overflow', [...res.shorten.map((s) => s.message), ...res.problems.map((p) => p.message)].slice(0, 2).join(' ') || '카드 틀에 들어가지 않습니다.'));
          }
          last = { key: JSON.stringify(o), rendered };
          return out;
        },
      ],
    },
    job,
  );
  const insert = (status: string, extra: { reply?: string | null; changes?: unknown; error?: string | null }) =>
    Number(
      db
        .prepare('INSERT INTO card_chat (set_id, message, targets_json, status, reply, changes_json, error, job_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(setId, message, targets ? JSON.stringify(targets) : null, status, extra.reply ?? null, extra.changes ? JSON.stringify(extra.changes) : null, extra.error ?? null, job?.jobId ?? null).lastInsertRowid,
    );
  const done = last as { key: string; rendered: Map<number, FrameResult> } | null;
  if (!r.ok) {
    const why = r.errors.slice(0, 3).map((e) => e.message).join(' / ');
    return { chatId: insert('failed', { error: `규칙을 통과하지 못했어요(다시 쓰기 ${r.rewrites}번 뒤): ${why}` }), status: 'failed' };
  }
  const m = mergeChanges(cover, body, r.data);
  if (m.changed.length === 0) return { chatId: insert('failed', { reply: r.data.reply, error: '바뀐 카드가 없어요. 어느 카드를 어떻게 바꿀지 조금 더 구체적으로 말해 주세요.' }), status: 'failed' };
  if (!done || done.key !== JSON.stringify(r.data)) throw new Error('고친 카드를 그린 결과가 없습니다(코드 오류).');
  const fr = frames(c, m.cover, m.body);
  const id = insert('proposed', { reply: r.data.reply });
  const dir = rendersDir(dataDir, setId);
  fs.mkdirSync(dir, { recursive: true });
  const changes: ChatChange[] = m.changed.map((w) => {
    const idx = idxOf(w, n)!;
    const res = done.rendered.get(idx)!;
    const pngFile = `chat-${id}-${String(idx + 1).padStart(2, '0')}.png`;
    fs.writeFileSync(path.join(dir, pngFile), res.png!);
    const card = w.startsWith('cards.') ? m.body.cards[idx - 1]! : null;
    const cur = set.cards[idx]!;
    return {
      idx,
      kind: cur.kind as ChatChange['kind'],
      before: { content: cur.content, evidence: cur.evidence },
      content: fr[idx]!,
      evidence: card?.evidence ?? null,
      // 새 풀이 표시는 확인 전 상태로(결정 2026-10-18 — 확인하기 전엔 업로드 폴더를 만들 수 없다)
      glosses: card ? glossesStillIn(card).map((g) => ({ sentence: g.sentence, term: g.term, checkedAt: null })) : [],
      pngFile,
      render: { browser: `${res.browser.kind} ${res.browser.version}`, reference: res.browser.reference, scale: res.scale },
    };
  });
  db.prepare('UPDATE card_chat SET changes_json = ? WHERE id = ?').run(JSON.stringify({ base: baseKey(set), cards: changes }), id);
  return { chatId: id, status: 'proposed' };
}

type ChatRow = { id: number; set_id: number; message: string; targets_json: string | null; status: string; reply: string | null; changes_json: string | null; before_json: string | null; error: string | null; created_at: string };

export function listChat(db: Db, setId: number) {
  return (db.prepare('SELECT * FROM card_chat WHERE set_id = ? ORDER BY id').all(setId) as unknown as ChatRow[]).map((r) => ({
    id: Number(r.id),
    message: r.message,
    targets: r.targets_json ? (JSON.parse(r.targets_json) as number[]) : null,
    status: r.status as 'proposed' | 'applied' | 'discarded' | 'reverted' | 'failed',
    reply: r.reply,
    error: r.error,
    createdAt: r.created_at,
    changes: r.changes_json ? (JSON.parse(r.changes_json) as { cards: ChatChange[] }).cards : [],
  }));
}

export class ChatError extends Error {}

function row(db: Db, setId: number, chatId: number): ChatRow {
  const r = db.prepare('SELECT * FROM card_chat WHERE id = ? AND set_id = ?').get(chatId, setId) as unknown as ChatRow | undefined;
  if (!r) throw new ChatError('그 고치기를 찾지 못했습니다. 화면을 새로고침하세요.');
  return r;
}

/** 적용: 바뀌기 전 카드(글 · PNG)를 남기고 제안을 세트에 넣는다. 제안 뒤에 세트가 바뀌었으면 막는다(옛 세트 위에 만든 제안이라) */
export function applyChat(db: Db, dataDir: string, setId: number, chatId: number): void {
  const r = row(db, setId, chatId);
  if (r.status !== 'proposed') throw new ChatError('이미 적용했거나 버린 제안입니다.');
  const set = getSet(db, setId)!;
  const ch = JSON.parse(r.changes_json!) as { base: string; cards: ChatChange[] };
  if (ch.base !== baseKey(set)) throw new ChatError('이 제안을 만든 뒤 세트가 바뀌었어요(다른 고치기를 적용했거나 직접 고침). 같은 말을 다시 보내 주세요.');
  const dir = rendersDir(dataDir, setId);
  const before = ch.cards.map((x) => {
    const cur = set.cards[x.idx]!;
    const keep = `chat-${chatId}-before-${String(x.idx + 1).padStart(2, '0')}.png`;
    fs.copyFileSync(path.join(dir, cur.pngFile), path.join(dir, keep));
    return { idx: x.idx, content: cur.content, evidence: cur.evidence, glosses: cur.glosses, render: cur.render, pngFile: keep };
  });
  writeCards(db, dir, setId, set, ch.cards.map((x) => ({ idx: x.idx, content: x.content, evidence: x.evidence, glosses: x.glosses, render: x.render, pngFile: x.pngFile })));
  db.prepare("UPDATE card_chat SET status = 'applied', before_json = ? WHERE id = ?").run(JSON.stringify(before), chatId);
}

export function discardChat(db: Db, setId: number, chatId: number): void {
  const r = row(db, setId, chatId);
  if (r.status !== 'proposed') throw new ChatError('이미 적용했거나 버린 제안입니다.');
  db.prepare("UPDATE card_chat SET status = 'discarded' WHERE id = ?").run(chatId);
}

/** 되돌리기: 가장 최근에 적용한 고치기만(그 뒤에 적용한 것이 있으면 그것부터 — 뒤엣것이 앞엣것 위에 만들어져서) */
export function revertChat(db: Db, dataDir: string, setId: number, chatId: number): void {
  const r = row(db, setId, chatId);
  if (r.status !== 'applied') throw new ChatError('적용한 고치기만 되돌릴 수 있습니다.');
  const later = db.prepare("SELECT id FROM card_chat WHERE set_id = ? AND status = 'applied' AND id > ?").get(setId, chatId);
  if (later) throw new ChatError('이 뒤에 적용한 고치기가 있어요. 가장 최근 것부터 되돌려 주세요.');
  const set = getSet(db, setId)!;
  const before = JSON.parse(r.before_json!) as Array<{ idx: number; content: FrameContent; evidence: string | null; glosses: GlossMark[] | null; render: ChatChange['render']; pngFile: string }>;
  writeCards(db, rendersDir(dataDir, setId), setId, set, before.map((x) => ({ ...x, glosses: x.glosses ?? [] })));
  db.prepare("UPDATE card_chat SET status = 'reverted' WHERE id = ?").run(chatId);
}

/** 카드 글 · PNG 를 함께 바꾼다. PNG 는 임시 파일로 먼저 써서 DB 와 어긋나지 않게(replaceCard 와 같은 방식) */
function writeCards(db: Db, dir: string, setId: number, set: CardSet, cards: Array<{ idx: number; content: FrameContent; evidence: string | null; glosses: GlossMark[]; render: ChatChange['render']; pngFile: string }>): void {
  const tmps = cards.map((x) => {
    const target = path.join(dir, set.cards[x.idx]!.pngFile);
    const tmp = `${target}.tmp`;
    fs.copyFileSync(path.join(dir, x.pngFile), tmp);
    return { tmp, target };
  });
  db.exec('BEGIN');
  try {
    const up = db.prepare('UPDATE cards SET content_json = ?, evidence = ?, glosses_json = ?, render_json = ? WHERE set_id = ? AND idx = ?');
    for (const x of cards) up.run(JSON.stringify(x.content), x.evidence, JSON.stringify(x.glosses), JSON.stringify(x.render), setId, x.idx);
    for (const t of tmps) fs.renameSync(t.tmp, t.target);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    for (const t of tmps) fs.rmSync(t.tmp, { force: true });
    throw err;
  }
}

/** 화면이 달라는 채팅 PNG 이름 모양 */
export const CHAT_PNG = /^chat-\d+-(before-)?\d{2}\.png$/;
