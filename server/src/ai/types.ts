// AI 어댑터의 공통 형식. 공급자(Claude Code·Codex·Gemini·API)가 바뀌어도 바깥에서 보는 모양은 같다 (FR-AI-2).
import type { z } from 'zod';
import type { Effort, ModelAlias } from '../config.ts';

/** 바깥(기능 코드)이 AI 에 보내는 요청 */
export interface AiRequest<T> {
  /** 과제 이름 — 과제별 모델 선택과 로그의 기준 */
  task: string;
  /** 완성된 프롬프트 글 (prompts/ 파일을 채운 결과) */
  prompt: string;
  /** 응답이 맞아야 하는 모양 */
  schema: z.ZodType<T>;
  /** 함께 읽힐 이미지 파일 경로 */
  images?: string[];
  /** 웹 검색이 필요한지 */
  web?: boolean;
  /** 제한 시간(ms). 없으면 설정값 */
  timeoutMs?: number;
  /** 취소 신호 */
  signal?: AbortSignal;
  /** 노력 단계. 없으면 과제별 설정, 그것도 없으면 CLI 기본값 */
  effort?: Effort;
  /** 로그용: 어느 프롬프트 파일·버전인지 */
  promptRef?: { name: string; version: string };
}

/** 공급자 하나가 받는 실행 입력 */
export interface ProviderRunInput {
  prompt: string;
  jsonSchema: Record<string, unknown>;
  model: ModelAlias;
  effort?: Effort;
  images: string[];
  web: boolean;
  timeoutMs: number;
  signal?: AbortSignal;
}

/** 공급자 하나가 돌려주는 날것의 결과. JSON 추출·검증은 어댑터가 공통으로 한다 */
export interface ProviderRunOutput {
  /** CLI 가 스키마에 맞춰 따로 준 구조화 결과 (있을 때만) */
  structured?: unknown;
  /** 모델이 쓴 글 그대로 */
  text: string;
  /** 실제로 쓰인 모델 이름 (CLI 가 알려 줄 때) */
  model?: string;
  durationMs: number;
}

export interface ProviderStatus {
  id: string;
  name: string;
  installed: boolean;
  version: string | null;
  loggedIn: boolean | null; // 확인할 수 없으면 null
  authMethod: string | null;
  subscription: string | null;
  /** 이번 앱 버전에서 쓸 수 있는지 (Codex·Gemini 는 11월) */
  supported: boolean;
  /** 사용자에게 보여 줄 다음 행동 안내 (문제가 없으면 null) */
  hint: string | null;
}

export interface AiProvider {
  id: string;
  detect(): Promise<ProviderStatus>;
  run(input: ProviderRunInput): Promise<ProviderRunOutput>;
}

export type AiErrorKind = 'not_installed' | 'not_logged_in' | 'not_subscription' | 'timeout' | 'cancelled' | 'cli_failed' | 'invalid_json' | 'schema_error';

/** AI 호출 실패. 메시지는 사람 말로, hint 에는 "다음에 뭘 하면 되는지"를 적는다 */
export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly hint: string;
  constructor(kind: AiErrorKind, message: string, hint: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AiError';
    this.kind = kind;
    this.hint = hint;
  }
}
