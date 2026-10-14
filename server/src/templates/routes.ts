// 템플릿 API (FR-TP-1·3). 시안 3개를 지금 브랜드(키트 선택)로 그려 보여 주고, 하나를 고정한다
import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import { env } from '../config.ts';
import type { Db } from '../db/index.ts';
import { RenderError } from '../render/browser.ts';
import { measureBudget } from './budget.ts';
import { DRAFTS, draftById } from './index.ts';
import { lookFromSelection, resolveLook } from './look.ts';
import { renderFrame } from './render-frame.ts';
import { SAMPLE_CONTENT } from './sample.ts';
import { fixedTemplate, fixTemplate, getTemplateVersion, listTemplateVersions } from './store.ts';
import type { BrandLook, Draft } from './types.ts';

const BRAND_ID = 1;
const DraftBody = z.object({ draftId: z.enum(['A', 'B', 'C']) });

async function previewFrames(db: Db, draft: Draft, look: BrandLook, dataDir: string) {
  const resolved = resolveLook(look, dataDir);
  const frames = [];
  for (const c of SAMPLE_CONTENT) {
    const r = await renderFrame(db, draft, resolved, c);
    frames.push({
      kind: c.kind,
      ok: r.ok,
      png: r.png ? `data:image/png;base64,${r.png.toString('base64')}` : null,
      problems: r.problems.map((p) => p.message),
      shorten: r.shorten.map((s) => s.message),
      scale: r.scale,
      browser: `${r.browser.kind} ${r.browser.version}`,
      reference: r.browser.reference,
    });
  }
  return frames;
}

const renderFail = (err: unknown) => (err instanceof RenderError ? { error: `${err.message} ${err.hint}` } : null);

export function templateRoutes(db: Db, dataDir = env.dataDir) {
  return new Hono()
    .get('/', (c) => {
      const { missing } = lookFromSelection(db, BRAND_ID);
      const fixed = fixedTemplate(db, BRAND_ID);
      return c.json({
        drafts: DRAFTS.map((d) => ({ id: d.id, name: d.name, description: d.description })),
        missing,
        fixed: fixed ? { id: fixed.id, version: fixed.version, draftId: fixed.draftId, budget: fixed.budget, browser: fixed.browser, createdAt: fixed.createdAt } : null,
        versions: listTemplateVersions(db, BRAND_ID).map((v) => ({ id: v.id, version: v.version, draftId: v.draftId, createdAt: v.createdAt, palette: v.look.palette.name ?? null })),
      });
    })
    // 시안 하나를 지금 브랜드로 그린다 (네 틀, 예시 원고)
    .post(
      '/preview',
      validator('json', (v, c) => {
        const b = DraftBody.safeParse(v);
        return b.success ? b.data : c.json({ error: '시안을 다시 골라 주세요.' }, 400);
      }),
      async (c) => {
        const { look, missing } = lookFromSelection(db, BRAND_ID);
        if (!look) return c.json({ error: `브랜드 탭에서 ${missing.join('·')}을(를) 먼저 고르세요.` }, 400);
        try {
          return c.json({ frames: await previewFrames(db, draftById(c.req.valid('json').draftId)!, look, dataDir) });
        } catch (err) {
          const f = renderFail(err);
          if (f) return c.json(f, 500);
          throw err;
        }
      },
    )
    // 고정: 지금 브랜드 모양 + 칸별 글자 수를 잰 새 판, 바로 고정
    .post(
      '/fix',
      validator('json', (v, c) => {
        const b = DraftBody.safeParse(v);
        return b.success ? b.data : c.json({ error: '시안을 다시 골라 주세요.' }, 400);
      }),
      async (c) => {
        const { look, missing, selectionId } = lookFromSelection(db, BRAND_ID);
        if (!look) return c.json({ error: `브랜드 탭에서 ${missing.join('·')}을(를) 먼저 고르세요.` }, 400);
        const draft = draftById(c.req.valid('json').draftId)!;
        try {
          const { budget, browser } = await measureBudget(db, draft, resolveLook(look, dataDir));
          const id = fixTemplate(db, BRAND_ID, draft.id, look, budget, `${browser.kind} ${browser.version}`, selectionId);
          return c.json({ id, version: getTemplateVersion(db, id)!.version, budget });
        } catch (err) {
          const f = renderFail(err);
          if (f) return c.json(f, 500);
          throw err;
        }
      },
    )
    // 고정한(또는 옛) 판으로 다시 그리기 — 판에 남은 모양 그대로(키트를 바꿨어도)
    .post('/versions/:id/preview', async (c) => {
      const v = getTemplateVersion(db, Number(c.req.param('id')));
      if (!v) return c.json({ error: '템플릿 판을 찾지 못했습니다.' }, 404);
      try {
        return c.json({ frames: await previewFrames(db, draftById(v.draftId)!, v.look, dataDir) });
      } catch (err) {
        const f = renderFail(err);
        if (f) return c.json(f, 500);
        throw err;
      }
    });
}
