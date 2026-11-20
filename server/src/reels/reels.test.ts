// 릴스 편집(결정 2026-11-06 · 편집 화면 녹이기): 편집 계산 · 색 · 올리기 · API
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { env } from '../config.ts';
import { openDb } from '../db/index.ts';
import { saveSelection } from '../brand/store.ts';
import { createApp } from '../app.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider } from '../ai/testing/fake-provider.ts';
import { contrast, themeColors } from './color.ts';
import { defaultTextStyle, estimateTextBox, inside, newReelDoc, scriptToSubtitles, snap, splitClip, totalFrames, type ReelDoc } from './model.ts';
import { sniffMedia } from './media.ts';
import { textColor } from './textColor.ts';

const H = { host: 'localhost:4317' };
const J = { ...H, 'content-type': 'application/json' };
const PNG = new Uint8Array(Buffer.from('\x89PNG\r\n\x1a\n' + '0'.repeat(64), 'latin1'));

/** 고정 브랜드 키트 3개(실제 · 공개 me, AI 생성 doyun · seoyeon)의 팔레트 */
const palettes = ['real/brands/me', 'generated/brands/doyun', 'generated/brands/seoyeon']
  .map((f) => path.join(env.repoRoot, 'tests/fixtures', `${f}.json`))
  .filter((f) => fs.existsSync(f))
  .map((f) => (JSON.parse(fs.readFileSync(f, 'utf8')) as { look: { palette: { primary: string; secondary: string; accent: string; background: string; text: string } } }).look.palette);

function setup(withPalette = true) {
  const db = openDb(':memory:');
  if (withPalette) saveSelection(db, 1, null, { palette: { name: '시험', colors: { primary: '#10b981', secondary: '#1e293b', accent: '#fde047', background: '#0b1220', text: '#e2e8f0' }, why: '' }, titleFont: 'suit', bodyFont: 'pretendard', handle: 'test.id' });
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-reels-'));
  return { db, dataDir, app: createApp({ db, ai: new AiService({ db, provider: new FakeProvider([]) }), dataDir }) };
}

describe('릴스 편집 계산', () => {
  it('대본 → 자막: 줄마다 하나, 빈틈없이 채우고 긴 줄이 더 오래', () => {
    const subs = scriptToSubtitles('첫 줄\n\n두 번째 줄은 더 길어요\n끝', 0, 300, defaultTextStyle());
    expect(subs).toHaveLength(3);
    for (let i = 1; i < subs.length; i++) expect(subs[i]!.start).toBe(subs[i - 1]!.start + subs[i - 1]!.duration);
    expect(subs.at(-1)!.start + subs.at(-1)!.duration).toBe(300);
    expect(subs[1]!.duration).toBeGreaterThan(subs[0]!.duration);
  });
  it('자르기: 뒤 조각의 시작 지점(trim)이 잘린 만큼 늘고, 끝에서는 안 자른다', () => {
    const c = { id: 'a', start: 30, duration: 60, src: 'x', trim: 10, volume: 1 };
    const [a, b] = splitClip(c, 50)!;
    expect([a.start, a.duration, a.trim]).toEqual([30, 20, 10]);
    expect([b.start, b.duration, b.trim]).toEqual([50, 40, 30]);
    expect(splitClip(c, 30)).toBeNull();
  });
  it('자석', () => {
    expect(snap(97, [0, 100, 200], 5)).toBe(100);
    expect(snap(90, [0, 100, 200], 5)).toBe(90);
  });
  it('새 릴스: 길이 11초, 처음 글자는 모두 격자 안(가이드 = 위아래 240px)', () => {
    const d = newReelDoc('x');
    expect(totalFrames(d)).toBe(330);
    const guide = { x: 0, y: 240, w: 1080, h: 1440 };
    for (const t of d.texts) expect(inside(estimateTextBox(t), guide)).toBe(true);
    expect(inside(estimateTextBox({ ...d.texts[0]!, style: { ...d.texts[0]!.style, y: 1900 } }), guide)).toBe(false);
  });
});

describe('색 — 브랜드 팔레트에서', () => {
  it('고정 브랜드 키트마다: 연한 박스 글자 4.5:1, 「자동」 글자는 밝은 · 어두운 바탕 위에서 4.5:1(흰 글자는 3:1 이상 + 그림자)', () => {
    expect(palettes.length).toBeGreaterThan(0);
    const t = { id: 'a', start: 0, duration: 30, text: '가', subtitle: true, style: { ...defaultTextStyle(), preset: 'title' as const } };
    for (const pal of palettes) {
      const tc = themeColors(pal.primary);
      expect(contrast(tc.softInk, tc.soft)).toBeGreaterThanOrEqual(4.5);
      for (const behind of ['#ffffff', '#f6f3ea', pal.background, '#141418']) {
        const c = textColor(t, pal, behind);
        if (c === '#ffffff') expect(contrast(c, behind)).toBeGreaterThanOrEqual(3);
        else expect(contrast(c, behind)).toBeGreaterThanOrEqual(4.5);
      }
      expect(textColor(t, pal, null)).toBe('#ffffff'); // 영상 · 사진 위
    }
  });
});

describe('올리기 형식 — 이름 · 확장자를 믿지 않는다', () => {
  it('파일 앞부분으로 판정', () => {
    expect(sniffMedia(PNG)).toEqual({ ext: 'png', kind: 'image' });
    expect(sniffMedia(Buffer.from('\x00\x00\x00\x18ftypmp42', 'latin1'))).toEqual({ ext: 'mp4', kind: 'video' });
    expect(sniffMedia(Buffer.from('\x00\x00\x00\x14ftypqt  ', 'latin1'))).toEqual({ ext: 'mov', kind: 'video' });
    expect(sniffMedia(Buffer.from('ID3\x04', 'latin1'))).toEqual({ ext: 'mp3', kind: 'audio' });
    expect(sniffMedia(Buffer.from('<script>', 'latin1'))).toBeNull();
  });
});

describe('릴스 API', () => {
  it('브랜드 팔레트 · 글꼴 · 가이드(격자 240px)를 내주고, 팔레트가 없으면 ready=false', async () => {
    const a = (await (await setup().app.request('/api/reels', { headers: H })).json()) as { brand: { palette: { primary: string }; titleFont: string; ready: boolean }; guide: { y: number } };
    expect(a.brand).toMatchObject({ titleFont: 'suit', ready: true, palette: { primary: '#10b981' } });
    expect(a.guide.y).toBe(240);
    const b = (await (await setup(false).app.request('/api/reels', { headers: H })).json()) as { brand: { ready: boolean } };
    expect(b.brand.ready).toBe(false);
  });

  it('만들기 → 저장 → 다시 읽기, 모양이 틀린 저장은 400', async () => {
    const { app } = setup();
    const r = (await (await app.request('/api/reels', { method: 'POST', headers: J, body: JSON.stringify({ name: '시험 릴스' }) })).json()) as { id: number; doc: ReelDoc };
    const doc = { ...r.doc, name: '바꾼 이름', memo: '메모' };
    expect((await app.request(`/api/reels/${r.id}`, { method: 'PUT', headers: J, body: JSON.stringify({ doc }) })).status).toBe(200);
    const again = (await (await app.request(`/api/reels/${r.id}`, { headers: H })).json()) as { name: string; doc: ReelDoc };
    expect([again.name, again.doc.memo]).toEqual(['바꾼 이름', '메모']);
    expect((await app.request(`/api/reels/${r.id}`, { method: 'PUT', headers: J, body: JSON.stringify({ doc: { version: 2 } }) })).status).toBe(400);
  });

  it('올리기: 형식이 틀리면 다음 할 일과 함께 400 · 사진은 저장하고 목록에 바로 기록 · 범위 요청 206/416 · 원본 지우기는 쓰던 조각도 뺀다', async () => {
    const { app, dataDir } = setup();
    const { id } = (await (await app.request('/api/reels', { method: 'POST', headers: J, body: JSON.stringify({ name: 'x' }) })).json()) as { id: number };
    const up = (body: Uint8Array, name: string) => app.request(`/api/reels/${id}/media`, { method: 'POST', headers: { ...H, 'content-type': 'application/octet-stream', 'x-filename': encodeURIComponent(name) }, body: new Blob([body as BlobPart]) });
    const badRes = await up(new TextEncoder().encode('hello'), 'a.mp4');
    expect(badRes.status).toBe(400);
    expect(((await badRes.json()) as { hint: string }).hint).toContain('올릴 수 있어요');
    const asset = (await (await up(PNG, '내 사진.png')).json()) as { file: string; kind: string; name: string };
    expect(asset).toMatchObject({ kind: 'image', name: '내 사진.png' });
    expect(asset.file).toMatch(/^[a-z0-9-]+\.png$/); // 이름은 서버가
    const saved = (await (await app.request(`/api/reels/${id}`, { headers: H })).json()) as { doc: ReelDoc };
    expect(saved.doc.assets.map((a) => a.file)).toEqual([asset.file]);
    expect((await app.request(`/api/reels/${id}/media/${asset.file}`, { headers: { ...H, range: 'bytes=0-7' } })).status).toBe(206);
    expect((await app.request(`/api/reels/${id}/media/${asset.file}`, { headers: { ...H, range: 'bytes=9999-' } })).status).toBe(416);
    expect((await app.request(`/api/reels/${id}/media/..%2F..%2Fx.png`, { headers: H })).status).toBe(404);
    // 그 사진을 쓰는 장면을 저장해 두고 원본 지우기
    const src = `/api/reels/${id}/media/${asset.file}`;
    const doc = { ...saved.doc, scenes: saved.doc.scenes.map((s, i) => (i === 0 ? { ...s, media: { src, kind: 'image' as const, trim: 0 } } : s)) };
    await app.request(`/api/reels/${id}`, { method: 'PUT', headers: J, body: JSON.stringify({ doc }) });
    const del = (await (await app.request(`/api/reels/${id}/media/${asset.file}`, { method: 'DELETE', headers: H })).json()) as { doc: ReelDoc };
    expect(del.doc.assets).toHaveLength(0);
    expect(del.doc.scenes[0]!.media).toBeNull();
    expect(fs.existsSync(path.join(dataDir, 'reels', `reel-${id}`, 'media', asset.file))).toBe(false);
  });

  it('글꼴: 앱 목록의 글꼴만 @font-face 로, 파일은 허용 폴더에서만', async () => {
    const { app } = setup();
    const css = await (await app.request('/api/reels/fonts.css?ids=pretendard,없는글꼴', { headers: H })).text();
    expect(css).toContain("font-family:'Pretendard'");
    const url = /url\((\/api\/reels\/font-files\/[^)]+)\)/.exec(css)![1]!;
    expect((await app.request(url, { headers: H })).status).toBe(200);
    expect((await app.request('/api/reels/font-files/package.json', { headers: H })).status).toBe(404);
  });

  it('릴스를 지우면 그 파일(올린 원본 · 뽑은 영상)도 같이', async () => {
    const { app, dataDir } = setup();
    const { id } = (await (await app.request('/api/reels', { method: 'POST', headers: J, body: JSON.stringify({ name: 'x' }) })).json()) as { id: number };
    await app.request(`/api/reels/${id}/media`, { method: 'POST', headers: { ...H, 'content-type': 'application/octet-stream' }, body: new Blob([PNG as BlobPart]) });
    expect(fs.existsSync(path.join(dataDir, 'reels', `reel-${id}`))).toBe(true);
    await app.request(`/api/reels/${id}`, { method: 'DELETE', headers: H });
    expect(fs.existsSync(path.join(dataDir, 'reels', `reel-${id}`))).toBe(false);
  });
});
