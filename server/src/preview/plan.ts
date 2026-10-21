// 30일 뒤 내 계정 미리보기의 시리즈 계획 (FR-BR-6 · 결정 2026-10-21).
// 확정 프로필의 축을 돌아가며 첫 9개 게시물 제목을 AI 1회로 받는다. 자기 평가는 하지 않는다 — 게시 전 계획이고
// 수용 기준(개수 · 축 · 길이 · 근거)을 코드가 잰다(브랜딩 시각과 같은 이유, 결정 2026-10-14). 제목 속 숫자·영문은 근거 대조.
// 칸마다 사용자가 고치거나 고정할 수 있고, 다시 만들면 고정한 칸은 그대로 둔다. SQL 은 이 파일에만.
import { z } from 'zod';
import type { DatabaseSync } from 'node:sqlite';
import type { AiService, JobContext } from '../ai/adapter.ts';
import { generateChecked } from '../ai/loop.ts';
import { loadPrompt } from '../ai/prompts.ts';
import { currentSelection } from '../brand/store.ts';
import { commonEnglishTerms, getSetting } from '../config.ts';
import { FlowError } from '../identity/flow.ts';
import { formatProfileForPrompt, profileForGeneration, profileGroundingTexts, type ProfileInput } from '../identity/for-generation.ts';
import { activeProfile, listTurns } from '../identity/store.ts';
import { findUngrounded } from '../rules/grounding.ts';
import type { Issue, Rule } from '../rules/types.ts';
import { fixedTemplate } from '../templates/store.ts';

type Db = DatabaseSync;

export interface PlanSlot {
  title: string;
  pillarId: string;
  locked: boolean;
  /** ai = AI 가 쓴 제목, edit = 사용자가 고친 제목(허용 출처 4번) */
  origin: 'ai' | 'edit';
}
export interface SavedPlan {
  id: number;
  profileId: number;
  slots: PlanSlot[];
  createdAt: string;
}

export const PlanSchema = z.object({
  titles: z.array(z.object({ title: z.string().min(1).max(80), pillar_id: z.string() })).min(1).max(20),
});
type PlanOut = z.infer<typeof PlanSchema>;

/** 제목 길이 상한 — 고정한 템플릿 표지 제목 칸(한 줄 글자 수 × 줄 수). 숫자를 따로 정하지 않고 템플릿에서 잰 값을 쓴다 */
export function titleMax(db: Db, brandId: number): number {
  const head = fixedTemplate(db, brandId)?.budget.cover?.headline;
  if (!head) throw new FlowError('고정한 템플릿이 없습니다.', '「템플릿」에서 시안 하나를 고정한 뒤 다시 시도하세요 — 계획 칸을 그 틀의 색과 글자 수로 그립니다.');
  // 줄 수 제한이 없는 칸은 표지 제목 생성과 같은 기본 2줄로 본다(cards/covers.ts 의 max_lines)
  return head.charsPerLine * (head.maxLines ?? 2);
}

export interface PlanContext {
  count: number;
  maxChars: number;
  pillarIds: string[];
  grounding: { source: string[]; brand: string[]; userInput: string[] };
  commonTerms: string[];
}

const issue = (i: number, code: string, message: string): Issue => ({ level: 'error', code, message, where: `titles.${i}.title`, from: 'rule' });

export function planRules(c: PlanContext): Rule<PlanOut>[] {
  return [
    (d) => (d.titles.length === c.count ? [] : [{ level: 'error', code: 'plan_count', message: `제목이 ${d.titles.length}개입니다 — 정확히 ${c.count}개`, where: 'titles', from: 'rule' }]),
    (d) =>
      d.titles.flatMap((t, i) => {
        const out: Issue[] = [];
        if (!c.pillarIds.includes(t.pillar_id)) out.push(issue(i, 'unknown_pillar', `축 ID "${t.pillar_id}" 가 프로필에 없습니다`));
        const n = [...t.title].length;
        if (n > c.maxChars) out.push(issue(i, 'title_too_long', `${n}자 — ${c.maxChars}자 이내로`));
        if (t.title.includes('\n')) out.push(issue(i, 'title_newline', '한 줄로 씁니다'));
        for (const u of findUngrounded(t.title, c.grounding, c.commonTerms))
          out.push(issue(i, u.kind === 'number' ? 'number_not_in_source' : 'english_not_in_source', `프로필·브랜딩·사용자 답에 없는 ${u.kind === 'number' ? '숫자' : '영문 이름'} "${u.value}"`));
        return out;
      }),
    (d) => {
      const missing = c.pillarIds.filter((id) => !d.titles.some((t) => t.pillar_id === id));
      return missing.length && d.titles.length >= c.pillarIds.length
        ? [{ level: 'error', code: 'pillar_missing', message: `빠진 축: ${missing.join(', ')} — 모든 축을 한 번 이상`, where: 'titles', from: 'rule' }]
        : [];
    },
  ];
}

/** 허용 출처 2번(프로필 · 브랜딩 키트)과 4번(사용자가 직접 쓴 인터뷰 답 — 예시를 그대로 보낸 답은 빼고) */
function groundingFor(db: Db, brandId: number, p: ProfileInput): PlanContext['grounding'] {
  const sel = currentSelection(db, brandId);
  const sessionId = activeProfile(db, brandId)?.sessionId ?? null;
  const answers = sessionId ? listTurns(db, sessionId).filter((t) => t.answer && t.answerKind === 'text').map((t) => t.answer!) : [];
  return { source: [], brand: [...profileGroundingTexts(p), ...[sel.handle, sel.displayName, sel.bio].filter((x): x is string => !!x)], userInput: answers };
}

export function planContext(db: Db, brandId: number, p: ProfileInput): PlanContext {
  return {
    count: getSetting(db, 'preview.gridCells'),
    maxChars: titleMax(db, brandId),
    pillarIds: p.pillars.map((x) => x.id),
    grounding: groundingFor(db, brandId, p),
    commonTerms: commonEnglishTerms(db),
  };
}

export interface PlanResult {
  plan: SavedPlan;
  calls: number;
  rewrites: number;
}

/** 계획을 만든다(또는 다시 만든다). 고정한 칸은 제목·축을 그대로 두고, 나머지만 AI 결과로 채운다 */
export async function generatePlan(ai: AiService, brandId: number, job?: JobContext): Promise<PlanResult> {
  const db = ai.db;
  const profile = profileForGeneration(db, brandId);
  const c = planContext(db, brandId, profile);
  const prev = latestPlan(db, brandId);
  const locked = prev && prev.profileId === profile.profileId ? prev.slots.map((s, i) => ({ s, i })).filter((x) => x.s.locked) : [];
  const sel = currentSelection(db, brandId);
  const prompt = loadPrompt(db, 'series_plan', {
    count: String(c.count),
    max_chars: String(c.maxChars),
    keep: locked.length
      ? `- 아래 칸은 사용자가 고정했다. 같은 자리에 같은 제목·축 그대로 두고 나머지 칸만 새로 쓴다:\n${locked.map((x) => `  - ${x.i + 1}번: [${x.s.pillarId}] ${x.s.title}`).join('\n')}`
      : '',
    profile: formatProfileForPrompt(profile),
    kit: [`아이디: ${sel.handle ?? '(정하지 않음)'}`, `이름: ${sel.displayName ?? '(정하지 않음)'}`, `바이오: ${sel.bio ?? '(정하지 않음)'}`].join('\n'),
    answers: c.grounding.userInput.length ? c.grounding.userInput.map((a) => `- ${a}`).join('\n') : '(없음)',
  });
  const r = await generateChecked(ai, { task: 'series_plan', prompt: prompt.text, promptRef: prompt.ref, schema: PlanSchema, rules: planRules(c), selfReview: false, signal: job?.signal }, job);
  if (!r.ok) {
    throw new FlowError(
      `계획을 만들지 못했어요(재작성 ${r.rewrites}번 뒤에도 규칙 위반: ${r.errors[0]?.message ?? '알 수 없음'}).`,
      '다시 시도하거나, 칸마다 제목을 직접 써 넣으세요.',
    );
  }
  const slots: PlanSlot[] = r.data.titles.map((t) => ({ title: t.title, pillarId: t.pillar_id, locked: false, origin: 'ai' }));
  // 고정한 칸은 AI 가 다르게 써도 사용자의 것을 지킨다
  for (const { s, i } of locked) if (i < slots.length) slots[i] = s;
  return { plan: savePlan(db, brandId, profile.profileId, slots, r.jobId), calls: r.calls, rewrites: r.rewrites };
}

/**
 * 칸 하나 고치기·고정하기. 사용자가 고친 제목은 허용 출처 4번(사용자 글)이라 근거 규칙은 걸지 않고,
 * 고정 규칙(길이 · 한 줄 · 축)만 다시 건다(바이오 · 카드와 같은 원칙). 고치면 새 판(이력)
 */
export function editSlot(db: Db, brandId: number, idx: number, patch: { title?: string; pillarId?: string; locked?: boolean }): SavedPlan {
  const plan = latestPlan(db, brandId);
  if (!plan) throw new FlowError('아직 계획이 없습니다.', '「계획 만들기」를 먼저 누르세요.');
  const slot = plan.slots[idx];
  if (!slot) throw new FlowError(`${idx + 1}번 칸이 없습니다.`, '화면을 새로고침한 뒤 다시 시도하세요.');
  const next: PlanSlot = { ...slot };
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    const max = titleMax(db, brandId);
    if (!t) throw new FlowError('제목이 비었습니다.', '제목을 쓴 뒤 저장하세요.');
    if (t.includes('\n')) throw new FlowError('제목은 한 줄로 씁니다.', '줄바꿈을 지운 뒤 저장하세요.');
    if ([...t].length > max) throw new FlowError(`제목이 ${[...t].length}자입니다.`, `고정한 템플릿 표지에 들어가게 ${max}자 이내로 줄이세요.`);
    if (t !== slot.title) Object.assign(next, { title: t, origin: 'edit' });
  }
  if (patch.pillarId !== undefined) {
    const ids = activeProfile(db, brandId)?.pillars.map((p) => p.id) ?? [];
    if (!ids.includes(patch.pillarId)) throw new FlowError('프로필에 없는 축입니다.', '목록에 있는 축을 고르세요.');
    next.pillarId = patch.pillarId;
  }
  if (patch.locked !== undefined) next.locked = patch.locked;
  const slots = plan.slots.map((s, i) => (i === idx ? next : s));
  return savePlan(db, brandId, plan.profileId, slots, null);
}

export function savePlan(db: Db, brandId: number, profileId: number, slots: PlanSlot[], jobId: string | null): SavedPlan {
  const id = Number(db.prepare('INSERT INTO series_plans (brand_id, profile_id, slots_json, job_id) VALUES (?, ?, ?, ?)').run(brandId, profileId, JSON.stringify(slots), jobId).lastInsertRowid);
  return latestPlan(db, brandId) ?? { id, profileId, slots, createdAt: '' };
}

export function latestPlan(db: Db, brandId: number): SavedPlan | null {
  const r = db.prepare('SELECT id, profile_id, slots_json, created_at FROM series_plans WHERE brand_id = ? ORDER BY id DESC LIMIT 1').get(brandId) as
    | { id: number; profile_id: number; slots_json: string; created_at: string }
    | undefined;
  return r ? { id: Number(r.id), profileId: Number(r.profile_id), slots: JSON.parse(r.slots_json) as PlanSlot[], createdAt: String(r.created_at) } : null;
}
