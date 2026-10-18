// 발표용 「미리 만든 결과」 표시 (결정 2026-10-18 · 리허설·발표): 기준 시각 이전에 만든 프로필·브랜딩 키트·카드 세트에 화면이 배지를 붙인다.
// 실시간처럼 보이게 하지 않으려고. 기준 시각은 설정(DB) 하나 — 켜면 「지금」, 끄면 null
import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import { getSetting, setSetting } from '../config.ts';
import type { Db } from '../db/index.ts';

export function demoRoutes(db: Db) {
  return new Hono()
    .get('/', (c) => c.json({ premadeBefore: getSetting(db, 'demo.premadeBefore') }))
    .put(
      '/',
      validator('json', (v, c) => {
        const b = z.object({ on: z.boolean() }).safeParse(v);
        return b.success ? b.data : c.json({ error: '켜기·끄기만 할 수 있어요.' }, 400);
      }),
      (c) => {
        setSetting(db, 'demo.premadeBefore', c.req.valid('json').on ? new Date().toISOString() : null);
        return c.json({ premadeBefore: getSetting(db, 'demo.premadeBefore') });
      },
    );
}
