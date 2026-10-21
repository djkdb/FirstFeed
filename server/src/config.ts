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
    // 30일 뒤 미리보기의 시리즈 계획 — 제목 카피라 표지 제목과 같은 모델 (FR-BR-6)
    series_plan: 'opus',
    card_body: 'opus',
    reel_script: 'opus',
    caption_set: 'opus',
    // 중간 발표용 최소 캡션 (결정 2026-10-18 · FR-PB-1)
    caption_min: 'opus',
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
    cover_titles: 300_000,
    // 본문은 카드 N장 + 그림 프롬프트를 한 번에 써서 출력이 길다
    card_body: 480_000,
    caption_min: 240_000,
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
  /**
   * 인스타가 실제로 글자 수를 어떻게 세는지(숫자 30·150 과 이모지 세기) 사용자가 앱에서 확인했는가. 확인 전(false)에는
   * 글자 수 옆에 「확인 대기」를 보인다(PRD v0.2 FR-BR-1). 확인하면 CLAUDE.md 결정에 결과를 남기고 true 로 (결정 2026-10-14 · 2026-10-18 · D)
   */
  'brand.instagramCountConfirmed': false,
  /** 바이오에 남길 링크 안내 문구 자리 (바이오 상한 = bioMax − 이 값). 0 이면 150자를 다 쓴다 */
  'brand.bioLinkReserve': 20,
  /** 글자/배경 최소 명암비 (FR-BR-2, WCAG AA 본문) */
  'brand.minContrast': 4.5,
  /**
   * 근거 대조(숫자·영문 이름)에서 통과시킬 흔한 영문 약어. 공용 규칙이라 바이오·카드 문구 등 모든 생성에 적용된다.
   * 항목마다 이유 필수, 실제로 걸린 것만 넣고 짧게 유지. "대문자 몇 자 이하" 같은 일반 규칙은 쓰지 않는다 — GPT 같은 이름까지 통과시켜서
   * (결정 2026-10-14 · 브랜딩 키트 다듬기)
   */
  'grounding.commonEnglish': [
    { term: 'DM', reason: '인스타 다이렉트 메시지를 부르는 흔한 말. 이름이 아니다 — 2026-10-14 바이오 "협업 제안은 DM" 이 english_not_in_source 로 걸림' },
  ] as Array<{ term: string; reason: string }>,
  /**
   * 카드 렌더링 브라우저 (결정 2026-10-15 · FR-TP). auto = Playwright Chromium(기준 브라우저) → 설치된 Chrome → 없으면 설치 명령 안내.
   * 앱은 브라우저를 내려받지 않는다
   */
  'render.browser': 'auto' as 'auto' | 'chromium' | 'chrome',
  /**
   * 대체 글꼴로 찍혀도 실패로 보지 않는 글꼴 — 이모지 전용. 앱에 넣은 OFL 폰트에는 이모지 글리프가 없어서 이모지는 늘 OS 이모지 글꼴로 찍힌다
   * (그래서 이모지 모양은 OS 마다 다르다 — 글자 폰트와 달리 막을 방법이 없다)
   */
  'render.emojiFonts': ['Apple Color Emoji', 'Noto Color Emoji', 'Segoe UI Emoji'] as string[],
  /** 본문 카드 수 범위 — 표지에 개수 표현이 없고 사용자가 정하지 않았을 때 AI 가 이 안에서 정한다 (FR-MK-1 "소재 양에 따라 자동, 지정 가능") */
  'cards.bodyMin': 3,
  'cards.bodyMax': 7,
  /** 표지 제목 후보: 보여 줄 수(PRD: 6개)와 넉넉히 받을 수 — 규칙·렌더링에 걸린 것을 빼고 보여 준다 */
  'cards.coverShow': 6,
  'cards.coverAsk': 8,
  /** 본문 카드 근거 인용의 최소 글자 수(공백·문장부호 제외) — 너무 짧은 조각은 근거가 약해서 */
  'cards.minQuoteChars': 8,
  /** 넘칠 때 글자 크기를 줄여 보는 단계 (FR-TP-4). 마지막 단계에서도 넘치면 원고를 줄이라고 되돌린다 */
  'render.scaleSteps': [1, 0.94, 0.88, 0.82] as number[],
  /**
   * 인스타 프로필 격자에서 잘리는 자리를 뺀 안전 영역 — **확인됨(운영자가 실제 계정 @zun_it_ 의 웹·앱 프로필 격자에서 확인, 2026-10-18)**.
   * 격자 칸이 3:4 썸네일이라 4:5 카드(1080×1350)는 좌우가, 9:16 릴스 표지(1080×1920)는 위아래가 잘린다(9:16 릴스 표지 맨 위 요소가
   * 실제로 잘리는 것을 봄). 1350×3/4=1012.5 → 좌우 34px, 1080×4/3=1440 → 위아래 240px. 처음엔 외부 자료·레퍼런스 주석으로 넣은 값(2026-10-15)
   */
  'render.safeArea': {
    feed: { x: 34, y: 0, w: 1012, h: 1350 },
    reel: { x: 0, y: 240, w: 1080, h: 1440 },
  } as Record<'feed' | 'reel', { x: number; y: number; w: number; h: number }>,
  /**
   * 그림 바탕 표지(시안 F)의 글자 뒤 명암비 (결정 2026-10-18). 글자를 지운 화면에서 글자 줄 사각형 안 화소 밝기의 이 분위값을
   * 바탕 밝기로 본다 — 0.95 면 가장 밝은 5% 경계(밝은 글자 기준). 평균을 쓰면 밝은 점이 섞인 그림에서 글자 일부가 안 읽혀도 통과한다
   */
  'render.photoContrastQuantile': 0.95,
  /** 그림 위 글자에 요구하는 명암비 — 본문 글자 기준(WCAG AA 4.5:1), 브랜딩 팔레트와 같은 값 */
  'render.photoMinContrast': 4.5,
  /**
   * 글자 뒤 어두운 띠의 진하기 단계(0~1). 앞에서부터 그려 보고 명암비를 넘는 첫 단계를 쓴다.
   * 테스트 그림 3장 × 브랜드 3개 × 표지·릴스 표지로 0~1 을 0.05 씩 잰 값(devlog 2026-10-18-01): 어두운 그림은 0 에서도 8.8:1 이상,
   * 밝은·복잡한 그림은 0.65(me)~0.7(doyun·seoyeon)부터 4.5:1. 그래서 옅은 0.3 부터 문턱 0.7 을 지나 1.0 까지
   */
  'render.photoShadeSteps': [0.3, 0.5, 0.7, 0.85, 1] as number[],
  /**
   * 업로드 폴더를 만들 곳 (결정 2026-10-18 · FR-PB-1). 사용자가 찾기 쉬운 곳 — 앱의 data/ 는 기본값으로 쓰지 않는다.
   * 「~」 는 홈 폴더. 화면에서 바꾸면 DB 에 저장
   */
  'publish.uploadRoot': '~/Downloads/FirstFeed',
  /**
   * 캡션 해시태그 상한 — 코드가 자른다(재작성 사유 아님). **공식 발표 · 도움말 원문 미확인**(결정 2026-10-18): 인스타 공식 @creators 의
   * Threads 발표(2025-12-18, 게시물·릴스 캡션 5개로 점진 적용) + 보도 여럿. 넘겼을 때 막는지·자르는지·댓글 해시태그도 세는지는 공식 설명 없음
   */
  'publish.maxHashtags': 5,
  /**
   * 발표용 「미리 만든 결과」 기준 시각(ISO, UTC) — 이 시각 이전에 만든 프로필·키트·카드 세트에 화면이 배지를 붙인다(결정 2026-10-18).
   * null 이면 표시 안 함. 「점검」 탭에서 켜고 끈다
   */
  'demo.premadeBefore': null as string | null,
  /** 30일 뒤 미리보기 격자 칸 수 = 처음 계획할 게시물 수. 인스타 프로필 격자 3열 × 3줄(사용자 지시 「첫 9개」, 결정 2026-10-21) */
  'preview.gridCells': 9,
  /** 캐러셀 최대 장수 — **확인됨**: 인스타 도움말 원문 "You can upload up to 20 photos and videos … as a single post"(help.instagram.com/269314186824048). 넘으면 업로드 폴더를 안 만든다(결정 2026-10-18) */
  'publish.maxCarousel': 20,
  /** 올리는 그림(프로필 사진 등) 최대 크기. 1080×1080 PNG 가 보통 1~3MB 라 넉넉히 */
  'brand.maxUploadBytes': 8 * 1024 * 1024,
  /**
   * 과제별 프롬프트 활성 버전. 없으면 v1.
   * self_review v2: 프로필의 축 겹침을 broken 으로 잡는다 (전후 측정 tests/results/2026-10-14-identity-v1-review-*.md, 결정 2026-10-14)
   * identity_profile v2 · identity_followup v2: 전후 측정 tests/results/2026-10-14-identity-{profile,followup}-v*.md (devlog 2026-10-14-01)
   * brand_visual v2 · brand_words_review v2: 전후 측정 tests/results/2026-10-14-brand-visualv{1,2}-reviewv{1,2}.md (devlog 2026-10-14-04)
   */
  'prompts.activeVersions': {
    self_review: 'v2',
    identity_profile: 'v2',
    identity_followup: 'v2',
    brand_visual: 'v2',
    brand_words_review: 'v2',
    // 첫 실제 실행에서 v1 의 "인용 밖 사실 = fact" 가 소재의 다른 곳에 있는 사실까지 막아 세트가 실패 (devlog 2026-10-15-02)
    // ~~card_body_review v2~~ → v3, card_body v1 → v2: 소재 밖 용어 풀이 표시(결정 2026-10-15 · 카드 풀이·그림 사람 규칙).
    // 측정 tests/results/2026-10-15-cards-gloss-v1-v2.md — v2 풀이 4개 모두 표시, 자기 평가 v3 고정 입력 8/8 (devlog 2026-10-15-04)
    // card_body v2 → v3 · card_body_review v3 → v4 · caption_min_review v1 → v2 (결정 2026-10-18 · A·B·C).
    // ~~측정 tests/results/2026-10-20-cards-real-v3.md(실제 소재 저장 6/6, 10-18 은 5/1)~~ — 그 회차는 옛 판으로 돈 측정이었다(파일 9줄 정정 메모).
    // 새 판으로 다시 잰 것: 2026-10-21-cards-real-v3.md · -gen-v3.md — 세트 저장/실패 실제 소재 5/1(옛 판 6/0) · AI 생성 6/0(옛 판 5/1),
    // 표지 약속 빠짐은 0 으로(목적 달성), 실제 소재에서 이어 붙인 인용이 늘어 원인은 확인 못 함 — 활성 판은 그대로 둔다(devlog 2026-10-18-03).
    // 감상: 2026-10-20-feeling-review*.md(v3·v1 놓침 → v4·v2 잡음, 과잉 0)
    card_body: 'v3',
    card_body_review: 'v4',
    caption_min: 'v1',
    caption_min_review: 'v2',
    // series_plan v1 → v3(사용자 결정 2026-10-22): v2 가 표지 제목답게 끌었지만 프로필에 없는 「자격증」이 나와, v3 에 근거 없는 사실(자격·경력·경험·성과) 금지 한 줄.
    // 같은 공개 fixture(me) 1회씩 — 규칙 첫 통과, v3 제목 9개에 지어낸 사실 없음(사람이 읽고 판정, devlog 2026-10-22-04)
    series_plan: 'v3',
  } as Record<string, string>,
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
  // 기본값이 null 인 설정(예: demo.premadeBefore)은 null 또는 문자열 — 처음엔 typeof null('object')과 비교해 문자열을 거절했다(화면 확인에서 500)
  const sameKind =
    fallback === null
      ? value === null || typeof value === 'string'
      : isPlainObject(fallback)
        ? isPlainObject(value)
        : Array.isArray(fallback)
          ? Array.isArray(value)
          : typeof value === typeof fallback;
  if (!sameKind) {
    throw new Error(
      `설정 "${key}" 의 값 형식이 맞지 않습니다 (기대: ${isPlainObject(fallback) ? '객체' : Array.isArray(fallback) ? '목록' : typeof fallback}). 값을 고쳐 다시 저장하세요.`,
    );
  }
  if (key === 'grounding.commonEnglish') {
    const bad = (value as Settings['grounding.commonEnglish']).filter((e) => !e?.term?.trim() || !e?.reason?.trim());
    if (bad.length) throw new Error(`영문 약어 허용 목록의 항목마다 약어와 이유 한 줄이 필요합니다 (${bad.length}개 빠짐). 이유를 적어 다시 저장하세요.`);
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

/** 근거 대조에서 통과시킬 흔한 영문 약어 (설정 grounding.commonEnglish 의 약어만) */
export function commonEnglishTerms(db: DatabaseSync | null, userId = 1): string[] {
  return getSetting(db, 'grounding.commonEnglish', userId).map((e) => e.term);
}
