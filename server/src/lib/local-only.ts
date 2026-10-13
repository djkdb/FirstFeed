// 로컬 서버를 다른 웹사이트로부터 지킨다.
// 이 서버는 사용자 구독으로 AI CLI 를 실행하므로, 브라우저에 열린 아무 사이트나 localhost 로 요청을 보내
// AI 를 돌리거나 데이터를 읽게 되면 안 된다. 두 가지 공격을 막는다:
//  - DNS 리바인딩: 공격자 도메인을 127.0.0.1 로 돌려 같은 출처처럼 접근 → Host 헤더가 로컬 이름이 아니면 거절
//  - 다른 사이트에서 보낸 요청(CSRF) → Origin 헤더가 있고 로컬 출처가 아니면 거절
import type { MiddlewareHandler } from 'hono';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function hostnameOf(hostHeader: string): string {
  // "[::1]:4317" 같은 IPv6 표기도 처리한다
  if (hostHeader.startsWith('[')) return hostHeader.slice(0, hostHeader.indexOf(']') + 1);
  return hostHeader.split(':')[0] ?? '';
}

export function isLocalHost(hostHeader: string | undefined): boolean {
  return hostHeader !== undefined && LOCAL_HOSTNAMES.has(hostnameOf(hostHeader).toLowerCase());
}

export function isLocalOrigin(origin: string | undefined): boolean {
  if (origin === undefined) return true; // 같은 출처의 GET·curl 등은 Origin 을 보내지 않는다
  try {
    const url = new URL(origin);
    return LOCAL_HOSTNAMES.has(url.hostname === '::1' ? '[::1]' : url.hostname);
  } catch {
    return false;
  }
}

export const localOnly: MiddlewareHandler = async (c, next) => {
  if (!isLocalHost(c.req.header('host'))) {
    return c.json({ error: '이 서버는 이 컴퓨터(localhost)에서만 접속할 수 있습니다. 주소창을 http://localhost 로 시작하게 바꿔 다시 여세요.' }, 403);
  }
  if (!isLocalOrigin(c.req.header('origin'))) {
    return c.json({ error: '다른 웹사이트에서 보낸 요청이라 거절했습니다. 퍼스트피드 화면(localhost)에서 다시 시도하세요.' }, 403);
  }
  await next();
};
