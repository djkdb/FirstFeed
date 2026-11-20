// 티스토리 · 리틀리 브라우저 발행 API (사용자 결정 2026-11-20). 작업 ID 를 먼저 돌려주고 화면이 단계를 묻는다
import type { BrowserContext } from 'playwright';
import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import { env, getSetting, setSetting } from '../../config.ts';
import type { Db } from '../../db/index.ts';
import { currentSelection } from '../../brand/store.ts';
import { uncheckedGlosses } from '../../cards/gloss-check.ts';
import { getSet, rendersDir } from '../../cards/store.ts';
import { getCaption } from '../store.ts';
import { BlogJobs } from './jobs.ts';
import { buildLitly, fillLitly } from './litly.ts';
import { buildPost, tistoryName } from './post.ts';
import { openContext } from './session.ts';
import { addBlogPost, postsForSet, recentPosts } from './store.ts';
import { publishTistory } from './tistory.ts';

const BRAND_ID = 1;
const bad = (error: string) => ({ error });

export function blogRoutes(db: Db, dataDir = env.dataDir, jobs = new BlogJobs(), hooks: { tistoryTarget?: Partial<Parameters<typeof publishTistory>[2]> } = {}) {
  // 리틀리 창은 사용자가 저장할 때까지 열어 둔다 — 다음 작업을 시작하면 닫는다
  let open: BrowserContext | null = null;
  const fresh = async (site: string) => {
    await open?.close().catch(() => {});
    open = await openContext(db, dataDir, site);
    return open;
  };
  const settings = () => ({ tistory: getSetting(db, 'blog.tistory.name'), visibility: getSetting(db, 'blog.tistory.visibility'), litlyUrl: getSetting(db, 'blog.litly.adminUrl') });
  return new Hono()
    .get('/settings', (c) => c.json(settings()))
    .put(
      '/settings',
      validator('json', (v, c) => {
        const b = z.object({ tistory: z.string().max(200).nullable().optional(), visibility: z.enum(['public', 'private']).optional() }).safeParse(v);
        return b.success ? b.data : c.json(bad('설정을 다시 확인해 주세요.'), 400);
      }),
      (c) => {
        const b = c.req.valid('json');
        if (b.tistory !== undefined) {
          const name = b.tistory ? tistoryName(b.tistory) : null;
          if (b.tistory && !name) return c.json(bad('블로그 이름은 「이름.tistory.com」 의 이름(영문 소문자 · 숫자 · 붙임표)이에요. 블로그 주소를 붙여 넣어도 돼요.'), 400);
          setSetting(db, 'blog.tistory.name', name);
        }
        if (b.visibility) setSetting(db, 'blog.tistory.visibility', b.visibility);
        return c.json(settings());
      },
    )
    .get('/sets/:id', (c) => c.json({ posts: postsForSet(db, 'tistory', Number(c.req.param('id'))) }))
    .post(
      '/sets/:id/tistory',
      validator('json', (v, c) => {
        const b = z.object({ again: z.boolean().optional() }).safeParse(v ?? {});
        return b.success ? b.data : c.json(bad('요청을 다시 보내 주세요.'), 400);
      }),
      (c) => {
        const setId = Number(c.req.param('id'));
        const set = getSet(db, setId);
        if (!set) return c.json(bad('카드 세트를 찾지 못했습니다.'), 404);
        const blog = getSetting(db, 'blog.tistory.name');
        if (!blog) return c.json(bad('티스토리 블로그 이름을 먼저 넣어 주세요.'), 400);
        const caption = getCaption(db, setId);
        // 업로드 폴더와 같은 원칙(결정 2026-10-18): 표시된 풀이를 모두 확인하기 전엔 밖으로 내보내지 않는다
        const unchecked = uncheckedGlosses(set).length + (caption?.glosses.filter((g) => !g.checkedAt).length ?? 0);
        if (unchecked) return c.json(bad(`확인하지 않은 소재 밖 설명이 ${unchecked}곳 있어요. 「확인했어요」를 누르거나 고친 뒤 발행하세요.`), 400);
        if (postsForSet(db, 'tistory', setId).length && !c.req.valid('json').again) return c.json(bad('이 세트는 이미 티스토리에 올렸어요. 한 번 더 올리려면 「한 번 더 올리기」를 누르세요.'), 409);
        const post = buildPost(set.cards, caption, rendersDir(dataDir, setId), getSetting(db, 'blog.tistory.maxTags'));
        const visibility = getSetting(db, 'blog.tistory.visibility');
        try {
          const jobId = jobs.start('tistory', async (step, signal) => {
            step('브라우저 창을 여는 중');
            const ctx = await fresh('tistory');
            try {
              const r = await publishTistory(ctx, post, { blog, visibility, loginWaitMinutes: getSetting(db, 'blog.loginWaitMinutes'), ...hooks.tistoryTarget }, step, signal);
              addBlogPost(db, BRAND_ID, { site: 'tistory', setId, title: post.title, url: r.url, visibility });
              step(r.url ? `글 주소: ${r.url}` : visibility === 'private' ? '비공개 글이라 주소는 블로그 관리에서 확인하세요' : '글 주소는 아직 못 찾았어요(블로그 글 목록에서 확인하세요)');
              return { url: r.url, title: post.title, visibility };
            } finally {
              await ctx.close().catch(() => {});
              if (open === ctx) open = null;
            }
          });
          return c.json({ jobId });
        } catch (e) {
          return c.json(bad((e as Error).message), 409);
        }
      },
    )
    .post('/litly', (c) => {
      const sel = currentSelection(db, BRAND_ID);
      const items = buildLitly(sel, getSetting(db, 'blog.tistory.name'), recentPosts(db, BRAND_ID, 'tistory', 3));
      if (!items.length) return c.json(bad('넣을 것이 없어요. 브랜드 탭에서 이름 · 아이디 · 바이오를 먼저 고르세요.'), 400);
      try {
        const jobId = jobs.start('litly', async (step, signal) => {
          step('브라우저 창을 여는 중');
          const ctx = await fresh('litly');
          const r = await fillLitly(ctx, items, getSetting(db, 'blog.litly.adminUrl'), getSetting(db, 'blog.loginWaitMinutes'), step, signal);
          return { ...r, items: items.length };
        });
        return c.json({ jobId, items });
      } catch (e) {
        return c.json(bad((e as Error).message), 409);
      }
    })
    .get('/jobs/:id', (c) => {
      const j = jobs.get(c.req.param('id'));
      return j ? c.json(j) : c.json(bad('작업을 찾지 못했어요. 서버를 다시 켰다면 처음부터 다시 하세요.'), 404);
    })
    .post('/jobs/:id/cancel', async (c) => {
      jobs.cancel(c.req.param('id'));
      await open?.close().catch(() => {});
      open = null;
      return c.json({ ok: true });
    });
}
