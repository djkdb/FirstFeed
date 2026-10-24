// 폰으로 받기 (FR-PB-5 · 결정 2026-10-24). 업로드 폴더의 그림·캡션을 같은 와이파이의 휴대폰에서 받게 하는 **별도의 작은 서버**.
// 본 서버(로컬 API)는 지금처럼 127.0.0.1 에서만 듣는다 — 사용자 구독으로 AI 를 돌리는 서버를 네트워크에 열지 않으려고.
// 이 서버는 그 반대로 같은 네트워크에 열리므로 열 수 있는 것을 최소로 줄인다:
//  - 사용자가 「폰으로 받기」를 눌렀을 때만 켜지고, 10분(설정 publish.phoneShareMinutes) 뒤 · 「지금 닫기」 · 다른 폴더를 열 때 닫힌다
//  - 켤 때 고른 업로드 폴더 하나의 그림(업로드/NN_종류.png)과 그 폴더의 캡션.txt 만 — 켤 때 목록을 찍어 두고 그 이름만 내준다(경로를 받지 않는다)
//  - 읽기 전용(GET · HEAD 만), 주소에 32바이트 무작위 토큰(일정 시간 비교), Host 헤더가 이 서버 주소가 아니면 거절(DNS 리바인딩)
//  - 1회용: 처음 연 기기 하나만 — 같은 와이파이의 다른 기기가 주소를 엿봐도 열 수 없게. 닫으면 토큰도 끝(다시 켜면 새 토큰)
//  - 이 컴퓨터의 사설 IPv4 주소 하나에만 묶는다(0.0.0.0 아님)
import crypto from 'node:crypto';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { serve, type ServerType } from '@hono/node-server';
import { Hono, type Context } from 'hono';
import qrcode from 'qrcode-generator';
import { getSetting } from '../config.ts';
import type { Db } from '../db/index.ts';
import { getExport } from './store.ts';
import { ExportError } from './export.ts';

/** 업로드 폴더 안 그림 이름 — export.ts 가 만드는 모양(01_cover.png …)만 */
const CARD_FILE = /^\d{2}_(cover|body|closing)\.png$/;

export interface ShareSnapshot {
  exportId: number;
  title: string;
  /** 이름 → 절대 경로. 켤 때 찍어 둔 목록 — 요청에서 받은 이름은 이 표에서만 찾는다 */
  files: Map<string, string>;
  caption: string | null;
}

/** 사설 IPv4(10/8 · 172.16/12 · 192.168/16) 중 하나. 없으면 null — 와이파이(같은 네트워크)에 연결돼 있지 않다 */
export function lanAddress(ifaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces()): string | null {
  const isPrivate = (a: string) => /^10\./.test(a) || /^192\.168\./.test(a) || /^172\.(1[6-9]|2\d|3[01])\./.test(a);
  const all = Object.values(ifaces)
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === 'IPv4' && !i.internal && isPrivate(i.address));
  // 집 공유기에 흔한 192.168 을 먼저 — 가상 머신·VPN 어댑터가 10.x 를 쓰는 일이 많아서
  return (all.find((i) => i.address.startsWith('192.168.')) ?? all[0])?.address ?? null;
}

/** 업로드 폴더를 열 수 있게 목록을 찍는다. 심볼릭 링크·하위 폴더·다른 이름의 파일은 넣지 않는다 */
export function snapshotExport(db: Db, exportId: number): ShareSnapshot {
  const e = getExport(db, exportId);
  if (!e) throw new ExportError('만든 업로드 폴더 기록을 찾지 못했습니다. 「업로드 폴더 만들기」를 먼저 누르세요.');
  const up = path.join(e.path, '업로드');
  if (!fs.existsSync(up)) throw new ExportError(`업로드 폴더가 없습니다(옮기거나 지웠을 수 있어요): ${up}. 폴더를 다시 만든 뒤 시도하세요.`);
  const files = new Map<string, string>();
  for (const d of fs.readdirSync(up, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (d.isFile() && CARD_FILE.test(d.name)) files.set(d.name, path.join(up, d.name));
  }
  if (files.size === 0) throw new ExportError('업로드 폴더에 카드 그림이 없습니다. 폴더를 다시 만든 뒤 시도하세요.');
  const capFile = path.join(e.path, '캡션.txt');
  const caption = fs.existsSync(capFile) && fs.lstatSync(capFile).isFile() ? fs.readFileSync(capFile, 'utf8').trimEnd() : null;
  return { exportId, title: path.basename(e.path), files, caption };
}

export function newToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

/** 휴대폰에서 보는 페이지. 안내 문장은 휴대폰 업로드 확인 결과(2026-10-21, CLAUDE.md 결정 2026-10-18 · D)를 그대로 옮긴다 */
export function mobilePage(s: ShareSnapshot, base: string, nonce: string, closesAt: Date): string {
  const names = [...s.files.keys()];
  const cards = names
    .map((n, i) => {
      const src = `${base}/img/${encodeURIComponent(n)}`;
      // 번호는 그림 위가 아니라 그림 앞 줄에 — 카드 왼쪽 위의 칩을 가리지 않게(화면 확인에서 발견)
      return `<li><span class="no">${i + 1}</span><img src="${src}" alt="${i + 1}번 카드" loading="lazy"><a class="save" href="${src}?dl=1" download="${esc(n)}">${i + 1}번 저장</a></li>`;
    })
    .join('');
  const hhmm = closesAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><title>폰으로 받기 · FirstFeed</title>
<style nonce="${nonce}">
body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f6f5f1;color:#15161a;line-height:1.5}
main{max-width:520px;margin:0 auto;padding:16px}
h1{font-size:18px;margin:4px 0 12px;word-break:break-all}
.how{background:#eef1fd;color:#1f2a6b;border-radius:12px;padding:12px 14px;font-size:14px}
.how ol{margin:6px 0 0;padding-left:20px}
button,.save{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #15161a;background:#fff;color:#15161a;font:inherit;font-weight:600;text-decoration:none}
button.primary{background:#15161a;color:#fff;width:100%;margin:12px 0}
ul.cards{list-style:none;margin:0;padding:0;display:grid;gap:16px}
.cards li{position:relative;background:#fff;border-radius:12px;padding:8px;display:grid;gap:8px}
.cards img{width:100%;height:auto;border-radius:6px;display:block}
.no{justify-self:start;background:#15161a;color:#fff;font-weight:700;border-radius:999px;min-width:32px;height:32px;display:flex;align-items:center;justify-content:center}
pre{white-space:pre-wrap;word-break:break-word;background:#fff;border-radius:12px;padding:12px;font:inherit;font-size:14px}
.muted{color:#5a5c63;font-size:13px}
</style></head><body><main>
<h1>${esc(s.title)}</h1>
<div class="how"><strong>인스타에서 1번부터 순서대로 고르세요</strong>
<ol><li>아래 그림을 1번부터 저장</li><li>인스타 → 새 게시물 → 「선택」</li><li>1번 그림부터 하나씩 탭 — 탭한 순서가 게시물 순서예요</li></ol>
<p class="muted">갤러리는 최근 사진이 앞이라 다른 사진과 섞여 보일 수 있어요. 번호를 보며 고르세요.</p></div>
<button type="button" class="primary" id="all">1번부터 차례로 모두 저장 (${names.length}장)</button>
<p class="muted">저장한 그림이 사진 앱이 아니라 「파일」·「다운로드」에 들어가면, 그림을 길게 눌러 「사진에 저장」을 1번부터 하세요.</p>
<ul class="cards">${cards}</ul>
${
  s.caption !== null
    ? `<h2>캡션</h2><pre id="cap">${esc(s.caption)}</pre><button type="button" id="copy">캡션 복사</button> <span id="copied" class="muted" role="status"></span>`
    : '<p class="muted">이 폴더에는 캡션이 없어요.</p>'
}
<p class="muted">같은 와이파이의 이 기기에서만 열려요 · ${esc(hhmm)}에 닫혀요 · 컴퓨터에서 「지금 닫기」를 누르면 바로 닫혀요</p>
</main><script nonce="${nonce}">
document.getElementById('all').addEventListener('click',async()=>{for(const a of document.querySelectorAll('a.save')){a.click();await new Promise(r=>setTimeout(r,800));}});
const copy=document.getElementById('copy');
if(copy)copy.addEventListener('click',async()=>{const t=document.getElementById('cap').textContent;const out=document.getElementById('copied');
try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(t);}else{const ta=document.createElement('textarea');ta.value=t;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,t.length);const ok=document.execCommand('copy');ta.remove();if(!ok)throw new Error('copy');}
out.textContent='복사했어요';}catch(e){out.textContent='복사가 안 되면 캡션 글을 길게 눌러 복사하세요';}});
</script></body></html>`;
}

export interface ShareState {
  token: string;
  snapshot: ShareSnapshot;
  expiresAt: number;
  /** 이 서버의 주소 — Host 헤더가 이것이어야 한다 */
  host: string;
  /** 처음 연 기기의 주소(1회용). null 이면 아직 아무도 안 열었다 */
  claimedBy: string | null;
  nonce: string;
}

const clientIp = (c: Context): string => {
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
  return env?.incoming?.socket?.remoteAddress ?? 'unknown';
};

/** 휴대폰 쪽 라우트. 시각은 바깥에서 받아 만료를 테스트로 확인할 수 있게 */
export function shareApp(st: ShareState, now: () => number = Date.now) {
  const deny = (c: Context, status: 403 | 404 | 405 | 410, error: string) => c.text(error, status);
  return new Hono()
    .use('*', async (c, next) => {
      c.header('cache-control', 'no-store');
      c.header('referrer-policy', 'no-referrer');
      c.header('x-content-type-options', 'nosniff');
      c.header('x-frame-options', 'DENY');
      c.header('content-security-policy', `default-src 'none'; img-src 'self'; style-src 'nonce-${st.nonce}'; script-src 'nonce-${st.nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
      if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return deny(c, 405, '읽기만 할 수 있어요.');
      if (c.req.header('host') !== st.host) return deny(c, 403, '주소가 맞지 않아요. 컴퓨터 화면의 QR 을 다시 찍으세요.');
      if (now() >= st.expiresAt) return deny(c, 410, '닫힌 주소예요. 컴퓨터에서 「폰으로 받기」를 다시 누르세요.');
      const m = /^\/s\/([A-Za-z0-9_-]+)(\/.*)?$/.exec(c.req.path);
      // 토큰이 틀리면 무엇이 있는지 알리지 않는다
      if (!m || !sameToken(m[1]!, st.token)) return deny(c, 404, '찾을 수 없어요.');
      const ip = clientIp(c);
      if (st.claimedBy === null) st.claimedBy = ip;
      else if (st.claimedBy !== ip) return deny(c, 403, '이미 다른 기기에서 열린 주소예요. 컴퓨터에서 「폰으로 받기」를 다시 누르세요.');
      await next();
    })
    .get('/s/:token', (c) => c.html(mobilePage(st.snapshot, `/s/${st.token}`, st.nonce, new Date(st.expiresAt))))
    .get('/s/:token/img/:name', (c) => {
      const name = c.req.param('name');
      const abs = st.snapshot.files.get(name);
      if (!abs || !fs.existsSync(abs) || !fs.lstatSync(abs).isFile()) return deny(c, 404, '찾을 수 없어요.');
      const headers: Record<string, string> = { 'content-type': 'image/png' };
      if (c.req.query('dl') === '1') headers['content-disposition'] = `attachment; filename="${name}"`;
      return c.body(fs.readFileSync(abs), 200, headers);
    })
    .all('*', (c) => deny(c, 404, '찾을 수 없어요.'));
}

export interface ShareInfo {
  url: string;
  /** QR 그림(SVG) — 화면이 그대로 보인다 */
  qrSvg: string;
  expiresAt: string;
  exportId: number;
  files: number;
  hasCaption: boolean;
  /** 휴대폰이 한 번이라도 열었는가 */
  opened: boolean;
}

export function qrSvg(text: string): string {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 6, margin: 4, scalable: true });
}

/** 한 번에 하나만. 새로 켜면 앞의 것은 닫는다 */
export class PhoneShare {
  private st: ShareState | null = null;
  private server: ServerType | null = null;
  private timer: NodeJS.Timeout | null = null;
  private url = '';

  private readonly opts: { address?: () => string | null; now?: () => number };

  /** address · now 는 테스트용(127.0.0.1 에 묶기 · 시계 바꾸기) */
  constructor(opts: { address?: () => string | null; now?: () => number } = {}) {
    this.opts = opts;
  }

  async start(db: Db, exportId: number): Promise<ShareInfo> {
    const snapshot = snapshotExport(db, exportId);
    const address = (this.opts.address ?? lanAddress)();
    if (!address) throw new ExportError('이 컴퓨터가 와이파이(같은 네트워크)에 연결돼 있지 않아요. 휴대폰과 같은 와이파이에 연결한 뒤 다시 누르세요.');
    this.stop();
    const minutes = getSetting(db, 'publish.phoneShareMinutes');
    const now = this.opts.now ?? Date.now;
    const key = newToken();
    const st: ShareState = { token: key, snapshot, expiresAt: now() + minutes * 60_000, host: '', claimedBy: null, nonce: crypto.randomBytes(16).toString('base64') };
    const app = shareApp(st, now);
    const server = await new Promise<ServerType>((resolve, reject) => {
      const s = serve({ fetch: app.fetch, hostname: address, port: 0 }, () => resolve(s));
      s.once('error', reject);
    });
    const port = (server.address() as AddressInfo).port;
    st.host = `${address}:${port}`;
    this.st = st;
    this.server = server;
    this.url = `http://${st.host}/s/${st.token}`;
    this.timer = setTimeout(() => this.stop(), st.expiresAt - now());
    this.timer.unref();
    return this.info()!;
  }

  info(): ShareInfo | null {
    const st = this.st;
    if (!st) return null;
    return {
      url: this.url,
      qrSvg: qrSvg(this.url),
      expiresAt: new Date(st.expiresAt).toISOString(),
      exportId: st.snapshot.exportId,
      files: st.snapshot.files.size,
      hasCaption: st.snapshot.caption !== null,
      opened: st.claimedBy !== null,
    };
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.server) {
      const s = this.server as ServerType & { closeAllConnections?: () => void };
      s.close();
      s.closeAllConnections?.();
    }
    this.server = null;
    this.st = null;
    this.url = '';
  }
}
