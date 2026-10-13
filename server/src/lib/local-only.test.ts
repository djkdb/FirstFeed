import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { openDb } from '../db/index.ts';
import { isLocalHost, isLocalOrigin } from './local-only.ts';

describe('로컬 전용 접근', () => {
  it('로컬 Host 만 허용한다 (DNS 리바인딩 차단)', () => {
    expect(isLocalHost('localhost:4317')).toBe(true);
    expect(isLocalHost('127.0.0.1:5173')).toBe(true);
    expect(isLocalHost('[::1]:4317')).toBe(true);
    expect(isLocalHost('evil.example.com')).toBe(false);
    expect(isLocalHost('localhost.evil.com')).toBe(false);
    expect(isLocalHost(undefined)).toBe(false);
  });

  it('다른 사이트 Origin 을 거절한다 (CSRF 차단)', () => {
    expect(isLocalOrigin(undefined)).toBe(true);
    expect(isLocalOrigin('http://localhost:5173')).toBe(true);
    expect(isLocalOrigin('https://evil.example.com')).toBe(false);
    expect(isLocalOrigin('null')).toBe(false);
  });

  it('실제 요청에서도 막힌다', async () => {
    const app = createApp({ db: openDb(':memory:') });
    // app.request 는 URL 에서 Host 헤더를 만들어 주지 않으므로 실제 브라우저처럼 직접 넣는다
    const ok = await app.request('/api/health', { headers: { host: 'localhost:4317' } });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, brand: { id: 1, name: '내 브랜드' } });

    const rebind = await app.request('/api/health', { headers: { host: 'evil.example.com' } });
    expect(rebind.status).toBe(403);

    const csrf = await app.request('/api/health', {
      headers: { host: 'localhost:4317', origin: 'https://evil.example.com' },
    });
    expect(csrf.status).toBe(403);
  });
});
