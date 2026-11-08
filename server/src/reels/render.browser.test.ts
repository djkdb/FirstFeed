// 릴스 영상 뽑기 — 편집 화면과 같은 컴포지션을 Remotion 으로, 렌더링 브라우저는 Playwright 가 깔아 둔 것(앱이 받지 않음)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { saveSelection } from '../brand/store.ts';
import { createApp } from '../app.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider } from '../ai/testing/fake-provider.ts';
import type { ReelDoc } from './model.ts';
import { remotionBrowser } from './render.ts';

const H = { host: 'localhost:4317' };
const J = { ...H, 'content-type': 'application/json' };

describe('릴스 영상 뽑기', () => {
  it('1초짜리 릴스를 720 으로 — 720×1280 · 1.0초 mp4, 소리가 없으면 음량은 null', async () => {
    expect(remotionBrowser()).not.toBeNull();
    const db = openDb(':memory:');
    saveSelection(db, 1, null, { palette: { name: '시험', colors: { primary: '#2fa8e0', secondary: '#1e293b', accent: '#fde047', background: '#f4f8fb', text: '#111318' }, why: '' }, titleFont: 'suit', bodyFont: 'pretendard' });
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-reels-render-'));
    // 영상 뽑기 브라우저는 글꼴 · 미디어를 이 서버에서 받으므로 실제 서버를 띄운다
    // 앱의 보통 포트(4317)는 개발 서버가 쓰고 있을 수 있어서 빈 포트로
    const { serve } = await import('@hono/node-server');
    const app = createApp({ db, ai: new AiService({ db, provider: new FakeProvider([]) }), dataDir });
    const server = await new Promise<ReturnType<typeof serve>>((res) => {
      const s = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }, (info) => {
        process.env.FIRSTFEED_RENDER_BASE = `http://127.0.0.1:${info.port}`;
        res(s);
      });
    });
    try {
      const r = (await (await app.request('/api/reels', { method: 'POST', headers: J, body: JSON.stringify({ name: '뽑기 시험' }) })).json()) as { id: number; doc: ReelDoc };
      const doc: ReelDoc = { ...r.doc, scenes: [{ ...r.doc.scenes[0]!, start: 0, duration: 30 }], texts: [{ ...r.doc.texts[0]!, start: 0, duration: 30 }] };
      await app.request(`/api/reels/${r.id}`, { method: 'PUT', headers: J, body: JSON.stringify({ doc }) });
      const { jobId } = (await (await app.request(`/api/reels/${r.id}/render`, { method: 'POST', headers: J, body: JSON.stringify({ quality: '720' }) })).json()) as { jobId: string };
      type Job = { phase: string; file: string | null; lufs: number | null; seconds: number | null; error: string | null };
      let job: Job | null = null;
      for (let i = 0; i < 600; i++) {
        job = (await (await app.request(`/api/reels/jobs/${jobId}`, { headers: H })).json()) as Job;
        if (['done', 'failed', 'cancelled'].includes(job.phase)) break;
        await new Promise((res) => setTimeout(res, 500));
      }
      expect((job as Job | null)?.error ?? null).toBeNull();
      expect(job).toMatchObject({ phase: 'done', seconds: 1, lufs: null });
      const out = path.join(dataDir, 'reels', `reel-${r.id}`, 'renders', job!.file!);
      expect(fs.statSync(out).size).toBeGreaterThan(1000);
      try {
        const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', out]).toString();
        const j = JSON.parse(probe) as { streams: Array<{ width?: number; height?: number }>; format: { duration: string } };
        expect(j.streams.find((s) => s.width)).toMatchObject({ width: 720, height: 1280 });
        expect(Number(j.format.duration)).toBeCloseTo(1, 1);
      } catch (e) {
        if ((e as { code?: string }).code !== 'ENOENT') throw e; // ffprobe 가 없는 컴퓨터는 크기 확인만
      }
    } finally {
      server.close();
      delete process.env.FIRSTFEED_RENDER_BASE;
    }
  }, 300_000);

  it('모션: rise 로 들어오는 제목은 0프레임에 안 보이고, 등장이 끝나면 보인다(영상에서 프레임을 꺼내 잰다)', async () => {
    const db = openDb(':memory:');
    saveSelection(db, 1, null, { palette: { name: '시험', colors: { primary: '#2fa8e0', secondary: '#1e293b', accent: '#fde047', background: '#f4f8fb', text: '#111318' }, why: '' }, titleFont: 'suit', bodyFont: 'pretendard' });
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-reels-motion-'));
    const { serve } = await import('@hono/node-server');
    const app = createApp({ db, ai: new AiService({ db, provider: new FakeProvider([]) }), dataDir });
    const server = await new Promise<ReturnType<typeof serve>>((res) => {
      const s = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }, (info) => {
        process.env.FIRSTFEED_RENDER_BASE = `http://127.0.0.1:${info.port}`;
        res(s);
      });
    });
    try {
      const r = (await (await app.request('/api/reels', { method: 'POST', headers: J, body: JSON.stringify({ name: '모션 시험' }) })).json()) as { id: number; doc: ReelDoc };
      const title = r.doc.texts[0]!;
      const doc: ReelDoc = {
        ...r.doc,
        bg: { kind: 'solid', color: '#0b1220' },
        progress: 'accent',
        scenes: [{ ...r.doc.scenes[0]!, start: 0, duration: 30, camera: 'zoom-in' }],
        texts: [{ ...title, start: 0, duration: 30, motion: { enter: 'rise', enterFrames: 12, exit: 'none', exitFrames: 0, emphasis: [{ word: '결과', style: 'highlight' }], accent: 'bar', accentColor: 'accent', loop: 'none' } }],
      };
      await app.request(`/api/reels/${r.id}`, { method: 'PUT', headers: J, body: JSON.stringify({ doc }) });
      const { jobId } = (await (await app.request(`/api/reels/${r.id}/render`, { method: 'POST', headers: J, body: JSON.stringify({ quality: '720' }) })).json()) as { jobId: string };
      type Job = { phase: string; file: string | null; error: string | null };
      let job: Job | null = null;
      for (let i = 0; i < 600; i++) {
        job = (await (await app.request(`/api/reels/jobs/${jobId}`, { headers: H })).json()) as Job;
        if (['done', 'failed', 'cancelled'].includes(job.phase)) break;
        await new Promise((res) => setTimeout(res, 500));
      }
      expect(job?.error ?? null).toBeNull();
      const out = path.join(dataDir, 'reels', `reel-${r.id}`, 'renders', job!.file!);
      // 프레임 n 의 밝기 퍼짐(표준편차) — 단색 배경만 있으면 거의 0, 글자가 보이면 커진다
      const spread = (n: number) => {
        const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', out, '-vf', `select=eq(n\\,${n}),scale=180:320`, '-vframes', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
        const px = [...raw];
        const mean = px.reduce((a, b) => a + b, 0) / px.length;
        return Math.sqrt(px.reduce((a, b) => a + (b - mean) ** 2, 0) / px.length);
      };
      const first = spread(0);
      const after = spread(25);
      expect(first).toBeLessThan(3);
      expect(after).toBeGreaterThan(first + 10);
    } finally {
      server.close();
      delete process.env.FIRSTFEED_RENDER_BASE;
    }
  }, 300_000);
});
