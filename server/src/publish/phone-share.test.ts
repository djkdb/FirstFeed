// 폰으로 받기 (FR-PB-5 · 결정 2026-10-24) — 같은 네트워크에 여는 서버라 「무엇을 거절하는가」를 먼저 잰다
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { AiService } from '../ai/adapter.ts';
import { FakeProvider } from '../ai/testing/fake-provider.ts';
import { env, setSetting } from '../config.ts';
import { openDb } from '../db/index.ts';
import { text } from '../identity/model.ts';
import { createSession, saveProfileVersion } from '../identity/store.ts';
import { fixTemplate } from '../templates/store.ts';
import { lanAddress, PhoneShare, shareApp, snapshotExport, type ShareState } from './phone-share.ts';
import { addExport } from './store.ts';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4a00000000049454e44ae426082', 'hex');

/** 업로드 폴더 하나(카드 3장 + 캡션)와 그 기록 */
function setup(opts: { caption?: string } = {}) {
  const db = openDb(':memory:');
  const pid = saveProfileVersion(
    db,
    1,
    { accountLine: '계정', accountLineOrigin: 'interview', audience: '누구', audienceOrigin: 'interview', pillars: [], dropped: [], voiceRules: [text('쉽게', 'interview')], avoid: [], unknown: [], presence: null },
    { reason: 'interview', sessionId: createSession(db, 1, {}), basedOn: null, jobId: null, activate: true },
  );
  const look = JSON.parse(fs.readFileSync(path.join(env.repoRoot, 'tests/fixtures/real/brands/me.json'), 'utf8')).look;
  const tv = fixTemplate(db, 1, 'A', look, {}, 'test', null);
  const src = Number(db.prepare("INSERT INTO sources (brand_id, body) VALUES (1, '원문')").run().lastInsertRowid);
  const set = Number(db.prepare('INSERT INTO card_sets (brand_id, source_id, profile_id, template_version_id, body_count) VALUES (1, ?, ?, ?, 1)').run(src, pid, tv).lastInsertRowid);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-phone-'));
  const up = path.join(dir, '업로드');
  fs.mkdirSync(up);
  for (const n of ['01_cover.png', '02_body.png', '03_closing.png']) fs.writeFileSync(path.join(up, n), PNG);
  fs.writeFileSync(path.join(up, '메모.txt'), '올리면 안 되는 글');
  fs.writeFileSync(path.join(dir, '비밀.txt'), '폴더 밖 파일');
  fs.symlinkSync(path.join(dir, '비밀.txt'), path.join(up, '04_body.png'));
  if (opts.caption !== undefined) fs.writeFileSync(path.join(dir, '캡션.txt'), opts.caption);
  const exportId = addExport(db, set, dir, 4);
  return { db, dir, up, exportId };
}

const TOKEN = 'a'.repeat(43);
const HOST = '192.168.0.20:51234';
function app(t: ReturnType<typeof setup>, o: { now?: () => number; expiresAt?: number } = {}) {
  const st: ShareState = { token: TOKEN, snapshot: snapshotExport(t.db, t.exportId), expiresAt: o.expiresAt ?? Date.now() + 600_000, host: HOST, claimedBy: null, nonce: 'n0nce' };
  const a = shareApp(st, o.now);
  const get = (p: string, init: { host?: string; method?: string; ip?: string } = {}) =>
    a.request(p, { method: init.method ?? 'GET', headers: { host: init.host ?? HOST } }, { incoming: { socket: { remoteAddress: init.ip ?? '192.168.0.31' } } });
  return { st, get };
}

describe('폰으로 받기 서버가 거절하는 것', () => {
  it('토큰이 없거나 틀리면 거절한다 — 무엇이 있는지도 알리지 않는다(404)', async () => {
    const { get } = app(setup());
    for (const p of ['/', '/s', '/s/', `/s/${'b'.repeat(43)}`, `/s/${'a'.repeat(42)}`, `/s/${'b'.repeat(43)}/img/01_cover.png`]) expect((await get(p)).status, p).toBe(404);
    expect((await get(`/s/${TOKEN}`)).status).toBe(200);
  });

  it('만료 시각이 지나면 거절한다(410)', async () => {
    let t = 1_000;
    const { get } = app(setup(), { now: () => t, expiresAt: 2_000 });
    expect((await get(`/s/${TOKEN}`)).status).toBe(200);
    t = 2_000;
    expect((await get(`/s/${TOKEN}`)).status).toBe(410);
    expect((await get(`/s/${TOKEN}/img/01_cover.png`)).status).toBe(410);
  });

  it('찍어 둔 그림 말고는 내주지 않는다 — 목록 밖 이름 · 경로 올라가기 · 심볼릭 링크 · 글 파일 · 나중에 생긴 파일 · 본 서버 API', async () => {
    const t = setup({ caption: '캡션' });
    const { get } = app(t);
    fs.writeFileSync(path.join(t.up, '05_body.png'), PNG); // 켠 뒤에 생긴 파일
    for (const p of ['05_body.png', '04_body.png', '메모.txt', '..%2F비밀.txt', '%2E%2E%2F%2E%2E%2Fetc%2Fpasswd', '캡션.txt'])
      expect((await get(`/s/${TOKEN}/img/${p}`)).status, p).toBe(404);
    for (const p of [`/s/${TOKEN}/../비밀.txt`, `/s/${TOKEN}/caption`, '/api/health', '/api/publish/phone', `/s/${TOKEN}/img`]) expect((await get(p)).status, p).toBe(404);
    expect((await get(`/s/${TOKEN}/img/01_cover.png`)).status).toBe(200);
  });

  it('읽기만 — GET · HEAD 말고는 거절(405)', async () => {
    const { get } = app(setup());
    for (const m of ['POST', 'PUT', 'DELETE', 'PATCH']) expect((await get(`/s/${TOKEN}`, { method: m })).status, m).toBe(405);
  });

  it('Host 가 이 서버 주소가 아니면 거절한다(DNS 리바인딩)', async () => {
    const { get } = app(setup());
    for (const host of ['evil.example.com', 'localhost:51234', '192.168.0.20:9999']) expect((await get(`/s/${TOKEN}`, { host })).status, host).toBe(403);
  });

  it('1회용 — 처음 연 기기 말고 다른 기기는 거절한다', async () => {
    const { get, st } = app(setup());
    expect((await get(`/s/${TOKEN}`, { ip: '192.168.0.31' })).status).toBe(200);
    expect(st.claimedBy).toBe('192.168.0.31');
    expect((await get(`/s/${TOKEN}/img/01_cover.png`, { ip: '192.168.0.31' })).status).toBe(200);
    expect((await get(`/s/${TOKEN}`, { ip: '192.168.0.77' })).status).toBe(403);
  });
});

describe('폰으로 받기 페이지', () => {
  it('그림을 1번부터 번호와 저장 버튼으로, 캡션 복사, 인스타에서 1번부터 고르라는 안내 — 캡션 글은 HTML 로 해석하지 않는다', async () => {
    const { get } = app(setup({ caption: '첫 줄 <script>alert(1)</script>\n#태그' }));
    const r = await get(`/s/${TOKEN}`);
    const html = await r.text();
    expect(html).toContain('인스타에서 1번부터 순서대로 고르세요');
    expect([...html.matchAll(/(\d+)번 저장/g)].map((m) => m[1])).toEqual(['1', '2', '3']);
    expect(html.indexOf('01_cover.png')).toBeLessThan(html.indexOf('02_body.png'));
    expect(html).toContain('캡션 복사');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)');
    expect(r.headers.get('content-security-policy')).toContain("script-src 'nonce-n0nce'");
    expect(r.headers.get('cache-control')).toBe('no-store');
  });

  it('저장 버튼 주소(dl=1)는 내려받기로 준다', async () => {
    const { get } = app(setup());
    const r = await get(`/s/${TOKEN}/img/02_body.png?dl=1`);
    expect(r.headers.get('content-type')).toBe('image/png');
    expect(r.headers.get('content-disposition')).toBe('attachment; filename="02_body.png"');
    expect(Buffer.from(await r.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it('캡션이 없는 폴더면 없다고 알린다', async () => {
    const html = await (await app(setup()).get(`/s/${TOKEN}`)).text();
    expect(html).toContain('캡션이 없어요');
  });
});

describe('실제로 켜고 닫기 (127.0.0.1 에 묶어서)', () => {
  it('켜면 토큰 주소로 열리고, 「지금 닫기」 뒤에는 연결 자체가 안 된다', async () => {
    const t = setup({ caption: '캡션' });
    const share = new PhoneShare({ address: () => '127.0.0.1' });
    const info = await share.start(t.db, t.exportId);
    expect(info.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/s\/[A-Za-z0-9_-]{43}$/);
    expect(info).toMatchObject({ files: 3, hasCaption: true, opened: false });
    expect(info.qrSvg).toContain('<svg');
    expect((await fetch(info.url)).status).toBe(200);
    expect(share.info()?.opened).toBe(true);
    expect((await fetch(info.url.replace(/\/s\/.*/, '/s/'))).status).toBe(404);
    share.stop();
    expect(share.info()).toBeNull();
    await expect(fetch(info.url)).rejects.toThrow();
  });

  it('설정한 시간이 지나면 저절로 닫힌다', async () => {
    const t = setup();
    setSetting(t.db, 'publish.phoneShareMinutes', 0.005); // 0.3초
    const share = new PhoneShare({ address: () => '127.0.0.1' });
    const info = await share.start(t.db, t.exportId);
    expect((await fetch(info.url)).status).toBe(200);
    await new Promise((r) => setTimeout(r, 700));
    expect(share.info()).toBeNull();
    await expect(fetch(info.url)).rejects.toThrow();
  });

  it('다시 켜면 앞의 주소(토큰)는 닫히고 새 토큰', async () => {
    const t = setup();
    const share = new PhoneShare({ address: () => '127.0.0.1' });
    const a = await share.start(t.db, t.exportId);
    const b = await share.start(t.db, t.exportId);
    expect(b.url).not.toBe(a.url);
    await expect(fetch(a.url)).rejects.toThrow();
    expect((await fetch(b.url)).status).toBe(200);
    share.stop();
  });

  it('와이파이(사설 주소)가 없으면 켜지 않고 할 일을 알린다', async () => {
    const t = setup();
    await expect(new PhoneShare({ address: () => null }).start(t.db, t.exportId)).rejects.toThrow(/같은 와이파이/);
  });
});

describe('본 서버(로컬 API)는 여전히 127.0.0.1 에서만', () => {
  it('같은 네트워크 주소로 온 요청은 「폰으로 받기」 켜기·상태·닫기 모두 거절한다', async () => {
    const t = setup();
    const a = createApp({ db: t.db, ai: new AiService({ db: t.db, provider: new FakeProvider([]) }), phoneShare: new PhoneShare({ address: () => '127.0.0.1' }) });
    for (const host of ['192.168.0.20:4317', '10.0.0.5:4317']) {
      expect((await a.request(`/api/publish/exports/${t.exportId}/phone`, { method: 'POST', headers: { host } })).status).toBe(403);
      expect((await a.request('/api/publish/phone', { headers: { host } })).status).toBe(403);
      expect((await a.request('/api/health', { headers: { host } })).status).toBe(403);
    }
    const ok = await a.request(`/api/publish/exports/${t.exportId}/phone`, { method: 'POST', headers: { host: 'localhost:4317' } });
    expect(ok.status).toBe(200);
    expect((await a.request('/api/publish/phone', { method: 'DELETE', headers: { host: 'localhost:4317' } })).status).toBe(200);
  });
});

describe('어느 주소에 묶나', () => {
  const nic = (address: string, internal = false) => ({ address, family: 'IPv4' as const, internal, netmask: '255.255.255.0', mac: '00:00:00:00:00:00', cidr: null });
  it('사설 IPv4 만(192.168 먼저), 바깥 주소 · 루프백 · IPv6 는 고르지 않는다', () => {
    expect(lanAddress({ lo0: [nic('127.0.0.1', true)], utun0: [nic('10.8.0.2')], en0: [nic('192.168.0.20')] })).toBe('192.168.0.20');
    expect(lanAddress({ en0: [nic('172.20.1.4')] })).toBe('172.20.1.4');
    expect(lanAddress({ en0: [nic('203.0.113.9')], lo0: [nic('127.0.0.1', true)] })).toBeNull();
    expect(lanAddress({ en0: [{ ...nic('fe80::1'), family: 'IPv6' as const, scopeid: 0 }] })).toBeNull();
  });
});
