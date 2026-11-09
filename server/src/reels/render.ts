// 영상 뽑기 — 편집 화면과 같은 컴포지션(app/src/reels/video)을 Remotion 으로 찍는다(결정 2026-11-06).
// 렌더링 브라우저는 앱이 내려받지 않고 Playwright 가 깔아 둔 것을 넘긴다(「브라우저 자동 설치는 F」).
// 다 찍은 뒤 ffmpeg 로 음량을 맞추고 끝 시각을 -t 로 정한다(교훈 13 · 16 — -shortest 는 끝이 잘리거나 남는다)
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { bundle } from '@remotion/bundler';
import { makeCancelSignal, renderMedia, selectComposition } from '@remotion/renderer';
import { env, getSetting } from '../config.ts';
import type { Db } from '../db/index.ts';
import { FPS, totalFrames, type Box, type ReelBrand, type ReelDoc } from './model.ts';
import { reelDir } from './store.ts';

export type Quality = '720' | '1080' | '4k';
/** 1080×1920 기준 배율: 720 → 720×1280, 4K → 2160×3840 */
export const SCALE: Record<Quality, number> = { '720': 720 / 1080, '1080': 1, '4k': 2 };

export interface RenderJob {
  id: string;
  reelId: number;
  quality: Quality;
  phase: 'bundling' | 'rendering' | 'loudness' | 'done' | 'failed' | 'cancelled';
  progress: number;
  file: string | null;
  error: string | null;
  hint: string | null;
  /** 맞춘 뒤 잰 음량(LUFS) — 소리가 없거나 ffmpeg 가 없으면 null */
  lufs: number | null;
  /** 음량을 맞추지 않은 이유 — 「소리 없음 · ffmpeg 없음」을 함께 보여 어느 쪽인지 몰랐다(사용자 시뮬레이션 2026-11-09) */
  loudnessNote: string | null;
  seconds: number | null;
}

/**
 * Playwright 가 깔아 둔 브라우저 — 같은 폴더의 chrome-headless-shell 을 먼저(Remotion 이 쓰는 모양), 없으면 Chromium 을 chrome-for-testing 으로
 */
export function remotionBrowser(): { browserExecutable: string; chromeMode: 'headless-shell' | 'chrome-for-testing' } | null {
  let exe: string;
  try {
    exe = chromium.executablePath();
  } catch {
    return null;
  }
  // …/ms-playwright/chromium-1248/chrome-<plat>/chrome → …/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-<plat>/chrome-headless-shell
  const root = path.dirname(path.dirname(path.dirname(exe)));
  try {
    for (const d of fs.readdirSync(root).filter((x) => x.startsWith('chromium_headless_shell-')).sort().reverse()) {
      for (const sub of fs.readdirSync(path.join(root, d))) {
        for (const name of ['chrome-headless-shell', 'chrome-headless-shell.exe']) {
          const f = path.join(root, d, sub, name);
          if (fs.existsSync(f)) return { browserExecutable: f, chromeMode: 'headless-shell' };
        }
      }
    }
  } catch {
    /* 폴더 모양이 다르면 아래로 */
  }
  return fs.existsSync(exe) ? { browserExecutable: exe, chromeMode: 'chrome-for-testing' } : null;
}

let bundled: Promise<string> | null = null;
const bundleOnce = () => (bundled ??= bundle({ entryPoint: path.join(env.repoRoot, 'app/src/reels/video/index.tsx'), onProgress: () => undefined }));

const jobs = new Map<string, RenderJob & { cancel: () => void }>();
export const renderJob = (id: string) => {
  const j = jobs.get(id);
  if (!j) return null;
  const { cancel: _c, ...rest } = j;
  return rest;
};
export const cancelRender = (id: string) => jobs.get(id)?.cancel();

const run = (cmd: string, args: string[]) =>
  new Promise<{ ok: boolean; out: string }>((res) => execFile(cmd, args, { maxBuffer: 16 * 1024 * 1024, timeout: 10 * 60 * 1000 }, (e, so, se) => res({ ok: !e, out: `${so}${se}` })));

/** 음량 맞추기 + 끝 시각 고정. 소리가 없거나 ffmpeg 가 없으면 원래 파일 그대로(그 경우 lufs = null) */
async function loudness(file: string, seconds: number, target: number): Promise<{ lufs: number | null; note: string | null }> {
  const probe = await run('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file]);
  if (!probe.ok) return { lufs: null, note: '이 컴퓨터에 ffmpeg 가 없어 음량을 맞추지 않았어요(설치하면 −14 LUFS 로 맞춰요)' };
  if (!probe.out.trim()) return { lufs: null, note: '소리가 없는 영상이라 음량은 맞추지 않았어요' };
  const tmp = `${file}.loud.mp4`;
  // 두 번에 나눠: 먼저 재고(measured_*), 그 값으로 한 번에 같은 만큼 올린다(linear). 한 번에 하는 loudnorm 은
  // 목표에 못 미쳤다(첫 실측 −22.6 LUFS, 목표 −14 — 편집 화면 확인 2026-11-06)
  const m1 = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', `loudnorm=I=${target}:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-']);
  const js = /\{[^{}]*"input_i"[^{}]*\}/.exec(m1.out);
  const meas = js ? (JSON.parse(js[0]) as Record<string, string>) : null;
  const filter =
    meas && Number.isFinite(Number(meas.input_i))
      ? `loudnorm=I=${target}:TP=-1.5:LRA=11:measured_I=${meas.input_i}:measured_TP=${meas.input_tp}:measured_LRA=${meas.input_lra}:measured_thresh=${meas.input_thresh}:offset=${meas.target_offset}:linear=true`
      : `loudnorm=I=${target}:TP=-1.5:LRA=11`;
  const r = await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-af', filter, '-ar', '48000', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', seconds.toFixed(3), '-movflags', '+faststart', tmp]);
  if (!r.ok) {
    fs.rmSync(tmp, { force: true });
    return { lufs: null, note: '음량 맞추기가 실패해 원래 소리 그대로 두었어요' };
  }
  fs.renameSync(tmp, file);
  const m = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-']);
  const i = /I:\s+(-?[\d.]+) LUFS/.exec(m.out.split('Summary:').pop() ?? '');
  return { lufs: i ? Number(i[1]) : null, note: i ? null : '음량을 맞췄지만 다시 재지 못했어요' };
}

export function startRender(db: Db, dataDir: string, reelId: number, doc: ReelDoc, brand: ReelBrand, guide: Box, quality: Quality): RenderJob {
  const id = Math.random().toString(36).slice(2, 10);
  let cancelSignal: (() => void) | null = null;
  const job: RenderJob & { cancel: () => void } = { id, reelId, quality, phase: 'bundling', progress: 0, file: null, error: null, hint: null, lufs: null, loudnessNote: null, seconds: null, cancel: () => cancelSignal?.() };
  jobs.set(id, job);
  void (async () => {
    try {
      const browser = remotionBrowser();
      if (!browser) throw Object.assign(new Error('영상을 찍을 브라우저가 없어요.'), { hint: '터미널에서 `npx playwright install chromium` 을 실행한 뒤 다시 뽑으세요. 앱은 브라우저를 직접 내려받지 않습니다.' });
      const serveUrl = await bundleOnce();
      // 영상 뽑기 브라우저가 미디어 · 글꼴을 받으러 오는 이 서버 주소. 테스트는 빈 포트로 띄운 서버를 FIRSTFEED_RENDER_BASE 로 알려 준다
      const inputProps = { doc, brand, guide, mediaBase: process.env.FIRSTFEED_RENDER_BASE ?? `http://127.0.0.1:${env.port}` };
      const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps, ...browser });
      const dir = path.join(reelDir(dataDir, reelId), 'renders');
      fs.mkdirSync(dir, { recursive: true });
      const file = `reel-${reelId}-${quality}-${Date.now().toString(36)}.mp4`;
      const out = path.join(dir, file);
      job.phase = 'rendering';
      const c = makeCancelSignal();
      cancelSignal = c.cancel;
      await renderMedia({ serveUrl, composition, inputProps, codec: 'h264', scale: SCALE[quality], outputLocation: out, cancelSignal: c.cancelSignal, onProgress: ({ progress }) => (job.progress = progress), ...browser });
      job.phase = 'loudness';
      job.seconds = totalFrames(doc) / FPS;
      const loud = await loudness(out, job.seconds, getSetting(db, 'reels.targetLufs'));
      job.lufs = loud.lufs;
      job.loudnessNote = loud.note;
      job.phase = 'done';
      job.progress = 1;
      job.file = file;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      job.phase = /cancel/i.test(msg) ? 'cancelled' : 'failed';
      job.error = msg;
      job.hint = (e as { hint?: string }).hint ?? '같은 화질로 다시 뽑아 보고, 계속 실패하면 오류 내용을 알려 주세요.';
    }
  })();
  const { cancel: _c, ...rest } = job;
  return rest;
}

export function renderPath(dataDir: string, reelId: number, file: string): string | null {
  if (!/^reel-\d+-(720|1080|4k)-[a-z0-9]+\.mp4$/.test(file)) return null;
  const full = path.join(reelDir(dataDir, reelId), 'renders', file);
  return fs.existsSync(full) ? full : null;
}
