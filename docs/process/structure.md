# 구조 점검 (점진적 개발의 「구조 악화」 확인용)

> 기준: 커밋 `6069973` 의 `server/src` · `app/src` (`.ts` `.tsx` 146개, 13,825줄) · 2026-10-18 · 고치지 않고 재기만 했다
> 다시 재는 명령은 문서 끝

## 1. 줄 수 상위 15개 파일

테스트 파일을 빼도 상위 14개가 같아서(15위만 다름) 한 표로 적는다.

| 순위 | 파일 | 줄 | 하는 일 |
|---|---|---|---|
| 1 | `app/src/cards/MakePage.tsx` | **466** | 「만들기」 탭 전체 — 소재·표지·본문·직접 줄이기·세트 보기·풀이 확인(GlossItem)·진행 표시(Progress) |
| 2 | `app/src/brand/BrandPage.tsx` | **369** | 「브랜드」 탭 — 글·시각 후보, 고르기, 고쳐 쓰기 |
| 3 | `server/src/cards/body.ts` | **352** | 카드 본문 — 스키마·규칙(고정·AI)·풀이 표시 규칙·렌더링·저장·직접 줄이기 |
| 4 | `server/src/identity/profile.ts` | 290 | 프로필 초안 생성·규칙 |
| 5 | `server/src/ai/providers/claude-code.ts` | 288 | Claude Code CLI 실행·구독 판정 |
| 6 | `server/src/ai/adapter.ts` | 279 | AI 어댑터(JSON·스키마·재요청·동시 호출·취소) |
| 7 | `server/src/config.ts` | 253 | 설정 기본값 한 곳 |
| 8 | `app/src/cards/PublishPanel.tsx` | 245 | 업로드 준비 패널 |
| 9 | `server/src/brand/visual.ts` | 242 | 팔레트·폰트·그림 프롬프트 규칙(사람 규칙 포함) |
| 10 | `server/src/identity/store.ts` | 223 | 정체성 DB 읽기·쓰기 |
| 11 | `app/src/identity/IdentityPage.tsx` | 214 | 「정체성」 탭 |
| 12 | `server/src/cards/store.ts` | 201 | 카드 DB·PNG 읽기·쓰기 |
| 13 | `server/src/cards/cards.browser.test.ts` (테스트) | 197 | 카드 흐름 브라우저 테스트 |
| 14 | `server/src/brand/words.ts` | 183 | 아이디·이름·바이오 후보 |
| 15 | `server/src/cards/covers.ts` | 181 | 표지 제목 후보 |

- 테스트를 빼면 15위는 `app/src/SmokeTest.tsx`(169)
- **300줄 넘는 파일: 3개**(위 1~3위, 모두 테스트 아님). 3개 모두 카드·브랜드 화면과 카드 본문 — 이번 라운드(10-15~10-18)에 기능이 계속 붙은 곳

## 2. import 관계 (상대 경로 import 를 실제 파일로 풀어서 셈)

### 가장 많이 import 되는 모듈 상위 10 (fan-in)

| 순위 | 모듈 | 전체 | 테스트 뺀 것 |
|---|---|---|---|
| 1 | `server/src/config.ts` | 43 | 30 |
| 1 | `server/src/db/index.ts` | 43 | 23 |
| 3 | `server/src/ai/adapter.ts` | 33 | 18 |
| 4 | `server/src/templates/types.ts` | 23 | 20 |
| 5 | `server/src/identity/store.ts` | 18 | 10 |
| 6 | `server/src/ai/testing/fake-provider.ts` | 15 | (테스트 전용) |
| 6 | `server/src/identity/model.ts` | 15 | — |
| 6 | `app/src/api.ts` | 15 | 15 |
| 9 | `server/src/ai/prompts.ts` | 12 | 11 |
| 9 | `server/src/rules/grounding.ts` | 12 | 10 |

- 테스트를 빼면 `rules/types.ts`(11)·`cards/store.ts`(10)이 상위 10에 들어온다
- 많이 불리는 쪽이 설정·DB·어댑터·타입·근거 규칙 — 규칙 문서(CLAUDE.md)가 「한 곳」으로 정한 것들이 실제로 한 곳으로 모여 있다는 뜻

### 한 파일이 import 하는 모듈이 많은 상위 10 (fan-out, 테스트 뺌)

| 순위 | 파일 | import 수 |
|---|---|---|
| 1 | `server/src/brand/words.ts` | 14 |
| 1 | `server/src/cards/context.ts` | 14 |
| 3 | `server/src/cards/body.ts` | 13 |
| 4 | `server/src/app.ts` | 12 |
| 4 | `server/src/brand/routes.ts` | 12 |
| 4 | `server/src/cards/routes.ts` | 12 |
| 4 | `server/src/cards/testing/setup.ts` | 12 |
| 8 | `server/src/brand/visual.ts` | 10 |
| 8 | `server/src/cards/covers.ts` | 10 |
| 8 | `server/src/identity/alternatives.ts` | 10 |

- `cards/context.ts` 는 카드 생성에 필요한 것(소재·프로필·고정 틀·근거 출처)을 한 곳에 모으려고 만든 파일이라 fan-out 이 큰 것이 설계대로다. `cards/body.ts` 는 fan-out(13)·줄 수(352)가 둘 다 상위 — 하는 일이 많다는 신호

## 3. 비슷한 코드가 반복되는 곳 (위치만)

| 모양 | 위치 | 몇 군데 |
|---|---|---|
| AI 진행 표시(호출 목록 `job.runs.map`) | `app/src/cards/MakePage.tsx`(Progress) · `app/src/brand/BrandPage.tsx` · `app/src/identity/IdentityPage.tsx` · `app/src/identity/Alternatives.tsx` · `app/src/SmokeTest.tsx` | 5 |
| 호출 종류 이름표 `RUN_LABEL` | `MakePage.tsx:41` · `BrandPage.tsx:15` · `IdentityPage.tsx:14` · `Alternatives.tsx:8` | 4 (내용 거의 같음) |
| 작업 ID 를 localStorage 에 넣고 빼기(try/catch 감싸기) | `MakePage.tsx`(load/save) · `BrandPage.tsx`(readJob/writeJob) · `Alternatives.tsx`(readKey/writeKey) | 3 |
| 문제 하나 만들기 `const issue = (where, code, message) => …` | `server/src/cards/covers.ts` · `cards/body.ts` · `brand/words.ts` · `brand/visual.ts` · `publish/caption.ts` | 5 |
| 근거 대조 도우미 `ground = (where, text) => …` | `cards/body.ts:112` · `publish/caption.ts:41` | 2 |
| 풀이 표시 규칙(문장이 글에 있나·용어가 소재에 있나) | `cards/body.ts`(glossIssues) · `publish/caption.ts`(captionRules 안) | 2 (메시지 문장까지 같음) |
| 라우트 머리 `const BRAND_ID = 1` · `const bad = …` | `identity/routes.ts` · `brand/routes.ts` · `templates/routes.ts` · `cards/routes.ts` · `publish/routes.ts` | 5 · 3 |
| 화면의 JSON POST `fetch(…, { method: 'POST', headers … })` | `app/src/cards/PublishPanel.tsx` · `cards/MakePage.tsx` · `brand/ProfileImage.tsx` | 3 |
| 측정 스크립트의 `--prompt 이름=판` 인자 읽기 | `scripts/eval-identity.ts` · `eval-followup.ts` · `eval-brand.ts` · `eval-cards.ts` · `eval-gloss-review.ts` | 5 |
| 브라우저 테스트의 「글자를 줄 단위로 모으기」(createTreeWalker) | `server/src/templates/templates.browser.test.ts` 한 파일 안에 3번 | 3 |

## 4. 리팩토링 후보 3개 (고치지 않음)

1. **화면의 「AI 작업」 묶음을 하나로 — 작업 ID 저장 + 진행 표시 + 사라진 작업 처리**
   - 위치: MakePage·BrandPage·IdentityPage·Alternatives(+SmokeTest)의 진행 표시 5벌, `RUN_LABEL` 4벌, localStorage 감싸기 3벌
   - 이유: 같은 일을 화면마다 따로 한다. 실제로 「끝난 작업 ID 를 조용히 지우기」(2026-10-18)를 고칠 때 **다섯 곳에 같은 처리를 넣어야 했다**(`dc694b8`). 다음에 작업 상태 규칙이 바뀌면 또 다섯 곳이다. `useStoredJob`(저장 키·onStale 포함)과 `JobProgress` 컴포넌트 하나로 모으면 화면마다 수십 줄씩 준다
2. **`server/src/cards/body.ts` 나누기 + 규칙 도우미 한 곳으로**
   - 위치: body.ts(352줄, fan-out 13)에 스키마·고정 규칙·AI 규칙·풀이 규칙·렌더링·저장·직접 줄이기가 다 있다. `issue()` 5벌, `ground()` 2벌, 풀이 규칙 2벌(카드·캡션)
   - 이유: 근거 규칙의 같은 함정(구조 숫자를 넓게 허용하면 지어낸 숫자가 숨는다)을 **세 번** 겪었다(카드 본문·표지·캡션, devlog 10-15-02 · 10-18-01). 규칙을 파일마다 따로 조립하니 한 곳에서 고친 것이 다른 곳에 안 옮겨 간다. `rules/` 에 「근거 대조 + 구조 숫자 정책 + 풀이 표시」 조립 함수를 두고 카드·표지·캡션이 같이 쓰게
3. **`app/src/cards/MakePage.tsx` 나누기 (466줄 → 화면 단위)**
   - 위치: 한 파일에 MakePage · SetView · GlossItem · Progress
   - 이유: 300줄 넘는 3개 중 가장 크고, 10-15 ~ 10-18 동안 세트 보기·그림 올리기·풀이 확인·업로드 패널이 계속 이 파일에 붙었다. 다음 기능(FR-MK-3 말로 고치기·FR-MK-7 캡션)도 세트 보기에 붙을 자리라 지금 크기에서 더 커진다. `SetView.tsx`·`GlossItem.tsx` 로 떼면 각 파일이 한 화면 일만 한다

- 후보에서 뺀 것: `config.ts`·`db/index.ts` 의 fan-in(43)이 큰 것은 「설정·DB 는 한 곳」 규칙대로라 악화가 아니다. 측정 스크립트 `--prompt` 5벌은 제품 코드가 아니라 우선순위를 낮췄다

## 5. 확인 못 한 것

- import 는 **상대 경로**만 셌다(패키지 import 제외). `import type` 도 import 로 셌다
- 「비슷한 코드」는 이름·모양으로 grep 해서 찾은 것이다 — 도구로 전수 비교(중복 탐지기)를 돌리지 않았다. 다른 반복이 더 있을 수 있다
- 줄 수는 빈 줄·주석 포함(`wc -l`). 이 레포는 주석이 「왜」를 길게 적는 편이라 코드 줄만 세면 더 작다

## 다시 재는 법

```bash
# 줄 수 상위 15 · 300줄 넘는 파일 수
find server/src app/src -name '*.ts' -o -name '*.tsx' | xargs wc -l | grep -v total | sort -rn | head -15
find server/src app/src -name '*.ts' -o -name '*.tsx' | xargs wc -l | grep -v total | awk '$1>300' | wc -l

# 반복 모양 찾기 (예)
grep -rln "const issue = (" server/src | grep -v test
grep -rn "RUN_LABEL\s*[:=]" app/src
grep -rln "a === '--prompt'" scripts
```

fan-in·fan-out 은 아래 스크립트(레포 루트에서 `node imports.mjs`): 각 파일의 `import … from './…'`·`export … from`·`import('./…')` 를 실제 경로로 풀어 셌다.

```js
import fs from 'node:fs';
import path from 'node:path';
const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e.name)) files.push(p); } };
['server/src', 'app/src'].forEach(walk);
const isTest = (f) => /\.test\.tsx?$/.test(f);
const fanIn = {}, fanInNoTest = {}, fanOut = {};
for (const f of files) {
  const deps = new Set();
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/(?:import|export)\s[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g))
    deps.add(path.normalize(path.join(path.dirname(f), m[1] ?? m[2])));
  fanOut[f] = deps.size;
  for (const d of deps) { fanIn[d] = (fanIn[d] ?? 0) + 1; if (!isTest(f)) fanInNoTest[d] = (fanInNoTest[d] ?? 0) + 1; }
}
const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log(top(fanIn), top(fanInNoTest), top(Object.fromEntries(Object.entries(fanOut).filter(([f]) => !isTest(f)))));
```
