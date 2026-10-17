// 카드뉴스 API (FR-MK-1). AI 단계(표지 후보·본문)는 작업 ID 를 먼저 돌려주고 화면이 상태를 묻는다(취소 가능).
// 고른 표지·직접 줄일 초안은 화면이 보낸 내용이 아니라 서버가 기억한 작업 결과에서 꺼낸다
import fs from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import type { AiService } from '../ai/adapter.ts';
import type { JobStore } from '../ai/jobs.ts';
import { env, getSetting } from '../config.ts';
import { FlowError } from '../identity/flow.ts';
import { activeProfile } from '../identity/store.ts';
import { fixedTemplate } from '../templates/store.ts';
import { finishWithEdits, generateBody, type BodyResult } from './body.ts';
import { generateCovers, type CoversResult } from './covers.ts';
import { checkGloss, editGloss, GlossError } from './gloss-check.ts';
import { addSource, getSet, getSource, listSets, rendersDir } from './store.ts';

const BRAND_ID = 1;
const bad = (error: string) => ({ error });

export function cardRoutes(ai: AiService, jobs: JobStore, dataDir = env.dataDir) {
  const db = ai.db;
  const range = () => [getSetting(db, 'cards.bodyMin'), getSetting(db, 'cards.bodyMax')] as const;
  return new Hono()
    .get('/', (c) => {
      const fixed = fixedTemplate(db, BRAND_ID);
      return c.json({
        ready: { profile: activeProfile(db, BRAND_ID) !== null, template: fixed ? { draftId: fixed.draftId, version: fixed.version } : null },
        range: range(),
        sets: listSets(db, BRAND_ID),
      });
    })
    .post(
      '/sources',
      validator('json', (v, c) => {
        const b = z.object({ body: z.string().trim().min(20).max(20_000), title: z.string().trim().max(100).nullable().optional(), memo: z.string().trim().max(2000).nullable().optional() }).safeParse(v);
        return b.success ? b.data : c.json(bad('소재는 20자 이상 2만 자 이하로 붙여 넣으세요.'), 400);
      }),
      (c) => {
        const { body, title, memo } = c.req.valid('json');
        return c.json({ sourceId: addSource(db, BRAND_ID, body, title || null, memo || null) });
      },
    )
    .post(
      '/covers',
      validator('json', (v, c) => {
        const [min, max] = range();
        const b = z.object({ sourceId: z.number().int(), requested: z.number().int().min(min).max(max).nullable() }).safeParse(v);
        return b.success ? b.data : c.json(bad(`본문 카드 수는 비워 두거나 ${min}~${max} 사이로 정하세요.`), 400);
      }),
      (c) => {
        const { sourceId, requested } = c.req.valid('json');
        if (!getSource(db, sourceId)) return c.json(bad('소재를 찾지 못했습니다. 다시 붙여 넣으세요.'), 404);
        return c.json({ jobId: jobs.start('cover_titles', (job) => generateCovers(ai, BRAND_ID, sourceId, requested, job, dataDir)) });
      },
    )
    .post(
      '/body',
      validator('json', (v, c) => {
        const b = z.object({ coverJobId: z.string(), index: z.number().int().min(0) }).safeParse(v);
        return b.success ? b.data : c.json(bad('표지를 다시 골라 주세요.'), 400);
      }),
      (c) => {
        const { coverJobId, index } = c.req.valid('json');
        const job = jobs.get(coverJobId);
        const result = job?.phase === 'done' ? (job.result as CoversResult) : null;
        const chosen = result?.candidates.find((x) => x.index === index);
        if (!result || !chosen) return c.json(bad('표지 후보를 찾지 못했습니다. 서버가 다시 시작됐다면 표지 후보를 다시 만드세요.'), 404);
        const input = {
          sourceId: result.sourceId,
          cover: { headline: chosen.headline, sub: chosen.sub, pillarId: chosen.pillarId, chip: chosen.chip },
          requested: result.requested,
          coverJobId,
        };
        return c.json({ jobId: jobs.start('card_body', (j) => generateBody(ai, BRAND_ID, input, j, dataDir)) });
      },
    )
    // 넘친 칸을 사용자가 직접 줄여 저장 — 초안은 서버가 기억한 본문 작업 결과에서
    .post(
      '/finish',
      validator('json', (v, c) => {
        const Edit = z.object({ where: z.string(), title: z.string().trim().min(1).max(60).optional(), text: z.string().trim().min(1).max(600).optional(), headline: z.string().trim().min(1).max(80).optional(), sub: z.string().trim().max(80).nullable().optional() });
        const b = z.object({ bodyJobId: z.string(), edits: z.array(Edit).min(1).max(20) }).safeParse(v);
        return b.success ? b.data : c.json(bad('고친 글의 형식이 맞지 않습니다. 빈 칸이 없는지 확인하세요.'), 400);
      }),
      async (c) => {
        const { bodyJobId, edits } = c.req.valid('json');
        const job = jobs.get(bodyJobId);
        const result = job?.phase === 'done' ? (job.result as BodyResult) : null;
        if (!result || result.status !== 'needs_edit') return c.json(bad('줄일 초안을 찾지 못했습니다. 서버가 다시 시작됐다면 본문을 다시 만드세요.'), 404);
        try {
          return c.json(await finishWithEdits(ai, BRAND_ID, result.input, result.draft, edits, bodyJobId, dataDir));
        } catch (err) {
          if (err instanceof FlowError) return c.json(bad(`${err.message} ${err.hint}`), 400);
          throw err;
        }
      },
    )
    .get('/sets/:id', (c) => {
      const set = getSet(db, Number(c.req.param('id')));
      if (!set) return c.json(bad('카드 세트를 찾지 못했습니다.'), 404);
      return c.json({ set, source: getSource(db, set.sourceId) });
    })
    .get('/sets/:id/png/:file', (c) => {
      const file = c.req.param('file');
      if (!/^\d{2}-(cover|body|closing)\.png$/.test(file)) return c.json(bad('파일 이름이 맞지 않습니다.'), 400);
      const p = path.join(rendersDir(dataDir, Number(c.req.param('id'))), file);
      if (!fs.existsSync(p)) return c.json(bad('그림을 찾지 못했습니다.'), 404);
      return c.body(fs.readFileSync(p), 200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
    })
    // 표시된 풀이 문장 확인 (결정 2026-10-18): 모두 확인하거나 고치기 전엔 업로드 폴더를 만들 수 없다. 체크는 저장돼 다시 열어도 유지
    .post(
      '/sets/:id/glosses/check',
      validator('json', (v, c) => {
        const b = z.object({ idx: z.number().int().min(0), sentence: z.string().min(1).max(200), checked: z.boolean() }).safeParse(v);
        return b.success ? b.data : c.json(bad('확인할 풀이를 다시 골라 주세요.'), 400);
      }),
      (c) => {
        const { idx, sentence, checked } = c.req.valid('json');
        try {
          return c.json({ glosses: checkGloss(db, Number(c.req.param('id')), idx, sentence, checked) });
        } catch (err) {
          if (err instanceof GlossError) return c.json(bad(err.message), 404);
          throw err;
        }
      },
    )
    // 풀이 문장을 직접 고치기 — 사용자 글이라 근거 규칙은 걸지 않고 같은 틀로 다시 그려 넘침만 본다
    .post(
      '/sets/:id/glosses/edit',
      validator('json', (v, c) => {
        const b = z.object({ idx: z.number().int().min(0), sentence: z.string().min(1).max(200), replacement: z.string().max(300) }).safeParse(v);
        return b.success ? b.data : c.json(bad('고친 문장을 300자 안으로 써 주세요.'), 400);
      }),
      async (c) => {
        const { idx, sentence, replacement } = c.req.valid('json');
        try {
          return c.json(await editGloss(db, dataDir, Number(c.req.param('id')), idx, sentence, replacement));
        } catch (err) {
          if (err instanceof GlossError) return c.json(bad(err.message), 404);
          throw err;
        }
      },
    );
}
