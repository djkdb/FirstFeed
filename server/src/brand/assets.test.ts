// 그림 올리기 (FR-BR-4 "만든 그림을 올리면 그대로 적용") — 임시 폴더에서
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { openDb } from '../db/index.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider } from '../ai/testing/fake-provider.ts';
import { assetPath, saveAsset, sniffImage } from './assets.ts';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ff-assets-'));

describe('그림 파일 검사·저장', () => {
  it('형식은 파일 앞부분으로 판단한다 (보낸 쪽의 이름·종류를 믿지 않는다)', () => {
    expect(sniffImage(PNG)).toBe('png');
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
  });

  it('이름은 서버가 짓고, 폴더 밖을 가리키는 이름은 찾지 않는다', () => {
    const dir = tmp();
    const name = saveAsset(dir, PNG, 1024);
    expect(name).toMatch(/^profile-[a-z0-9]+-[0-9a-f]{6}\.png$/);
    expect(assetPath(dir, name)).not.toBeNull();
    expect(assetPath(dir, '../brand-assets/' + name)).toBeNull();
    expect(() => saveAsset(dir, PNG, 4)).toThrow(/너무 큽니다/);
  });
});

describe('올리기 → 적용 → 보기 (HTTP)', () => {
  it('올린 그림을 프로필 사진으로 고르면 저장되고, 없는 파일 이름은 거절한다', async () => {
    const db = openDb(':memory:');
    const dataDir = tmp();
    const app = createApp({ db, ai: new AiService({ db, provider: new FakeProvider([]) }), dataDir });
    const H = { host: 'localhost:4317' };
    const up = (await (await app.request('/api/brand/assets', { method: 'POST', headers: { ...H, 'content-type': 'application/octet-stream' }, body: PNG })).json()) as { name: string };
    const put = (profileImage: string) =>
      app.request('/api/brand/selection', { method: 'PUT', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ profileImage }) });
    expect((await put(up.name)).status).toBe(200);
    expect((await put('profile-없는-파일.png')).status).toBe(400);
    const img = await app.request(`/api/brand/assets/${up.name}`, { headers: H });
    expect(img.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await img.arrayBuffer())).toEqual(PNG);
    const bad = await app.request('/api/brand/assets', { method: 'POST', headers: { ...H, 'content-type': 'application/octet-stream' }, body: 'hello' });
    expect(((await bad.json()) as { error: string }).error).toContain('PNG·JPG·WEBP');
  });
});
