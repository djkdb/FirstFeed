// 릴스에 올리는 영상 · 사진 · 소리. 브랜딩 그림 올리기와 같은 원칙(결정 2026-10-14): 형식은 파일 앞부분으로, 이름은 서버가, data 폴더에만
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Asset } from './model.ts';
import { reelDir } from './store.ts';

export const MEDIA_NAME = /^[a-z0-9-]+\.(png|jpg|webp|gif|mp4|mov|webm|mp3|wav|m4a|ogg|flac)$/;

export class MediaError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = 'MediaError';
    this.hint = hint;
  }
}

export function sniffMedia(b: Uint8Array): { ext: string; kind: Asset['kind'] } | null {
  const s = (o: number, t: string) => Buffer.from(b.subarray(o, o + t.length)).toString('latin1') === t;
  if (s(0, '\x89PNG')) return { ext: 'png', kind: 'image' };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', kind: 'image' };
  if (s(0, 'RIFF') && s(8, 'WEBP')) return { ext: 'webp', kind: 'image' };
  if (s(0, 'GIF8')) return { ext: 'gif', kind: 'image' };
  if (s(0, 'RIFF') && s(8, 'WAVE')) return { ext: 'wav', kind: 'audio' };
  if (s(0, 'ID3') || (b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0)) return { ext: 'mp3', kind: 'audio' };
  if (s(0, 'OggS')) return { ext: 'ogg', kind: 'audio' };
  if (s(0, 'fLaC')) return { ext: 'flac', kind: 'audio' };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { ext: 'webm', kind: 'video' };
  if (s(4, 'ftyp')) {
    const brand = Buffer.from(b.subarray(8, 12)).toString('latin1');
    if (brand.startsWith('M4A')) return { ext: 'm4a', kind: 'audio' };
    if (brand === 'qt  ') return { ext: 'mov', kind: 'video' };
    return { ext: 'mp4', kind: 'video' };
  }
  return null;
}

/** 길이(초) — ffprobe 가 없으면 null(모르는 값은 0 으로 채우지 않는다) */
export function probeSeconds(file: string): number | null {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { timeout: 15000 }).toString().trim();
    const n = Number(out);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export const mediaDir = (dataDir: string, reelId: number) => path.join(reelDir(dataDir, reelId), 'media');

export function saveMedia(dataDir: string, reelId: number, bytes: Uint8Array, originalName: string, maxBytes: number): Asset {
  if (bytes.byteLength > maxBytes) throw new MediaError(`파일이 너무 커요(${Math.round(bytes.byteLength / 1024 / 1024)}MB).`, `${Math.round(maxBytes / 1024 / 1024)}MB 이하로 줄여서 올리세요.`);
  const t = sniffMedia(bytes);
  if (!t) throw new MediaError('올릴 수 없는 형식이에요.', '영상(mp4 · mov · webm) · 사진(png · jpg · webp · gif) · 소리(mp3 · wav · m4a · ogg) 파일만 올릴 수 있어요.');
  const dir = mediaDir(dataDir, reelId);
  fs.mkdirSync(dir, { recursive: true });
  const file = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}.${t.ext}`;
  const full = path.join(dir, file);
  fs.writeFileSync(full, bytes, { flag: 'wx' });
  return { file, kind: t.kind, name: originalName.slice(0, 120) || file, seconds: t.kind === 'image' ? null : probeSeconds(full) };
}

export function mediaPath(dataDir: string, reelId: number, file: string): string | null {
  if (!MEDIA_NAME.test(file)) return null;
  const full = path.join(mediaDir(dataDir, reelId), file);
  return fs.existsSync(full) ? full : null;
}
