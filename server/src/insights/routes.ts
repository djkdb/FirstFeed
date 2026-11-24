// 성과 분석 API(FR-IN-2~6 · 결정 2026-11-22). Metricool 연결 · 불러오기 · 직접 입력 · 잇기 · 표 · 제안(AI 작업) · 수락/넘기기
import { Hono, type Context } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import type { AiService } from '../ai/adapter.ts';
import type { JobStore } from '../ai/jobs.ts';
import { getSetting } from '../config.ts';
import { FlowError } from '../identity/flow.ts';
import type { SecretStore } from '../secrets/store.ts';
import { Metricool } from './fetch.ts';
import { insightsView } from './service.ts';
import { addManual, assertLatestSuggestion, deleteManual, linkPost, rejectCandidate, updateManual, type ManualInput } from './store.ts';
import { acceptSuggestion, generateSuggestions, rejectSuggestion } from './suggest.ts';

const BRAND_ID = 1;
const bad = (error: string) => ({ error });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** OAuth 로그인 창이 돌아오는 작은 페이지(브라우저 창 하나 — 앱 화면이 아니다) */
export function callbackPage(ok: boolean, message: string, hint = ''): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FirstFeed · Metricool 연결</title>
<style>:root{color-scheme:light dark}body{font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:Canvas;color:CanvasText}
main{max-width:420px;padding:32px 24px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{margin:6px 0;line-height:1.55;opacity:.85}</style></head>
<body><main><h1>${ok ? 'Metricool 연결됐어요' : 'Metricool 을 연결하지 못했어요'}</h1><p>${esc(message)}</p>${hint ? `<p>${esc(hint)}</p>` : ''}</main></body></html>`;
}

const Num = z.number().int().min(0).max(1_000_000_000).nullable();
const Manual = z.object({
  publishedAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), '날짜'),
  type: z.string().max(40).nullable(),
  url: z.string().max(500).nullable(),
  content: z.string().max(3000).nullable(),
  reach: Num,
  saved: Num,
  shares: Num,
  views: Num,
  likes: Num,
  comments: Num,
  /** 넣으면서 바로 이을 세트(직접 입력만) */
  setId: z.number().int().nullable().optional(),
});

function normalizeManual({ setId: _drop, ...m }: z.infer<typeof Manual>): ManualInput {
  return { ...m, publishedAt: new Date(Date.parse(m.publishedAt)).toISOString(), url: m.url?.trim() || null, content: m.content?.trim() || null, type: m.type || null };
}

export function insightsRoutes(ai: AiService, jobs: JobStore, secrets: SecretStore, opts: { fetch?: typeof fetch; now?: () => number } = {}) {
  const db = ai.db;
  const mc = new Metricool({ db, secrets, fetch: opts.fetch, now: opts.now });
  const now = () => (opts.now ?? Date.now)();
  const view = (c: Context) => c.json(insightsView(db, BRAND_ID, now()), 200);
  const act = async (c: Context, fn: () => unknown) => {
    try {
      await fn();
      return view(c);
    } catch (err) {
      if (err instanceof FlowError) return c.json(bad(`${err.message} ${err.hint}`), 400);
      throw err;
    }
  };
  const status = () => ({ ...mc.auth.status(), brandId: getSetting(db, 'insights.metricool.brandId'), scope: 'mcp:read' });
  return (
    new Hono()
      .get('/', (c) => view(c))
      // ---------- Metricool 연결 ----------
      .get('/metricool', (c) => c.json(status()))
      .post('/metricool/connect', async (c) => {
        try {
          // 지금 연결의 시각도 같이 — 화면이 그보다 새 연결이 생길 때까지 기다린다(「다시 연결」을 누르자마자 옛 연결을 보고 「연결했어요」라고 하지 않게)
          const connectedAt = mc.auth.status().connectedAt;
          return c.json({ url: await mc.auth.startConnect(), connectedAt });
        } catch (err) {
          if (err instanceof FlowError) return c.json(bad(`${err.message} ${err.hint}`), 400);
          throw err;
        }
      })
      .get('/metricool/callback', async (c) => {
        const q = c.req.query();
        if (q.error) return c.html(callbackPage(false, `Metricool 이 연결을 거절했어요(${q.error}).`, 'FirstFeed 설정 탭에서 「연결」을 다시 누르세요.'), 400);
        try {
          await mc.auth.finishConnect(q.code, q.state);
          return c.html(callbackPage(true, '이 창을 닫고 FirstFeed 로 돌아가세요.'));
        } catch (err) {
          if (err instanceof FlowError) return c.html(callbackPage(false, err.message, err.hint), 400);
          throw err;
        }
      })
      .delete('/metricool', async (c) => {
        await mc.auth.disconnect();
        return c.json(status());
      })
      .get('/metricool/brands', async (c) => {
        try {
          return c.json({ brands: await mc.brands(), brandId: getSetting(db, 'insights.metricool.brandId') });
        } catch (err) {
          if (err instanceof FlowError) return c.json(bad(`${err.message} ${err.hint}`), 400);
          throw err;
        }
      })
      .put(
        '/metricool/brand',
        validator('json', (v, c) => {
          const b = z.object({ brandId: z.string().max(40).nullable() }).safeParse(v);
          return b.success ? b.data : c.json(bad('브랜드를 다시 골라 주세요.'), 400);
        }),
        (c) => {
          mc.setBrand(c.req.valid('json').brandId);
          return c.json(status());
        },
      )
      .post('/fetch', async (c) => {
        try {
          const r = await mc.fetchPosts(BRAND_ID);
          return c.json({ ...r, view: insightsView(db, BRAND_ID, now()) });
        } catch (err) {
          if (err instanceof FlowError) return c.json(bad(`${err.message} ${err.hint}`), 400);
          throw err;
        }
      })
      // ---------- 직접 입력(Metricool 에 없는 게시물) ----------
      .post(
        '/posts',
        validator('json', (v, c) => {
          const b = Manual.safeParse(v);
          return b.success ? b.data : c.json(bad('게시 날짜와 숫자 칸을 확인해 주세요. 모르는 수치는 비워 두세요(0 이 아니라).'), 400);
        }),
        (c) =>
          act(c, () => {
            const b = c.req.valid('json');
            // 넣기와 잇기를 한 번에 — 잇기가 막히면(이미 다른 게시물과 이은 세트) 넣은 것도 되돌린다(반쯤 된 상태를 남기지 않게)
            const id = addManual(db, BRAND_ID, normalizeManual(b));
            if (b.setId) {
              try {
                linkPost(db, BRAND_ID, id, b.setId);
              } catch (e) {
                deleteManual(db, BRAND_ID, id);
                throw e;
              }
            }
          }),
      )
      .put(
        '/posts/:id',
        validator('json', (v, c) => {
          const b = Manual.safeParse(v);
          return b.success ? b.data : c.json(bad('게시 날짜와 숫자 칸을 확인해 주세요. 모르는 수치는 비워 두세요(0 이 아니라).'), 400);
        }),
        (c) => act(c, () => updateManual(db, BRAND_ID, Number(c.req.param('id')), normalizeManual(c.req.valid('json')))),
      )
      .delete('/posts/:id', (c) => act(c, () => deleteManual(db, BRAND_ID, Number(c.req.param('id')))))
      // ---------- 잇기 ----------
      .put(
        '/posts/:id/link',
        validator('json', (v, c) => {
          const b = z.object({ setId: z.number().int().nullable() }).safeParse(v);
          return b.success ? b.data : c.json(bad('이을 세트를 다시 골라 주세요.'), 400);
        }),
        (c) => act(c, () => linkPost(db, BRAND_ID, Number(c.req.param('id')), c.req.valid('json').setId)),
      )
      .post(
        '/candidates/reject',
        validator('json', (v, c) => {
          const b = z.object({ postId: z.number().int(), setId: z.number().int() }).safeParse(v);
          return b.success ? b.data : c.json(bad('후보를 다시 골라 주세요.'), 400);
        }),
        (c) => act(c, () => rejectCandidate(db, c.req.valid('json').postId, c.req.valid('json').setId)),
      )
      // ---------- 제안(AI) · 수락 ----------
      .post('/suggest', (c) => c.json({ jobId: jobs.start('insight_suggest', (job) => generateSuggestions(ai, BRAND_ID, job)) }))
      // 가장 최근 받기의 제안만 고를 수 있다(지난 묶음은 지난 표로 만든 것이라)
      .post('/suggestions/:id/accept', (c) =>
        act(c, () => {
          const id = Number(c.req.param('id'));
          assertLatestSuggestion(db, BRAND_ID, id);
          return acceptSuggestion(db, BRAND_ID, id, now());
        }),
      )
      .post('/suggestions/:id/reject', (c) =>
        act(c, () => {
          const id = Number(c.req.param('id'));
          assertLatestSuggestion(db, BRAND_ID, id);
          rejectSuggestion(db, BRAND_ID, id);
        }),
      )
  );
}
