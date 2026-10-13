// 서버 호출은 이 파일을 거친다. 요청·응답 타입은 서버 라우트에서 그대로 가져온다 (Hono RPC).
import { hc } from 'hono/client';
import type { AppType } from '@firstfeed/server/app-type';

export const api = hc<AppType>('/');
