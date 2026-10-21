// 30일 뒤 내 계정 미리보기 API (FR-BR-6 · 결정 2026-10-21). 한 화면을 인스타 프로필처럼:
// 프로필 사진 · 아이디 · 이름 · 바이오 · 하이라이트 자리 · 게시물 수 · 3×3 격자(만든 표지 먼저, 나머지는 시리즈 계획 칸).
// 만든 칸과 계획 칸을 화면이 구분할 수 있게 칸마다 종류를 붙인다 — 계획을 실제로 만든 것처럼 보이게 하지 않는다
import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import type { AiService } from '../ai/adapter.ts';
import type { JobStore } from '../ai/jobs.ts';
import { getSetting } from '../config.ts';
import { currentSelection, latestKit } from '../brand/store.ts';
import type { VisualCandidates } from '../brand/types.ts';
import { listSets } from '../cards/store.ts';
import { FlowError } from '../identity/flow.ts';
import { activeProfile } from '../identity/store.ts';
import { FRAME_SIZE } from '../templates/types.ts';
import { fixedTemplate } from '../templates/store.ts';
import { editSlot, generatePlan, latestPlan, type PlanSlot } from './plan.ts';

const BRAND_ID = 1;
const bad = (error: string) => ({ error });

export type GridCell =
  | { kind: 'made'; setId: number; headline: string; createdAt: string }
  | { kind: 'plan'; slot: number; title: string; pillarId: string; pillarName: string | null; locked: boolean; origin: PlanSlot['origin'] }
  | { kind: 'empty' };

/** 격자 칸: 만든 세트(최신순)를 먼저, 남은 칸은 계획을 차례로, 그래도 남으면 빈칸 */
export function composeGrid(
  made: Array<{ id: number; cover: string; createdAt: string }>,
  plan: PlanSlot[],
  pillarNames: Map<string, string>,
  cells: number,
): GridCell[] {
  const out: GridCell[] = made.slice(0, cells).map((s) => ({ kind: 'made', setId: s.id, headline: s.cover, createdAt: s.createdAt }));
  for (const [slot, p] of plan.entries()) {
    if (out.length >= cells) break;
    out.push({ kind: 'plan', slot, title: p.title, pillarId: p.pillarId, pillarName: pillarNames.get(p.pillarId) ?? null, locked: p.locked, origin: p.origin });
  }
  while (out.length < cells) out.push({ kind: 'empty' });
  return out;
}

export function previewRoutes(ai: AiService, jobs: JobStore) {
  const db = ai.db;
  return new Hono()
    .get('/', (c) => {
      const profile = activeProfile(db, BRAND_ID);
      const sel = currentSelection(db, BRAND_ID);
      const visual = latestKit<VisualCandidates>(db, BRAND_ID, 'visual');
      const fixed = fixedTemplate(db, BRAND_ID);
      const plan = latestPlan(db, BRAND_ID);
      const made = listSets(db, BRAND_ID);
      const cellsN = getSetting(db, 'preview.gridCells');
      const names = new Map((profile?.pillars ?? []).map((p) => [p.id, p.name]));
      const cells = composeGrid(made, plan?.slots ?? [], names, cellsN);
      return c.json({
        ready: { profile: profile !== null, template: fixed !== null },
        profile: {
          accountLine: profile?.accountLine ?? null,
          handle: sel.handle,
          displayName: sel.displayName,
          bio: sel.bio,
          profileImage: sel.profileImage,
        },
        highlights: (visual?.candidates.imagePrompts ?? []).filter((p) => p.target === 'highlight').map((p) => p.label),
        look: fixed?.look.palette ?? sel.palette?.colors ?? null,
        titleFont: fixed?.look.titleFont ?? sel.titleFont,
        /** 격자에서 가려지는 영역(결정 2026-10-18 확인값) — 카드 크기와 함께 넘겨 화면이 같은 비율로 자른다 */
        grid: { card: { width: FRAME_SIZE.cover.width, height: FRAME_SIZE.cover.height }, safe: getSetting(db, 'render.safeArea').feed },
        cells,
        counts: { made: made.length, madeShown: cells.filter((x) => x.kind === 'made').length, plan: cells.filter((x) => x.kind === 'plan').length },
        plan: plan ? { id: plan.id, createdAt: plan.createdAt, stale: profile !== null && plan.profileId !== profile.id, slots: plan.slots } : null,
        pillars: (profile?.pillars ?? []).map((p) => ({ id: p.id, name: p.name })),
        premadeBefore: getSetting(db, 'demo.premadeBefore'),
      });
    })
    .post('/plan', (c) => c.json({ jobId: jobs.start('series_plan', (job) => generatePlan(ai, BRAND_ID, job)) }))
    .put(
      '/plan/:idx',
      validator('json', (v, c) => {
        const b = z.object({ title: z.string().max(80).optional(), pillarId: z.string().optional(), locked: z.boolean().optional() }).safeParse(v);
        return b.success ? b.data : c.json(bad('바꿀 내용을 다시 확인해 주세요.'), 400);
      }),
      (c) => {
        try {
          return c.json({ plan: editSlot(db, BRAND_ID, Number(c.req.param('idx')), c.req.valid('json')) });
        } catch (err) {
          if (err instanceof FlowError) return c.json(bad(`${err.message} ${err.hint}`), 400);
          throw err;
        }
      },
    );
}
