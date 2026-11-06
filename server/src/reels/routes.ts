// 릴스 편집 API (결정 2026-11-06 · 편집 화면 녹이기). 편집 내용 저장 · 올리기 · 미디어 · 글꼴 · 영상 뽑기 · 받아쓰기(선택)
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { Hono, type Context } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import { env, getSetting } from '../config.ts';
import type { Db } from '../db/index.ts';
import { FONTS } from '../brand/fonts.ts';
import { FONT_ORIGIN, fontFaceCss, fontFileFor } from '../render/fonts-css.ts';
import { fontIdOf, type ReelDoc } from './model.ts';
import { MediaError, mediaPath, saveMedia } from './media.ts';
import { cancelRender, remotionBrowser, renderJob, renderPath, startRender, type Quality } from './render.ts';
import { createReel, deleteReel, getReel, listReels, reelBrand, saveReel } from './store.ts';
import { hasWhisper, transcribe } from './transcribe.ts';

const BRAND_ID = 1;
const bad = (error: string, hint?: string) => ({ error, hint: hint ?? null });

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', flac: 'audio/flac', woff2: 'font/woff2',
};

/**
 * 파일 스트림 → 웹 스트림. Node 스트림을 Response 에 그대로 넘기면, 영상 재생기가 요청을 중간에 끊을 때
 * 「ReadableStream is already closed」 가 잡을 수 없는 곳에서 던져져 서버 전체가 꺼졌다(편집 화면 확인 2026-11-06).
 * Readable.toWeb 은 끊기면 파일 스트림을 닫는다
 */
const webStream = (full: string, opts?: { start: number; end: number }) => Readable.toWeb(fs.createReadStream(full, opts)) as ReadableStream;

/** 파일 내주기 — 영상 앞뒤로 옮겨 보기(Range)를 받는다 */
function sendFile(c: Context, full: string): Response {
  const size = fs.statSync(full).size;
  const type = MIME[full.split('.').pop() ?? ''] ?? 'application/octet-stream';
  const range = /^bytes=(\d*)-(\d*)$/.exec(c.req.header('range') ?? '');
  const headers: Record<string, string> = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'no-store' };
  if (!range) {
    return new Response(webStream(full), { status: 200, headers: { ...headers, 'content-length': String(size) } });
  }
  let start = range[1] ? Number(range[1]) : size - Number(range[2]);
  let end = range[1] && range[2] ? Number(range[2]) : size - 1;
  if (!range[1]) end = size - 1;
  start = Math.max(0, start);
  end = Math.min(size - 1, end);
  if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
  return new Response(webStream(full, { start, end }), { status: 206, headers: { ...headers, 'content-length': String(end - start + 1), 'content-range': `bytes ${start}-${end}/${size}` } });
}

/** 편집 내용 모양 확인 — 깊은 검사는 하지 않고 칸이 있는지만(화면이 만든 것이라) */
const DocShape = z
  .object({
    version: z.literal(1),
    name: z.string().max(80),
    bg: z.object({ kind: z.string() }).passthrough(),
    scenes: z.array(z.object({ id: z.string(), start: z.number(), duration: z.number() }).passthrough()).max(500),
    texts: z.array(z.object({ id: z.string(), start: z.number(), duration: z.number(), text: z.string().max(2000) }).passthrough()).max(2000),
    overlays: z.array(z.object({ id: z.string() }).passthrough()).max(500),
    audio: z.array(z.object({ id: z.string() }).passthrough()).max(200),
    assets: z.array(z.object({ file: z.string() }).passthrough()).max(1000),
    memo: z.string().max(20_000),
    original: z.record(z.string(), z.object({ text: z.string(), color: z.string() })),
  })
  .passthrough();

export function reelRoutes(db: Db, dataDir = env.dataDir) {
  const id = (c: Context) => Number(c.req.param('id'));
  const guide = () => getSetting(db, 'render.safeArea').reel;
  return new Hono()
    .get('/', async (c) =>
      c.json({ reels: listReels(db, BRAND_ID), brand: reelBrand(db, BRAND_ID), guide: guide(), fonts: FONTS.map((f) => ({ id: f.id, name: f.name })), whisper: await hasWhisper(), browser: remotionBrowser() !== null }),
    )
    .post(
      '/',
      validator('json', (v, c) => {
        const b = z.object({ name: z.string().trim().max(60) }).safeParse(v);
        return b.success ? b.data : c.json(bad('이름은 60자 이하로 정하세요.'), 400);
      }),
      (c) => {
        const r = createReel(db, BRAND_ID, c.req.valid('json').name || '새 릴스');
        return c.json({ id: r.id, name: r.name, doc: r.doc, updatedAt: r.updatedAt });
      },
    )
    .get('/fonts.css', (c) => {
      // 영상 · 편집 화면이 쓰는 @font-face — 주소는 이 서버의 /api/reels/font-files/ (상대 주소라 화면 · 영상 뽑기 모두 같은 서버로 간다)
      const ids = (c.req.query('ids') ?? '').split(',').filter((x) => FONTS.some((f) => f.id === x));
      const css = fontFaceCss(ids.length ? ids : ['pretendard']).replaceAll(`${FONT_ORIGIN}/files/`, '/api/reels/font-files/');
      return c.body(css, 200, { 'content-type': 'text/css; charset=utf-8', 'access-control-allow-origin': '*' });
    })
    .get('/font-files/*', (c) => {
      const rel = c.req.path.replace(/^.*\/font-files\//, '');
      const full = fontFileFor(`${FONT_ORIGIN}/files/${rel}`);
      if (!full) return c.json(bad('글꼴 파일을 찾지 못했어요.'), 404);
      const res = sendFile(c, full);
      res.headers.set('access-control-allow-origin', '*');
      return res;
    })
    .get('/jobs/:jobId', (c) => {
      const j = renderJob(c.req.param('jobId'));
      return j ? c.json(j) : c.json(bad('작업을 찾지 못했어요.', '서버가 다시 켜졌다면 다시 뽑아 주세요.'), 404);
    })
    .post('/jobs/:jobId/cancel', (c) => (cancelRender(c.req.param('jobId')), c.json({ ok: true })))
    .get('/:id', (c) => {
      const r = getReel(db, BRAND_ID, id(c));
      return r ? c.json({ id: r.id, name: r.name, doc: r.doc, updatedAt: r.updatedAt }) : c.json(bad('릴스를 찾지 못했어요.'), 404);
    })
    .put(
      '/:id',
      validator('json', (v, c) => {
        const b = z.object({ doc: DocShape }).safeParse(v);
        return b.success ? b.data : c.json(bad('편집 내용 모양이 맞지 않아요.', '화면을 새로고침한 뒤 다시 고쳐 주세요.'), 400);
      }),
      (c) => {
        const at = saveReel(db, BRAND_ID, id(c), c.req.valid('json').doc as unknown as ReelDoc);
        return at ? c.json({ updatedAt: at }) : c.json(bad('릴스를 찾지 못했어요.'), 404);
      },
    )
    .delete('/:id', (c) => c.json({ ok: deleteReel(db, BRAND_ID, id(c), dataDir) }))
    .post('/:id/media', async (c) => {
      const r = getReel(db, BRAND_ID, id(c));
      if (!r) return c.json(bad('릴스를 찾지 못했어요.'), 404);
      try {
        const asset = saveMedia(dataDir, r.id, new Uint8Array(await c.req.arrayBuffer()), decodeURIComponent(c.req.header('x-filename') ?? ''), getSetting(db, 'reels.maxUploadBytes'));
        // 올린 목록은 바로 기록 — 화면이 저장하기 전에 닫혀도 파일을 잃지 않게
        saveReel(db, BRAND_ID, r.id, { ...r.doc, assets: [...r.doc.assets, asset] });
        return c.json(asset);
      } catch (e) {
        if (e instanceof MediaError) return c.json(bad(e.message, e.hint), 400);
        throw e;
      }
    })
    .delete('/:id/media/:file', (c) => {
      // 「원본 지우기」(0-16) — 그 파일을 쓰는 장면 · 얹기 · 소리도 같이 뺀다
      const r = getReel(db, BRAND_ID, id(c));
      const file = c.req.param('file');
      const full = r ? mediaPath(dataDir, r.id, file) : null;
      if (!r || !full) return c.json(bad('파일을 찾지 못했어요.'), 404);
      fs.rmSync(full, { force: true });
      const uses = (src: string) => src.endsWith(`/${file}`);
      const doc: ReelDoc = {
        ...r.doc,
        assets: r.doc.assets.filter((a) => a.file !== file),
        scenes: r.doc.scenes.map((s) => (s.media && uses(s.media.src) ? { ...s, media: null } : s)),
        overlays: r.doc.overlays.filter((o) => !uses(o.src)),
        audio: r.doc.audio.filter((a) => !uses(a.src)),
      };
      saveReel(db, BRAND_ID, r.id, doc);
      return c.json({ ok: true, doc });
    })
    .get('/:id/media/:file', (c) => {
      const full = mediaPath(dataDir, id(c), c.req.param('file'));
      if (!full) return c.json(bad('파일을 찾지 못했어요.'), 404);
      const res = sendFile(c, full);
      res.headers.set('access-control-allow-origin', '*');
      return res;
    })
    .post(
      '/:id/render',
      validator('json', (v, c) => {
        const b = z.object({ quality: z.enum(['720', '1080', '4k']) }).safeParse(v);
        return b.success ? b.data : c.json(bad('화질은 720 · 1080 · 4K 중에서 고르세요.'), 400);
      }),
      (c) => {
        const r = getReel(db, BRAND_ID, id(c));
        if (!r) return c.json(bad('릴스를 찾지 못했어요.'), 404);
        const { ready: _r, ...brand } = reelBrand(db, BRAND_ID);
        return c.json({ jobId: startRender(db, dataDir, r.id, r.doc, brand, guide(), c.req.valid('json').quality as Quality).id });
      },
    )
    .get('/:id/renders/:file', (c) => {
      const full = renderPath(dataDir, id(c), c.req.param('file'));
      if (!full) return c.json(bad('뽑은 영상을 찾지 못했어요.'), 404);
      const res = sendFile(c, full);
      res.headers.set('content-disposition', `attachment; filename="${c.req.param('file')}"`);
      return res;
    })
    .post(
      '/:id/transcribe',
      validator('json', (v, c) => {
        const b = z.object({ file: z.string() }).safeParse(v);
        return b.success ? b.data : c.json(bad('받아쓸 파일을 고르세요.'), 400);
      }),
      async (c) => {
        if (!(await hasWhisper())) return c.json(bad('받아쓰기 프로그램(faster-whisper)이 없어요.', '선택 기능이에요. 쓰려면 터미널에서 `pip install faster-whisper` 를 실행한 뒤 다시 누르세요.'), 400);
        const full = mediaPath(dataDir, id(c), c.req.valid('json').file);
        if (!full) return c.json(bad('파일을 찾지 못했어요.'), 404);
        try {
          return c.json({ segments: await transcribe(full, getSetting(db, 'reels.whisperModel')) });
        } catch (e) {
          return c.json(bad(e instanceof Error ? e.message : String(e), '파일에 말소리가 있는지 확인하고 다시 시도하세요.'), 400);
        }
      },
    );
}

/** 편집 화면이 쓰는 글꼴 id(브랜드 제목 · 본문 + 글자들이 고른 것) — fonts.css 에 넘긴다 */
export const fontIdsFor = (doc: Pick<ReelDoc, 'texts'>, brand: { titleFont: string; bodyFont: string }) => [...new Set([brand.titleFont, brand.bodyFont, ...doc.texts.map((t) => fontIdOf(t.style.font, { ...brand, palette: null as never, handle: null }))])];
