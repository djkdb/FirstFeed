// 사용자가 올린 그림(FR-BR-4 "만든 그림을 올리면 그대로 적용"). 데이터 폴더(data/brand-assets, 레포 밖)에만 둔다.
// 형식은 보낸 쪽이 붙인 이름·종류를 믿지 않고 파일 앞부분(매직 바이트)으로 판단하고, 이름은 서버가 짓는다.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type ImageType = 'png' | 'jpg' | 'webp';
export const ASSET_NAME = /^[a-z0-9-]+\.(png|jpg|webp)$/;
export const MIME: Record<ImageType, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

export function sniffImage(b: Uint8Array): ImageType | null {
  const at = (i: number, bytes: number[]) => bytes.every((x, j) => b[i + j] === x);
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (at(0, [0xff, 0xd8, 0xff])) return 'jpg';
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return 'webp';
  return null;
}

export class AssetError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = 'AssetError';
    this.hint = hint;
  }
}

export const assetDir = (dataDir: string) => path.join(dataDir, 'brand-assets');

export function saveAsset(dataDir: string, bytes: Uint8Array, maxBytes: number, prefix = 'profile'): string {
  if (bytes.length === 0) throw new AssetError('빈 파일입니다.', '그림 파일을 다시 골라 주세요.');
  if (bytes.length > maxBytes) throw new AssetError(`파일이 너무 큽니다(${(bytes.length / 1024 / 1024).toFixed(1)}MB).`, `${Math.round(maxBytes / 1024 / 1024)}MB 이하로 줄여서 올려 주세요.`);
  const type = sniffImage(bytes);
  if (!type) throw new AssetError('PNG·JPG·WEBP 그림이 아닙니다.', '그림 생성 도구에서 PNG 로 받아 올려 주세요.');
  const name = `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}.${type}`;
  fs.mkdirSync(assetDir(dataDir), { recursive: true });
  fs.writeFileSync(path.join(assetDir(dataDir), name), bytes);
  return name;
}

/** 이름 검사 후 경로 — 폴더 밖을 가리키는 이름은 받지 않는다 */
export function assetPath(dataDir: string, name: string): string | null {
  if (!ASSET_NAME.test(name)) return null;
  const p = path.join(assetDir(dataDir), name);
  return fs.existsSync(p) ? p : null;
}
