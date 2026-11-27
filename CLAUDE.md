# CLAUDE.md — 퍼스트피드(FirstFeed) 작업 규칙

> 모든 세션은 작업 전에 이 문서를 끝까지 읽고, **하려는 일과 관련된 결정을 [docs/decisions.md](docs/decisions.md)에서 찾아 읽는다**(2026-11-27 에 「이미 내린 결정」 · 「겪은 오류」를 따로 옮김 — 이 문서만으로는 결정이 보이지 않는다). 기획의 기준은 [docs/PRD.md](docs/PRD.md)다.
> 이 문서와 PRD가 부딪히면 **「이미 내린 결정」([docs/decisions.md](docs/decisions.md))이 우선**한다. PRD는 v0.2(2026-10-20 채택, 우선순위 M·F·S·W)이고, 그 뒤 질의응답으로 바뀐 내용은 decisions.md 에 먼저 적고 PRD 도 같이 맞춘다.

## 1. 프로젝트 한눈에

- **무엇**: 인스타를 처음 시작하는 사람이 정체성 찾기 → 브랜딩 → 템플릿 고정 → 소재 발굴 → 콘텐츠 생성 → 성과 분석 → 대외활동·협찬 관리까지 한 곳에서 하는 도구
- **핵심 가치**: 브랜드 프로필 하나가 모든 단계를 잇는다 · 근거 기반(원문에 없으면 코드가 되돌린다) · 사용자 본인의 AI 구독으로 돈다
- **형태**: 사용자 컴퓨터에서 도는 로컬 앱(웹 화면 + 로컬 서버) + 선택형 Supabase 동기화
- **AI**: 사용자 구독의 CLI(Claude Code · Codex · Gemini CLI)를 하위 프로세스로 호출, 없으면 API 키. **지금은 Claude Code CLI 하나로 끝까지** 만든다
- **대회**: CUVIC 바이브 코딩 대회(개인전, 자유 주제). 중간 발표 ~~**2026-11-03(가정, 확정 공지 전)**~~ → ~~**11-02(월) 또는 11-04(수), 확정 전 · 서면 평가 가능 · 보고서 PDF 5쪽 이내 필수**(2026-10-21 받은 공지). 일정은 **11-01 마감 기준**으로 본다~~ → **중간 평가는 서면 평가로 확정 — 제출물은 보고서 1부(PDF, 5쪽 이내), 기한 11월 4일(수) 23시, 운영진 개인 메시지로 제출**(2026-10-25 받은 공지, 아래 결정). 일정은 **11-04 마감 기준**, 보고서 최종본은 **11-03 까지** · 최종 발표 12월 말(→ 2026-11-20: 보고서는 11-04 에 레포 밖에서 고친 최종본 PDF 로 냈다 · 최종 발표 형식은 아직 공지 없음, 아래 결정)
- **심사 비중이 큰 것**: 중간 "AI 활용 계획" 40% · 최종 "프롬프팅·트러블슈팅" 40% → **만드는 과정의 기록이 결과물만큼 중요하다** (7장)

### 중간 발표까지의 범위 (PRD의 M 항목 — 중간 평가는 2026-11-04 보고서 제출로 끝남)
시연 흐름: **정체성 → 브랜딩 → 템플릿 고정 → 카드뉴스 1세트**

| 영역 | M 항목 |
|---|---|
| AI 연결 | FR-AI-1(CLI 확인·선택), FR-AI-2(어댑터), FR-AI-4(생성→검증→재작성 루프) |
| 정체성 | FR-ID-1(설문), FR-ID-2(인터뷰), FR-ID-4(프로필 초안), FR-ID-5(수정·되돌리기), FR-ID-6(프로필이 모든 생성의 입력) |
| 브랜딩 | FR-BR-1(이름·바이오), FR-BR-2(팔레트·명암비), FR-BR-3(폰트), FR-BR-4(프로필·하이라이트 시안 + 그림 프롬프트), **FR-BR-6(30일 뒤 내 계정 미리보기 — 2026-10-21 중간 보고서용으로 앞당긴 M)** |
| 템플릿 | FR-TP-1(기본 틀에 브랜드 입히기), FR-TP-3(고정), FR-TP-4(렌더링 넘침 검증) |
| 만들기 | FR-MK-1(카드뉴스), FR-MK-2(근거 대조), FR-MK-8(그림 프롬프트) |
| 발행·계정 | FR-PB-1(업로드 폴더), FR-AC-1(로그인 없이 로컬) |

- ~~**밀리면 이 순서로 F로 미룬다**: ① FR-BR-4 하이라이트 커버 → ② FR-ID-5 "다른 방향 2개 더"(수정·되돌리기는 유지) → ③ FR-MK-8 그림 끌어 놓기(프롬프트 뽑기는 유지) → ④ FR-AI-1 API 키 경로(안내만 남김)~~ → 2026-10-20: ②·③ 은 끝났고(FR-ID-5·MK-8 끝남, ③ 은 2026-10-18 에 되돌림), ④ 는 PRD v0.2 에서 FR-AI-7(S)로 분리됨
- **밀리면 이렇게 줄인다(PRD v0.2 9장)**: M 안에서는 ① FR-BR-4 하이라이트 커버 올리기를 F 로. 그 뒤로는 **M → F → S 순서**, **11월 15일까지 실사용자 2명이 시작 못 하면 성과 분석·대외활동을 성과 분석 하나로 합치고**, **11월 29일까지 FR-IN-2~6 이 안 끝나면 FR-OP-1·2·4·5 를 W 로** 옮긴다. W 는 지우지 않고 향후 계획으로 남긴다
  - → 2026-11-20: 11-15 조건은 실사용자 2명이 시작해 합치지 않는다. 11-29 조건은 그때 점검한다(아래 결정)
- **비목표**: 인스타 비공식 자동화(로그인 세션 조작·스크래핑·자동 팔로우 등) · AI 이미지 직접 생성(프롬프트만 뽑는다) · 인스타 외 플랫폼(**예외: 티스토리 자동 발행 · 리틀리 채우기 — 사용자 결정 2026-11-20, 아래**) · 결제

## 2. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 화면 | React 19 + TypeScript + Vite 8 | 서버 라우트 타입을 Hono RPC(`hc<AppType>`)로 가져와 쓴다 |
| 로컬 서버 | Node 24 + TypeScript + **Hono** 4 | `tsx` 로 실행. 127.0.0.1 에서만 열고 Host·Origin 검사 |
| 로컬 저장 | SQLite — **`node:sqlite`**(Node 내장) | DB 접근은 `server/src/db/` 한 곳. 마이그레이션은 번호 붙은 SQL 파일 |
| 스키마 | zod 4 | 정의 하나에서 TS 타입 · CLI 용 JSON Schema · 응답 검증 |
| 카드 렌더링 | HTML/CSS 템플릿 → Playwright 캡처 | 시안 11개(`server/src/templates/`). 브라우저는 앱이 내려받지 않는다(결정 2026-10-15) |
| 릴스 영상 | Remotion 4.0.541 + ffmpeg | 편집 화면 미리보기와 굽기가 같은 컴포지션(결정 2026-11-06) |
| AI | Claude Code CLI (`claude -p`) | Codex·Gemini(FR-AI-6)·API 키(FR-AI-7)는 S — 기본 흐름이 끝난 뒤 |
| 도구 | TypeScript **6.0.3**(7 아님) · ESLint 10 · Vitest 5 · npm workspaces | 보조 스크립트는 `node scripts/x.ts` 로 바로 실행(Node 24 타입 제거) |
| 동기화 | Supabase | F (중간 발표 이후) |

## 3. 폴더 구조

```
app/                    화면 (React + Vite)
  src/api.ts            타입을 쓰는 서버 호출(Hono RPC, AI 작업 폴링 useJob.ts 포함). 파일 올리기와 일부 화면 요청
                        (블로그 작업 blog/useBlogJob.tsx · 홈 · 업로드 · 폰으로 받기 · 채팅 · 미리보기 · 릴스 미디어)은
                        화면별 도우미가 fetch 를 직접 쓴다(결정 2026-11-20)
  src/<화면>/           identity · brand · templates · cards · preview · home · reels · blog · insights(성과) · settings(설정 탭) · console
server/src/
  index.ts              서버 시작점 (127.0.0.1:4317)
  app.ts                라우트 정의 + AppType 내보내기
  config.ts             설정 기본값의 유일한 출처 + getSetting()/modelForTask()
  db/                   연결 · 마이그레이션 (migrations/NNN_이름.sql)
  ai/                   AI 어댑터 · 생성→규칙→자기 평가 루프 · 작업(취소) · 공급자(providers/)
  rules/                근거 규칙(grounding) · 기준일 숫자(dated) · 글자 유사도(similarity)
  identity/ brand/      정체성(설문 · 인터뷰 · 프로필 · 다른 방향) / 브랜딩 키트 · 폰트 목록 · 개성 캐릭터
  templates/ render/    시안 A~K · 고정 판 / Playwright 렌더링 · 넘침 · 명암비 측정
  cards/                카드뉴스(표지 · 본문 · 풀이 · 채팅으로 고치기 · 표지 그림 · 본문 사진)
  preview/ home/        30일 뒤 미리보기(계획 · 격자 · 공유 이미지) / 「오늘 올릴 것」
  publish/              업로드 폴더 · 캡션 · 폰으로 받기 · blog/(티스토리 발행 · 리틀리 채우기)
  insights/             성과 분석 — metricool/(OAuth · MCP 클라이언트 · 도구 결과 읽기) · 불러오기 · 분석 · 잇기 후보 · 제안 · 수락
  reels/                릴스 편집 · 모션 · 영상 뽑기 · 받아쓰기
  secrets/              OS 키체인 저장(토큰 · API 키)
  console/ demo/ tasks/ 작업 콘솔 / 「미리 만든 결과」 / 스모크 과제
  lib/redact.ts         개인정보·비밀 값 찾기/가리기 — 내보내기와 check:privacy 가 같이 쓴다
  lib/                  그 밖에 local-only(Host·Origin 검사) · process · sleep-clock
prompts/<이름>/vN.md    프롬프트. 기존 파일을 고치지 않고 새 버전을 만든다. 활성 버전은 설정 'prompts.activeVersions'
tests/fixtures/
  real/                 실제 · 공개 — 운영자 본인 인터뷰 답변, 본인 계정 소재·원문
  private/              실제 · 비공개 — 지인 인터뷰, 대외활동 공지 (.gitignore, 커밋 금지)
  private.manifest.json 비공개 자료의 파일 목록·건수만 (내용 없음)
  generated/            AI 생성 보충 자료
tests/results/          측정 표 — 실제·공개 / 실제·비공개(숫자만) / AI 생성 으로 나눈다
references/             디자인 참고 자료 — 운영자 계정의 카드 템플릿 코드 card.html.j2 (따라 하지 말고 참고만)
site/                   소개 페이지(정적 파일, GitHub Pages)
docs/PRD.md · docs/devlog/ · docs/process/ · docs/contest/ · docs/service/ · docs/spec/(2026-10-20 스냅숏)
scripts/                doctor · check-privacy · check-offline · fixtures-manifest · export-transcripts · export-demo-site
                        · setup-git-hooks · eval-*(측정) · ai-*-probe · probe-*(실험) · compare-plain-ai · make-test-images
.githooks/pre-commit    커밋 전: 개인정보 검사 → 린트 → 타입 체크 → 테스트
.github/workflows/      ci.yml(푸시 뒤 린트 · 타입 체크 · 단위 테스트 · 전체 개인정보 검사 — 브라우저 테스트 제외) · pages.yml(소개 페이지)
privacy-allowlist.json  개인정보 검사 오탐 허용 목록 (항목마다 이유 한 줄 필수)
data/                   로컬 DB 등 (.gitignore)
exports/                대화 원본 내보내기 결과 (.gitignore)
```

## 4. 실행 · 테스트 명령

| 하는 일 | 명령 |
|---|---|
| 설치 (커밋 전 훅도 같이 켜짐) | `npm install` |
| 설치 점검 (구독 사용량 없음) | `npm run doctor` — Node · 의존성 · Claude Code 설치·로그인·구독(앱 감지 코드 그대로) · 렌더링 브라우저 · 포트, 문제마다 다음 할 일(FR-AC-6) |
| 개발 실행 (서버 4317 + 화면 5173) | `npm run dev` → http://localhost:5173 |
| 린트 · 타입 체크 · 테스트 한 번에 | `npm run check` |
| 린트 / 타입 체크 / 테스트 | `npm run lint` / `npm run typecheck` / `npm test` |
| 실제 AI 호출 시험 (구독 사용량 듦) | 화면의 「AI 시험 호출」(생성→규칙→자기 평가, 취소 가능) · `npm run ai:probe` (CLAUDE.md 섞임 대조 실험) |
| 공개 레포 개인정보 검사 | `npm run check:privacy` (커밋 때는 훅이 `--staged` 로 자동 실행) |
| 오프라인 동작 확인 (macOS, 구독 사용량 없음) | `npm run check:offline` — sandbox-exec 로 바깥 연결만 막고 테스트(가짜 AI) · 로컬 서버 · 화면이 응답하는지(FR-AC-1). 먼저 차단이 실제로 걸렸는지 확인 |
| 비공개 자료 목록 갱신 | `npm run fixtures:manifest` |
| 대화 원본 내보내기 (제출용) | `npm run export:transcripts -- <세션ID>` 또는 `--latest` / `--all` → `exports/` |
| 정체성 프로필 측정 (구독 사용량 듦) | `npm run eval:identity -- --repeat=2 --prompt identity_profile=v2 --label=profile-v2` (`--only=me`) → `tests/results/<날짜>-identity-<이름>.md` (실제·공개 / 실제·비공개 / AI 생성으로 나눔) |
| 꼬리질문 측정 (구독 사용량 듦) | `npm run eval:followup -- --repeat=2 --prompt identity_followup=v2 --label=followup-v2` — 고정 세트 + 함정 시나리오(`tests/fixtures/generated/followup`) |
| 다른 방향 측정 (구독 사용량 듦) | `npm run eval:alternatives` — 사람마다 지금 판을 만들어 확정한 뒤 두 방향 요청. 결과에 지금 판·두 방향의 축 목록 본문을 함께 쓴다 |
| 브랜딩 키트 측정 (구독 사용량 듦) | `npm run eval:brand -- --snapshot`(프로필 스냅숏, 없는 사람만) → `npm run eval:brand -- --runs=2` · `--reflect=me`(FR-ID-6: 말투·축 바꾸기 전/후 바이오). 오래 걸리는 측정은 `caffeinate -i` 로 감싸고 덮개를 연 채로 |
| 템플릿 넘침 측정 (구독 사용량 없음, 기준 브라우저 필요) | `npm run eval:templates` — 시안 × 브랜드(tests/fixtures/*/brands) × 넘침 테스트 세트 → `tests/results/<날짜>-templates/<시안>-<브랜드>/*.png`(`_sheet.png` 한눈에 보기) + 요약 표. 판정 통과인데 잘린 PNG 가 없는지 직접 열어 대조 |
| 렌더링 브라우저 준비 (처음 한 번) | `npx playwright install chromium` — 앱은 브라우저를 내려받지 않는다. 테스트 중 실제 브라우저로 그리는 것은 `*.browser.test.ts`(단위 테스트 뒤에 파일 하나씩) |
| 토큰 측정 (구독 사용량 듦) | `npm run eval:tokens -- --runs=2 --label=<이름>` (`--overhead-only` 고정 토큰만 · `--steps=visual,plan` · `--model 과제=sonnet` · `--prompt 이름=vN`) → `tests/results/<날짜>-tokens-<이름>.md`·`.json`. 클라우드 개발 컨테이너에서만 `--cloud-session` |
| 릴스 영상 뽑기 (구독 사용량 없음) | 화면 「릴스 만들기」 → 「영상 뽑기」(720 · 1080 · 4K) — 렌더링 브라우저는 `npx playwright install chromium` 이 깐 것을 쓴다(앱이 받지 않음). 음량 맞추기(−14 LUFS)는 ffmpeg 가 있을 때만, 받아쓰기는 `pip install faster-whisper` 를 한 사람만(선택) |
| 노력 단계별 응답 시간 측정 | `npm run ai:effort -- --fixture=seoyeon --levels=default,low,medium,high --repeat=2` |
| 카드뉴스 측정 (구독 사용량 듦) | `npm run eval:cards -- --runs=2` (`--only=소재` · `--set=real` · `--caption` · `--label=` · `--prompt 이름=vN`) — 소재 × 짝 브랜드: 표지 후보 → 첫 후보 → 본문 → 세트. → `tests/results/<날짜>-<label>.md` + 카드 PNG(사람이 열어 본다) |
| 풀이 표시 자기 평가 측정 (구독 사용량 듦) | `npm run eval:gloss-review -- --runs=2` — 본문은 고정 입력, 자기 평가만 실제 AI(재작성 0회) → `tests/results/<날짜>-gloss-review.md` |
| 지어낸 감상 자기 평가 측정 (구독 사용량 듦) | `npm run eval:feeling-review -- --runs=2` — 카드 · 캡션 고정 입력, 자기 평가만 실제 AI → `tests/results/<날짜>-feeling-review.md` |
| 릴스 모션 제안 측정 (구독 사용량 듦) | `npm run eval:motion -- --runs=2 --label=v1` (`--prompt reel_motion=v2` · `--no-render` · `--cloud-session`) — 통과한 첫 제안은 720 으로 뽑아 프레임 판(`_sheet.png`) → `tests/results/<날짜>-reel-motion-<label>.*` |
| 인터뷰 다양화 측정 (구독 사용량 듦) | `npm run eval:interview -- --turns=6 --label=v2-v3` (`--profile` · `--until-profile` · `--only=` · `--versions=v2:v2,v3:v3`) — 답은 가상 응답자(AI 생성) → `tests/results/<날짜>-interview-sim-<label>.*` |
| 개성 캐릭터 추천 측정 (구독 사용량 듦) | `npm run eval:character -- --runs=1 --label=v1` → `tests/results/<날짜>-character-<label>.*` |
| 소개 페이지 데모 내보내기 (구독 사용량 없음) | `npm run export:demo-site` — DB 에서 `site/data/demo.json` · `site/img/` 를 만든다. **지금 소개 페이지(운영자 계정 예시, 결정 2026-11-04)를 가상 사용자로 덮어쓰니 돌리지 않는다** |

## 5. 작업 규칙

### 코드
- **언어**: 변수·함수·파일 이름은 영어. 화면 글자 · 주석 · 로그 · 커밋 메시지는 **한국어**
- **주석은 "무엇"보다 "왜"**. 코드를 읽으면 알 수 있는 것은 적지 않는다
- **설정값은 설정 파일 한 곳**. 기본값은 설정 파일, 사용자가 화면에서 바꾼 값만 DB에 덮어 저장, 설정을 읽는 함수는 하나. 코드 안에 숫자·기준값을 흩어 두지 않는다
- **프롬프트는 `prompts/` 에 파일로 분리**. 코드 안에 프롬프트 문장을 쓰지 않는다. 프롬프트를 바꿀 때는 기존 파일을 고치지 않고 새 버전 파일(v2.md…)을 만든다 → 전/후 비교가 가능해야 한다
- **비밀 값**: `.env` 는 개발자용 값에만 쓰고 커밋하지 않는다. 사용자가 앱 화면에서 넣는 API 키·토큰은 **OS 키체인**에 저장한다
- **오류 메시지에는 "다음에 뭘 하면 되는지"를 적는다**. 예: "Claude Code에 로그인되어 있지 않습니다. 터미널에서 `claude` 를 실행해 로그인한 뒤 [다시 확인]을 누르세요"
- **모르는 값은 `null`**. 0이나 빈 문자열로 채우지 않는다 (PRD 5장)
- 반쯤 만든 결과는 저장하지 않는다. 실패하면 중간 상태 없이 되돌린다

### AI 호출
- 모든 AI 호출은 **어댑터 한 곳**을 거친다. 요청 `{task, prompt, schema, images, web, timeout}` → 응답: 검증된 JSON
- CLI는 **`--safe-mode` + 빈 임시 폴더**에서 실행한다. 이 레포 안에서 그냥 실행하면 개발용 CLAUDE.md가 앱의 프롬프트에 섞인다 (`--bare` 는 구독 로그인을 못 써서 사용 불가)
- 모델은 과제별 설정(`ai.taskModels`)을 따른다. 동시 호출 수(`ai.concurrency`)를 넘기면 줄을 세우고, 실행 중 호출은 취소할 수 있어야 한다
- **도구 권한 최소화**: 기본은 도구 전부 끔. 웹 검색이 필요한 호출만 검색 도구, 이미지가 필요한 호출만 읽기 도구. 파일 쓰기·명령 실행은 절대 열지 않는다
- 흐름: **생성 → 규칙 검증(코드) → 자기 평가(AI) → 필요하면 재작성**
  - 재시도 횟수: JSON·스키마 깨짐 → 다시 요청 **1회** / 규칙 위반 → 재작성 **2회** (둘 다 설정값)
  - 재작성 사유는 두 가지뿐: **코드 규칙 위반**, 자기 평가가 **"사실 오류" 또는 "깨짐"** 으로 판정. 그 밖의 지적(말투·취향)은 **경고만**
  - 규칙을 통과하지 못한 결과는 저장하지 않는다. 재시도 이력은 로그에 남긴다

### 근거 규칙 (지어내기 방지는 코드로)
- 콘텐츠 속 **숫자 · 버전 · 날짜 · 영문 이름**이 아래 **허용 출처 4가지** 어디에도 없으면 재작성:
  1. 소재 원문 2. 브랜드 프로필·브랜딩 키트 3. 구조에서 나온 숫자(카드 장수 등) 4. 사용자가 직접 입력한 문장(인터뷰 답변·메모)
- 숫자는 표기를 맞춰 비교한다 (`1,500` = `1500`). **한글 수사("다섯 가지")는 지금은 검사하지 않는다** — 문제가 생기면 「겪은 오류」([docs/errors.md](docs/errors.md))에 남기고 추가
- **인용(evidence·quote) 일치 기준**: 공백·문장부호를 정리한 뒤 원문의 부분 문자열인지 확인. 설문 답은 `관심 분야: AI 도구` 같은 "라벨: 답" 문장을 원문으로 쓰고, 프롬프트에도 같은 줄을 보인다. 라벨만 옮긴 인용은 근거가 아니다(`label_only_quote`)
- 원문에 실제로 있는지 코드가 확인한 인용만 저장한다
- **알려진 한계** (`server/src/rules/grounding.ts` 첫 버전) — 지금은 **자기 평가(AI)가 이 빈틈을 맡는다**. 규칙만 통과했다고 "사실이 맞다"고 말하지 않는다
  - **숫자는 원문 어딘가에 있는지만 본다** — 원문의 "120개"를 엉뚱한 사실("팔로워 120명")에 붙여도 통과한다
  - **영문 이름은 대소문자 무시 부분 문자열 비교** — 원문에 "ChatGPT" 가 있으면 "GPT"·"Chat" 도 통과하고, 원문 속 긴 단어의 일부면 다른 이름이어도 통과한다
  - **한글 고유명사(사람·가게·기관 이름)와 한글 수사는 검사하지 않는다** — "김하늘"을 "김하나"로 바꿔도 코드는 못 잡는다
    - 단, **개수 표현("다섯 가지"·"3단계")은 카드 수와 맞추는 구조 규칙이 확인한다**(결정 2026-10-15 · FR-MK-1). 그 밖의 한글 수사는 여전히 검사 밖
  - **기준일 숫자(결정 2026-10-18 · B)는 「날짜 + 기준」이 있는 같은 줄의 숫자만 묶는다** — 기준일이 다른 줄에 있으면 못 묶고, 날짜 없는 「현황판 기준」은 기준일로 보지 않으며, 같은 줄의 「최근 7일」 7 처럼 기간 숫자도 같이 묶인다
  - 인용 일치는 문장부호·공백을 지운 문자 비교라 원문에서 **떨어진 두 문장을 이어 붙인 인용**은 실패하고(붙어 있는 두 문장은 통과), 원문의 **아주 짧은 조각**(예: "열었다")은 근거가 약해도 통과한다
  - 한계를 실제로 겪으면 「겪은 오류」([docs/errors.md](docs/errors.md))에 남기고, 테스트 세트에서 빈도를 잰 뒤 규칙을 보강한다

## 6. 검증 규칙 — "에러 없이 돌았다"는 완료가 아니다

- **화면은 직접 열어 확인**한다. 카드·표지 **이미지는 파일을 열어 눈으로** 확인한다 (글자 잘림·겹침·가림 영역)
- **AI 출력은 규칙 검증을 통과해야 저장**한다. "JSON이 나왔다"는 완료가 아니다
- 완료를 보고할 때는 **무엇을 실행해서 무엇을 봤는지**를 적는다. 확인하지 못한 것은 "확인 못 함"이라고 적는다
- 실패하면 실패했다고 그대로 보고하고, 원인을 고친 뒤 다시 시도한다
- 기준값(유사도 임계치 등)은 감으로 정하지 않고 **테스트 세트로 재서** 정한다. 그 과정을 devlog에 남긴다
- 측정 결과는 **실제·공개 / 실제·비공개 / AI 생성** 세 갈래로 나눠 보고한다. 비공개 결과에는 숫자만 적는다

## 7. 진행 · 기록 · 커밋

- **큰 작업은 계획을 먼저 보여주고** 사용자가 확인한 뒤 구현한다
- **지어내지 않는다**. CLI 옵션·API 사양·라이선스는 `--help`·공식 문서·원문으로 확인하고, 확인 못 했으면 모른다고 말한다
- 범위가 커지면 S → (1장의 미루는 순서) 로 뺀다
- **세션 기록**: 세션이 끝나기 전에 `docs/devlog/` 에 기록을 남긴다 → 양식과 방법은 [docs/devlog/README.md](docs/devlog/README.md)
  - 한 일 · 결정(+이유) · 오류 → 원인 → 해결 · 프롬프트를 바꿨다면 전/후 · 이유 · 측정 결과
  - 오래 유지될 결정은 [docs/decisions.md](docs/decisions.md)(「이미 내린 결정」)에, 다시 겪을 수 있는 오류는 [docs/errors.md](docs/errors.md)(「겪은 오류」)에도 올린다
- **커밋**: 한 커밋에 한 가지 변경. 메시지는 한국어로 첫 줄에 무엇을, 본문에 왜를 적는다
- 대화 원본은 레포에 넣지 않는다. devlog에는 요약과 세션 ID만 남기고, 제출용 원본은 내보내기 스크립트로 꺼낸다(키·토큰·이메일·전화번호 가림)
- **이 레포는 공개(public)다**. 지인 인터뷰·대외활동 공지는 `tests/fixtures/private/` 에만 두고 목록만 공개한다. 공개 쪽 자료를 넣은 뒤에는 `npm run check:privacy`, 이미지는 직접 열어 확인한다
- 커밋 전 훅을 `--no-verify` 로 건너뛰었다면 devlog 에 이유를 남긴다


---

## 결정 · 오류 문서

- **[docs/decisions.md](docs/decisions.md) — 이미 내린 결정**(날짜 절마다 결정 · 이유 · devlog 링크). 이 문서와 PRD 보다 우선한다. 결정을 뒤집을 때는 지우지 말고 줄을 그은 뒤 새 결정을 아래에 적는다
- **[docs/errors.md](docs/errors.md) — 겪은 오류**(원인의 모양 → 증상 → 해결 → 다시 안 겪으려면)

## 자주 걸리는 오류 5개 (요약 — 전문은 docs/errors.md)

1. **기억해서 돌리는 검사는 빠진다** — 린트 · 타입 체크 · 테스트 · 개인정보 검사는 커밋 전 훅이 종료 코드로 막는다. `--no-verify` 로 건너뛰면 devlog 에 이유
2. **검사 결과를 파이프로 거르면 실패가 가려진다** — `… | grep Tests` 는 실패해도 성공으로 끝난다. 종료 코드를 따로 본다
3. **이미 적용된 마이그레이션 파일은 고치지 않는다** — 새 DB 에선 되고 쓰던 DB 에선 안 된다. 바꿀 것은 새 번호 파일로(004 결함도 024 로 고쳤다)
4. **문자열 치환은 바꿀 자리를 먼저 확인한다** — 못 찾으면 조용히 넘어간다. `assert s.count(old) == 1` 뒤에만 바꾼다
5. **바깥 서비스 값의 모양을 짐작하지 않는다** — 실제 응답 한 번을 받아 그 모양으로 테스트를 쓰고, 시각 · 단위는 다른 출처와 대조한다(Metricool 시각 9시간)
