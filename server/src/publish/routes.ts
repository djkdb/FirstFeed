// 업로드 준비 API (FR-PB-1 · 결정 2026-10-18). 캡션 생성은 작업 ID 를 먼저 돌려주고 화면이 상태를 묻는다(카드와 같은 방식)
import path from 'node:path';
import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import type { AiService } from '../ai/adapter.ts';
import type { JobStore } from '../ai/jobs.ts';
import { env, getSetting, setSetting } from '../config.ts';
import { FlowError } from '../identity/flow.ts';
import { uncheckedGlosses } from '../cards/gloss-check.ts';
import { getSet } from '../cards/store.ts';
import { checkCaptionGloss, editCaption, generateCaption } from './caption.ts';
import { ExportError, exportSet, openExport, uploadRoot } from './export.ts';
import { PhoneShare } from './phone-share.ts';
import { captionText, getCaption, listExports } from './store.ts';

const BRAND_ID = 1;
const bad = (error: string) => ({ error });

export function publishRoutes(ai: AiService, jobs: JobStore, dataDir = env.dataDir, phone: PhoneShare = new PhoneShare()) {
  const db = ai.db;
  const state = (setId: number) => {
    const set = getSet(db, setId);
    const caption = getCaption(db, setId);
    return {
      caption: caption ? { ...caption, text: captionText(caption) } : null,
      unchecked: (set ? uncheckedGlosses(set).length : 0) + (caption?.glosses.filter((g) => !g.checkedAt).length ?? 0),
      exports: listExports(db, setId),
    };
  };
  return new Hono()
    .get('/settings', (c) => {
      let resolved: string | null;
      try {
        resolved = uploadRoot(db);
      } catch {
        resolved = null; // 위치 설정이 잘못됐으면 화면이 바꾸라고 보인다
      }
      return c.json({ uploadRoot: getSetting(db, 'publish.uploadRoot'), resolved, maxHashtags: getSetting(db, 'publish.maxHashtags') });
    })
    .put(
      '/settings',
      validator('json', (v, c) => {
        const b = z.object({ uploadRoot: z.string().trim().min(1).max(500) }).safeParse(v);
        if (!b.success) return c.json(bad('업로드 폴더 위치를 적어 주세요.'), 400);
        const p = b.data.uploadRoot;
        if (!(p === '~' || p.startsWith('~/') || path.isAbsolute(p))) return c.json(bad('「~/Downloads/FirstFeed」 처럼 홈(~)이나 절대 경로로 적어 주세요.'), 400);
        return b.data;
      }),
      (c) => {
        setSetting(db, 'publish.uploadRoot', c.req.valid('json').uploadRoot);
        return c.json({ ok: true as const, resolved: uploadRoot(db) });
      },
    )
    .get('/sets/:id', (c) => c.json(state(Number(c.req.param('id')))))
    .post('/sets/:id/caption', (c) => {
      const setId = Number(c.req.param('id'));
      if (!getSet(db, setId)) return c.json(bad('카드 세트를 찾지 못했습니다.'), 404);
      return c.json({ jobId: jobs.start('caption_min', (j) => generateCaption(ai, BRAND_ID, setId, j, dataDir)) });
    })
    // 캡션 직접 고치기 — 사용자 글이라 해시태그 정리(모양·개수)만
    .put(
      '/sets/:id/caption',
      validator('json', (v, c) => {
        const b = z.object({ hook: z.string().trim().min(1).max(120), lines: z.array(z.string().max(300)).max(10), hashtags: z.array(z.string().max(60)).max(40) }).safeParse(v);
        return b.success ? b.data : c.json(bad('캡션 첫 줄을 비우지 말고, 줄은 10개 안으로 써 주세요.'), 400);
      }),
      (c) => {
        const setId = Number(c.req.param('id'));
        if (!getCaption(db, setId)) return c.json(bad('먼저 캡션을 만들어 주세요.'), 404);
        const { cut } = editCaption(db, setId, c.req.valid('json'));
        return c.json({ ...state(setId), cutHashtags: cut });
      },
    )
    .post(
      '/sets/:id/caption/glosses/check',
      validator('json', (v, c) => {
        const b = z.object({ sentence: z.string().min(1).max(200), checked: z.boolean() }).safeParse(v);
        return b.success ? b.data : c.json(bad('확인할 풀이를 다시 골라 주세요.'), 400);
      }),
      (c) => {
        const setId = Number(c.req.param('id'));
        const { sentence, checked } = c.req.valid('json');
        if (!checkCaptionGloss(db, setId, sentence, checked)) return c.json(bad('그 풀이 표시를 찾지 못했습니다. 화면을 새로고침하세요.'), 404);
        return c.json(state(setId));
      },
    )
    .post('/sets/:id/export', (c) => {
      const setId = Number(c.req.param('id'));
      try {
        return c.json({ ...exportSet(db, dataDir, setId), ...state(setId) });
      } catch (err) {
        if (err instanceof ExportError || err instanceof FlowError) return c.json(bad(err.message), 400);
        throw err;
      }
    })
    // 폰으로 받기(FR-PB-5) — 이 API 자체는 127.0.0.1 에서만(localOnly). 같은 네트워크에 여는 것은 phone-share.ts 의 따로 켠 작은 서버뿐
    .post('/exports/:id/phone', async (c) => {
      try {
        return c.json({ share: await phone.start(db, Number(c.req.param('id'))) });
      } catch (err) {
        if (err instanceof ExportError) return c.json(bad(err.message), 400);
        throw err;
      }
    })
    .get('/phone', (c) => c.json({ share: phone.info() }))
    .delete('/phone', (c) => {
      phone.stop();
      return c.json({ share: null });
    })
    .post('/exports/:id/open', (c) => {
      try {
        openExport(db, Number(c.req.param('id')));
        return c.json({ ok: true as const });
      } catch (err) {
        if (err instanceof ExportError) return c.json(bad(err.message), 400);
        throw err;
      }
    });
}
