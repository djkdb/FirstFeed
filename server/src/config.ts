// 설정의 유일한 출처.
// 기본값은 이 파일 한 곳에만 두고, 사용자가 화면에서 바꾼 값만 DB(settings 테이블)에 덮어쓴다.
// 설정을 읽을 때는 반드시 getSetting() 하나만 쓴다 — 기본값과 사용자 값이 어긋나는 곳이 생기지 않게.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 환경에 따라 달라지는 값 (개발자용). 환경 변수는 이 파일에서만 읽는다. */
export const env = {
  repoRoot: REPO_ROOT,
  // 패키징 전까지는 레포 안 data/ 를 쓴다 (.gitignore 로 막혀 있음)
  dataDir: process.env.FIRSTFEED_DATA_DIR ?? path.join(REPO_ROOT, 'data'),
  promptsDir: path.join(REPO_ROOT, 'prompts'),
  // 같은 네트워크의 다른 기기가 이 서버로 사용자 구독의 AI 호출을 일으키지 못하게 이 컴퓨터 안에서만 연다
  host: '127.0.0.1',
  port: Number(process.env.FIRSTFEED_PORT ?? 4317),
};

/** AI 모델 별칭. CLI 의 --model 에 그대로 넘긴다 (`claude --help`: 'sonnet', 'opus' 같은 별칭 허용). */
export type ModelAlias = 'sonnet' | 'opus' | 'fable' | 'haiku';

/** CLI 의 --effort 단계 (`claude --help`: low, medium, high, xhigh, max) */
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/**
 * 사용자가 바꿀 수 있는 설정의 기본값.
 * 키를 더할 때는 여기에만 더한다. DB 에는 이 중 사용자가 바꾼 키만 저장된다.
 */
export const DEFAULTS = {
  /** 사용할 AI 공급자. 지금은 Claude Code CLI 하나 (Codex·Gemini 는 11월) */
  'ai.provider': 'claude' as const,

  /**
   * 과제별 모델. 왕복이 잦거나 단순한 과제는 빠른 sonnet, 품질이 결과를 좌우하는 과제는 opus.
   * 여기에 없는 과제는 'default' 를 쓴다.
   */
  'ai.taskModels': {
    default: 'sonnet',
    // sonnet — 인터뷰 왕복·사실 추출·스모크
    smoke_extract: 'sonnet',
    smoke_context_probe: 'sonnet',
    identity_followup: 'sonnet',
    task_extract: 'sonnet',
    insight_read: 'sonnet',
    // opus — 정체성 프로필·브랜딩·카피 생성·자기 평가
    identity_profile: 'opus',
    identity_alternatives: 'opus',
    // 브랜딩 키트는 글·시각 두 호출 (결정 2026-10-14 · 브랜딩 키트 설계)
    brand_words: 'opus',
    brand_visual: 'opus',
    cover_titles: 'opus',
    card_body: 'opus',
    reel_script: 'opus',
    caption_set: 'opus',
    self_review: 'opus',
  } as Record<string, ModelAlias>,

  /**
   * 과제별 노력 단계(--effort). 여기에 없으면 CLI 기본값.
   * 앱 호출은 --safe-mode 라 사용자 설정의 effort 를 읽지 않는다. 값은 실측(scripts/ai-effort-probe.ts)으로 정한다.
   */
  'ai.taskEffort': {} as Record<string, Effort>,
  /** JSON·스키마가 깨졌을 때 다시 요청하는 횟수 */
  'ai.maxJsonRetries': 1,
  /** 코드 규칙 위반·자기 평가의 사실 오류/깨짐으로 재작성하는 횟수 (성공 지표 "재작성 2회 이내") */
  'ai.maxRewrites': 2,
  /** 동시에 돌릴 AI 호출 수. CLI 하나가 구독 사용량을 같이 쓰므로 기본은 하나씩 */
  'ai.concurrency': 1,
  /** 일반 호출 제한 시간(ms) */
  'ai.timeoutMs': 180_000,
  /**
   * 과제별 제한 시간(ms). 여기에 없으면 ai.timeoutMs.
   * opus 과제는 응답 시간이 크게 흔들려(2026-10-13 실측: 프로필 생성 27~149초, 자기 평가 18~74초)
   * 재작성처럼 프롬프트가 길어지면 180초를 넘을 수 있어서 늘린다.
   */
  'ai.taskTimeoutsMs': {
    identity_profile: 360_000,
    // 다른 방향은 프로필 두 개를 한 번에 써서 출력이 두 배
    identity_alternatives: 480_000,
    self_review: 240_000,
    brand_words: 300_000,
    brand_visual: 300_000,
  } as Record<string, number>,
  /** 웹 검색 호출 제한 시간(ms) — 검색은 1~3분 걸린다 (PRD 6-3) */
  'ai.webTimeoutMs': 300_000,
  /** 로그인(구독) 확인 결과를 기억하는 시간(ms). 실행 직전 확인을 매번 하면 호출마다 1초 남짓 느려진다 */
  'ai.authCacheMs': 60_000,
  /** 인터뷰 최소 질문 수 — 이보다 적으면 AI 가 "충분하다"고 해도 계속 묻는다 (CLAUDE.md 결정 5) */
  'identity.minTurns': 3,
  /** 인터뷰 최대 질문 수 — 여기서 멈춘다 */
  'identity.maxTurns': 10,
  /** 지난 질문과 글자 유사도가 이 값 이상이면 같은 질문으로 본다. 임시값 — 테스트 세트로 재서 정한다 (결정 7) */
  'identity.duplicateQuestionThreshold': 0.6,
  /** 축끼리 글자 유사도가 이 값 이상이면 겹친다고 본다. 임시값 — 테스트 세트로 재서 정한다 (결정 7) */
  'identity.pillarOverlapThreshold': 0.5,
  /** 인용 최소 글자 수(공백·문장부호 제외). 너무 짧은 조각은 근거가 약해서 (CLAUDE.md 근거 규칙의 알려진 한계) */
  'identity.minQuoteChars': 4,
  /**
   * 인스타 글자 제한. 외부 자료가 서로 일치하지만 공식 원문 미확인 — 사용자가 실제 앱에서 확인하면 확정 (CLAUDE.md 결정 2026-10-14 · 브랜딩 키트 설계)
   */
  'brand.handleMax': 30,
  'brand.displayNameMax': 30,
  'brand.bioMax': 150,
  /** 바이오에 남길 링크 안내 문구 자리 (바이오 상한 = bioMax − 이 값). 0 이면 150자를 다 쓴다 */
  'brand.bioLinkReserve': 20,
  /** 글자/배경 최소 명암비 (FR-BR-2, WCAG AA 본문) */
  'brand.minContrast': 4.5,
  /** 올리는 그림(프로필 사진 등) 최대 크기. 1080×1080 PNG 가 보통 1~3MB 라 넉넉히 */
  'brand.maxUploadBytes': 8 * 1024 * 1024,
  /**
   * 과제별 프롬프트 활성 버전. 없으면 v1.
   * self_review v2: 프로필의 축 겹침을 broken 으로 잡는다 (전후 측정 tests/results/2026-10-14-identity-v1-review-*.md, 결정 2026-10-14)
   * identity_profile v2 · identity_followup v2: 전후 측정 tests/results/2026-10-14-identity-{profile,followup}-v*.md (devlog 2026-10-14-01)
   */
  'prompts.activeVersions': { self_review: 'v2', identity_profile: 'v2', identity_followup: 'v2' } as Record<string, string>,
};

export type Settings = typeof DEFAULTS;
export type SettingKey = keyof Settings;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * 설정 하나를 읽는다. DB 에 사용자 값이 있으면 그것을, 없으면 기본값을 돌려준다.
 * 객체 설정(과제별 모델 등)은 기본값 위에 사용자 값을 얕게 덮어쓴다 — 사용자가 과제 하나만 바꿔도 나머지는 기본값이 유지되게.
 */
export function getSetting<K extends SettingKey>(db: DatabaseSync | null, key: K, userId = 1): Settings[K] {
  const fallback = DEFAULTS[key];
  if (!db) return fallback;
  const row = db.prepare('SELECT value_json FROM settings WHERE user_id = ? AND key = ?').get(userId, key) as
    | { value_json: string }
    | undefined;
  if (!row) return fallback;
  const stored: unknown = JSON.parse(row.value_json);
  if (isPlainObject(fallback) && isPlainObject(stored)) {
    return { ...(fallback as object), ...stored } as Settings[K];
  }
  return stored as Settings[K];
}

/** 사용자가 바꾼 설정을 저장한다. 기본값과 타입이 다르면 저장하지 않는다. */
export function setSetting<K extends SettingKey>(db: DatabaseSync, key: K, value: Settings[K], userId = 1): void {
  const fallback = DEFAULTS[key];
  const sameKind = isPlainObject(fallback) ? isPlainObject(value) : typeof value === typeof fallback;
  if (!sameKind) {
    throw new Error(
      `설정 "${key}" 의 값 형식이 맞지 않습니다 (기대: ${isPlainObject(fallback) ? '객체' : typeof fallback}). 값을 고쳐 다시 저장하세요.`,
    );
  }
  db.prepare(
    `INSERT INTO settings (user_id, key, value_json, updated_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
  ).run(userId, key, JSON.stringify(value));
}

/** 과제에 쓸 모델. 과제별 설정에 없으면 default. */
export function modelForTask(db: DatabaseSync | null, task: string, userId = 1): ModelAlias {
  const models = getSetting(db, 'ai.taskModels', userId);
  return models[task] ?? models.default ?? 'sonnet';
}
