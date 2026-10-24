// 30일 뒤 내 계정 미리보기 API (FR-BR-6 · 결정 2026-10-21). 한 화면을 인스타 프로필처럼:
// 프로필 사진 · 아이디 · 이름 · 바이오 · 하이라이트 자리 · 게시물 수 · 3×3 격자(만든 표지 먼저, 나머지는 시리즈 계획 칸).
// 만든 칸과 계획 칸을 화면이 구분할 수 있게 칸마다 종류를 붙인다 — 계획을 실제로 만든 것처럼 보이게 하지 않는다
import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import type { AiService } from '../ai/adapter.ts';
import type { JobStore } from '../ai/jobs.ts';
import { env, getSetting } from '../config.ts';
import { currentSelection, latestKit } from '../brand/store.ts';
import type { VisualCandidates } from '../brand/types.ts';
import { fontById } from '../brand/fonts.ts';
import { listSets } from '../cards/store.ts';
import { FlowError } from '../identity/flow.ts';
import { activeProfile } from '../identity/store.ts';
import { FRAME_SIZE } from '../templates/types.ts';
import { fixedTemplate } from '../templates/store.ts';
import { editSlot, generatePlan, latestPlan } from './plan.ts';
import { composeGrid } from './compose-grid.ts';
import { PLAN_FILE, planCover, previewDir } from './covers.ts';
import { shareImage } from './share-image.ts';
import { RenderError } from '../render/browser.ts';
import fs from 'node:fs';
import path from 'node:path';

const BRAND_ID = 1;
const bad = (error: string) => ({ error });

// 격자 구성은 공유 이미지(share-image.ts)도 같이 쓴다 — 서로 가져오는 고리를 피하려고 따로 둔 파일에서
export { composeGrid, type GridCell } from './compose-grid.ts';

export function previewRoutes(ai: AiService, jobs: JobStore, dataDir = env.dataDir) {
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
        /** 계획 칸 자리표시를 고정 템플릿의 제목 글꼴로 그리려고 */
        titleFont: (() => {
          const f = fontById(fixed?.look.titleFont ?? sel.titleFont ?? '');
          return f ? { family: f.family, weight: f.weights.at(-1) ?? 700 } : null;
        })(),
        /** 격자에서 가려지는 영역(결정 2026-10-18 확인값) — 카드 크기와 함께 넘겨 화면이 같은 비율로 자른다 */
        grid: { card: { width: FRAME_SIZE.cover.width, height: FRAME_SIZE.cover.height }, safe: getSetting(db, 'render.safeArea').feed },
        cells,
        counts: { made: made.length, madeShown: cells.filter((x) => x.kind === 'made').length, plan: cells.filter((x) => x.kind === 'plan').length },
        plan: plan ? { id: plan.id, createdAt: plan.createdAt, stale: profile !== null && plan.profileId !== profile.id, slots: plan.slots } : null,
        pillars: (profile?.pillars ?? []).map((p) => ({ id: p.id, name: p.name })),
        premadeBefore: getSetting(db, 'demo.premadeBefore'),
      });
    })
    // 계획 칸을 고정 템플릿 표지로(넘치면 이유) — 칸마다 따로 물어 그 칸만 그린다. 같은 제목·축·판이면 그린 것을 다시 쓴다
    .get('/plan/:idx/cover', async (c) => c.json(await planCover(db, dataDir, BRAND_ID, Number(c.req.param('idx')))))
    .get('/png/:file', (c) => {
      const file = c.req.param('file');
      if (!PLAN_FILE.test(file)) return c.json(bad('파일 이름이 맞지 않습니다.'), 400);
      const p = path.join(previewDir(dataDir), file);
      if (!fs.existsSync(p)) return c.json(bad('그림을 찾지 못했습니다.'), 404);
      return c.body(fs.readFileSync(p), 200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
    })
    // 공유 이미지(FR-BR-7): 스토리 크기 PNG. 계획 칸 배지는 그대로(결정 2026-10-24). 글이 넘치면 PNG 없이 이유
    .get('/share.png', async (c) => {
      try {
        const r = await shareImage(db, dataDir, BRAND_ID);
        if (!r.ok) return c.json(bad(`공유 이미지를 만들지 못했어요: ${r.reason} 「브랜드」에서 그 글(아이디 · 이름 · 바이오)을 줄인 뒤 다시 시도하세요.`), 400);
        return c.body(new Uint8Array(r.png), 200, {
          'content-type': 'image/png',
          'cache-control': 'no-store',
          'content-disposition': `attachment; filename="firstfeed-30days.png"; filename*=UTF-8''${encodeURIComponent('퍼스트피드-30일-미리보기.png')}`,
        });
      } catch (err) {
        if (err instanceof RenderError) return c.json(bad(`${err.message} ${err.hint}`), 400);
        throw err;
      }
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
