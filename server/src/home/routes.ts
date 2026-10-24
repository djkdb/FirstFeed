// 「오늘 올릴 것」 홈 API (FR-HM-1~3 · 결정 2026-10-24). AI 없음
import { Hono, type Context } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import type { Db } from '../db/index.ts';
import { FlowError } from '../identity/flow.ts';
import { delayDay, homeView, linkSet, markPosted, setCadence, unmarkPosted } from './store.ts';

const BRAND_ID = 1;
const bad = (error: string) => ({ error });

/** 바꾸는 요청은 모두 같은 모양: 하고 나서 홈 화면 값을 다시 돌려준다. 할 수 없으면 이유와 할 일 */
function act(c: Context, db: Db, fn: () => void) {
  try {
    fn();
    return c.json(homeView(db, BRAND_ID), 200);
  } catch (err) {
    if (err instanceof FlowError) return c.json(bad(`${err.message} ${err.hint}`), 400);
    throw err;
  }
}

export function homeRoutes(db: Db) {
  const idx = (c: Context) => Number(c.req.param('idx'));
  return new Hono()
    .get('/', (c) => c.json(homeView(db, BRAND_ID)))
    .put(
      '/settings',
      validator('json', (v, c) => {
        const b = z.object({ cadence: z.string() }).safeParse(v);
        return b.success ? b.data : c.json(bad('올리는 간격을 다시 골라 주세요.'), 400);
      }),
      (c) => act(c, db, () => setCadence(db, c.req.valid('json').cadence)),
    )
    .put(
      '/slots/:idx/set',
      validator('json', (v, c) => {
        const b = z.object({ setId: z.number().int().nullable() }).safeParse(v);
        return b.success ? b.data : c.json(bad('이을 세트를 다시 골라 주세요.'), 400);
      }),
      (c) => act(c, db, () => linkSet(db, BRAND_ID, idx(c), c.req.valid('json').setId)),
    )
    .post(
      '/slots/:idx/posted',
      validator('json', (v, c) => {
        const b = z.object({ date: z.string().optional() }).safeParse(v ?? {});
        return b.success ? b.data : c.json(bad('날짜를 다시 확인해 주세요.'), 400);
      }),
      (c) => act(c, db, () => markPosted(db, BRAND_ID, idx(c), c.req.valid('json').date)),
    )
    .delete('/slots/:idx/posted', (c) => act(c, db, () => unmarkPosted(db, BRAND_ID, idx(c))))
    .post('/slots/:idx/delay', (c) => act(c, db, () => delayDay(db, BRAND_ID, idx(c))));
}
