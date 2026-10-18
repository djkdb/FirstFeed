# 프로세스 측정 (Sommerville 의 process metrics — 시간 · 자원 · 사건 수)

> 기준: 커밋 `0e3b741`(2026-10-13 21:26) ~ `6069973`(2026-10-18 01:20), **커밋 168개** · 세션 = devlog 파일 13개 · 시각은 모두 KST
> 이 문서를 만든 커밋들(docs/process/)은 측정에 넣지 않았다 — 끝 커밋을 `6069973` 으로 고정해 다시 재도 같은 숫자가 나오게
> FR 「끝남」 판정은 [status.md](status.md) 를 따른다(끝남 15개 · 근거 커밋)

## 1. 세션별 표

- **세션 경계**: devlog 파일이 처음 추가된 커밋이 그 세션의 끝, 앞 세션 끝 다음 커밋부터가 그 세션. 그래서 devlog 를 쓴 뒤의 정정 커밋(예: `f7bf0e4`, `82b5d2a`)은 **다음 세션**에 들어간다
- **근사 작업 시간**: 세션 안에서 이웃한 커밋 간격 중 **60분 이하인 것만 더한 값**. 60분 넘게 빈 곳은 쉬었다고 본다. 첫 커밋 전의 작업 시간은 셀 수 없어 빠진다 → **아래쪽 한계**(아래 2절의 교차 확인 참고)
- **걸친 시간**: 첫 커밋 ~ 마지막 커밋(쉰 시간 포함)
- **줄 수**: `git show --numstat` 의 텍스트 파일 줄(그림 등 바이너리 제외). 「코드」는 `server|app|scripts` 아래 `.ts .tsx .css .sql` + `prompts/`. 그 밖은 문서·측정 결과·테스트 자료

| 세션 (devlog) | 첫 커밋 ~ 마지막 커밋 | 근사 작업 시간 | 걸친 시간 | 커밋 | 끝낸 FR | 추가 / 삭제 (전체) | 추가 / 삭제 (코드) |
|---|---|---|---|---|---|---|---|
| [2026-10-13-01-PRD-질의응답과-규칙-문서](../devlog/2026-10-13-01-PRD-질의응답과-규칙-문서.md) | 2026-10-13 21:26 ~ 10-13 21:27 | 1분 | 1분 | 4 | — | +778 / −0 | +0 / −0 |
| [2026-10-13-02-뼈대와-AI-어댑터](../devlog/2026-10-13-02-뼈대와-AI-어댑터.md) | 2026-10-13 21:40 ~ 10-13 22:05 | 25분 | 25분 | 12 | FR-AI-4 | +7413 / −43 | +3137 / −7 |
| [2026-10-13-03-구독-경로-환경-변수와-정정](../devlog/2026-10-13-03-구독-경로-환경-변수와-정정.md) | 2026-10-13 22:15 ~ 10-13 22:17 | 2분 | 2분 | 3 | — | +185 / −7 | +101 / −5 |
| [2026-10-13-04-정체성-흐름](../devlog/2026-10-13-04-정체성-흐름.md) | 2026-10-13 22:43 ~ 10-14 10:23 | 47분 | 701분 | 14 | FR-ID-1 · FR-ID-2 | +3192 / −91 | +2653 / −89 |
| [2026-10-14-01-정체성-다듬기](../devlog/2026-10-14-01-정체성-다듬기.md) | 2026-10-14 10:39 ~ 10-14 11:19 | 40분 | 40분 | 11 | FR-ID-4 | +1264 / −142 | +575 / −139 |
| [2026-10-14-02-프로필-수정과-다른-방향](../devlog/2026-10-14-02-프로필-수정과-다른-방향.md) | 2026-10-14 11:31 ~ 10-14 16:14 | 19분 | 283분 | 11 | FR-ID-5 | +2121 / −61 | +1767 / −60 |
| [2026-10-14-03-브랜딩-키트](../devlog/2026-10-14-03-브랜딩-키트.md) | 2026-10-14 16:14 ~ 10-14 19:49 | 70분 | 215분 | 20 | FR-BR-1 · FR-BR-2 · FR-BR-3 · FR-ID-6 | +3393 / −37 | +2457 / −34 |
| [2026-10-14-04-브랜딩-다듬기](../devlog/2026-10-14-04-브랜딩-다듬기.md) | 2026-10-14 19:54 ~ 10-14 20:23 | 29분 | 29분 | 9 | — | +744 / −47 | +225 / −47 |
| [2026-10-15-01-템플릿](../devlog/2026-10-15-01-템플릿.md) | 2026-10-14 20:24 ~ 10-15 01:49 | 46분 | 325분 | 19 | FR-TP-1 · FR-TP-3 · FR-TP-4 | +3142 / −28 | +1818 / −17 |
| [2026-10-15-02-글-다듬기와-카드-계획](../devlog/2026-10-15-02-글-다듬기와-카드-계획.md) | 2026-10-15 02:02 ~ 10-15 04:10 | 68분 | 129분 | 26 | FR-MK-1 · FR-MK-2 · FR-MK-8 | +2755 / −102 | +2244 / −96 |
| [2026-10-15-03-카드-재측정과-화면-확인](../devlog/2026-10-15-03-카드-재측정과-화면-확인.md) | 2026-10-15 09:06 ~ 10-15 09:30 | 24분 | 24분 | 8 | — | +307 / −11 | +93 / −10 |
| [2026-10-15-04-카드-풀이와-그림-사람](../devlog/2026-10-15-04-카드-풀이와-그림-사람.md) | 2026-10-15 12:15 ~ 10-15 14:02 | 107분 | 107분 | 11 | — | +1054 / −41 | +530 / −39 |
| [2026-10-18-01-업로드-폴더](../devlog/2026-10-18-01-업로드-폴더.md) | 2026-10-18 00:31 ~ 10-18 01:20 | 49분 | 49분 | 20 | — | +2277 / −68 | +1782 / −66 |
| **합계** | 4일(10-13·14·15·18) | **527분 (8.8시간)** | — | **168** | **15** | **+28,625 / −678** | **+17,382 / −609** |

- 「끝낸 FR」이 없는 세션은 대부분 **다듬기·측정·결정 반영** 세션이다(10-14-04 브랜딩 다듬기, 10-15-03 재측정, 10-15-04 풀이 표시). 10-18-01 은 FR-PB-1 을 구현했지만 수용 기준이 사용자 확인 대기라 「진행」(status.md)
- 10-13-01 은 문서 4개를 한 분 안에 커밋해서 작업 시간이 1분으로 잡힌다 — 커밋 시각으로는 그 전 작업(PRD 질의응답)을 잴 수 없다

## 2. 교차 확인 — 대화 원본의 메시지 시각으로 잰 활동 시간

커밋 시각은 작업 뒤 몰아서 커밋한 시점이라(같은 분에 여러 개) 작업 시간을 적게 잰다. 대화 원본(`~/.claude/projects/-Users-lee-Claude-FirstFeed/6887510c-….jsonl`, 레포 밖)의 메시지 시각 12,525개로 같은 방법(이웃 간격 **30분 이하**만 더함)을 써 봤다.

| 날짜 | 대화 기준 활동 시간 |
|---|---|
| 2026-10-13 | 136분 |
| 2026-10-14 | 380분 |
| 2026-10-15 | 351분 |
| 2026-10-18 (01:20 까지) | 49분 |
| **합계** | **916분 (15.3시간)** — 커밋 기준(527분)의 **1.7배** |

- 대화 기준에는 AI 측정을 기다린 시간(백그라운드 실행 중 짧은 확인)이 들어간다. 사람이 손을 쓴 시간은 둘 사이 어딘가로 본다 — **확인 못 함**
- 아래 속도(3절)는 사용자가 요청한 대로 커밋 기준 작업 시간으로 계산했다. 대화 기준으로 바꾸면 시간당 FR 은 약 1/1.7

## 3. 속도 (velocity)

| 지표 | 평균 | 최소 | 최대 |
|---|---|---|---|
| 세션당 끝낸 FR | **1.15** (15 / 13) | 0 (6개 세션) | 4 (2026-10-14-03 브랜딩 키트) |
| 작업 시간(커밋 기준)당 FR — 세션별 평균 | **1.51 / 시간** | 0 | 3.91 (2026-10-15-01 템플릿) |
| 작업 시간당 FR — 전체 | **1.71 / 시간** (15 / 8.8시간) | — | — |
| 같은 값을 대화 기준 시간으로 | 0.98 / 시간 (15 / 15.3시간) | — | — |

- 세션별 시간당 FR(0 이 아닌 것): AI-4 세션 2.40 · 10-13-04 2.55 · 10-14-01 1.50 · 10-14-02 3.16 · 10-14-03 3.43 · 10-15-01 3.91 · 10-15-02 2.65
- M 20개 중 15개가 끝남 · 5개가 진행 — 남은 M 은 **확인·일부 기능**이라 FR 수로 세는 속도에는 잘 안 잡힌다

## 4. 재작업 비율

| 지표 | 값 |
|---|---|
| 제목에 정정·고침·되돌림·수정·fix 가 들어간 커밋 | **14 / 168 = 8.3%** |
| 제목 또는 본문에 들어간 커밋 | 38 / 168 = 22.6% (본문의 「직접 수정」 같은 기능 이름까지 잡혀 과대) |
| 제목 14개를 사람이 읽고 가린 실제 재작업 | **9 / 168 = 5.4%** — 오탐 5개: `8fcc1c6`·`99371b6`(기능 이름 「직접 수정」), `fc82605`(「새로고침」의 「고침」), `a6da2fd`(기능 「되돌림」), `9ee35dd`(결정 「FR-MK-8 되돌림」) |
| 키워드에 안 걸린 재작업(읽다가 본 것, 전수 아님) | `2bcf7ea` 「바로잡기」(적용된 마이그레이션 고친 실수) · `7cbe4f9` 「빠져 있었음」 · `95abe9a` 「빈틈」 · `71e1590`(시간 초과 늦던 문제) · `c2efdea`(선택이 사라지던 문제) · `dacf078`(박혀 있던 값) — 키워드 비율은 **아래쪽 한계** |
| CLAUDE.md 「겪은 오류」 건수 | **17건** (원인의 모양으로 적은 항목, `- **` 로 시작하는 줄) |

## 5. 시간대 분포 (커밋 시각 KST)

```
00시  13 █████████████████████
01시  25 ████████████████████████████████████████
02시  21 ██████████████████████████████████
03시   2 ███
04시   3 █████
05시   0
06시   0
07시   0
08시   0
09시  12 ███████████████████
10시  12 ███████████████████
11시  13 █████████████████████
12시   1 ██
13시   9 ██████████████
14시   1 ██
15시   0
16시  13 █████████████████████
17시   2 ███
18시   0
19시  12 ███████████████████
20시   5 ████████
21시  13 █████████████████████
22시  11 ██████████████████
23시   0
```

- **새벽 1~5시(01:00~04:59) 커밋: 51 / 168 = 30.4%**. 자정부터 치면(00:00~04:59) 64 / 168 = 38.1%
- 가장 많은 시각은 01시(25개). 새벽 측정 중 덮개가 닫혀 잠자기가 측정에 섞인 일(devlog 2026-10-15-02)도 이 시간대
- 커밋한 날은 4일(10-13·14·15·18)

## 6. 전체 검사 (`npm run check`) — 2026-10-18 16:01 KST, 코드는 `6069973` 그대로(문서만 추가된 상태)

결과: **통과 (종료 코드 0, 44초)**. 출력 그대로(색 코드와 테스트 한 줄씩 통과 표시 줄은 뺐다):

```
> check
> npm run lint && npm run typecheck && npm test
> lint
> eslint .
> typecheck
> tsc -p server --noEmit && tsc -p app --noEmit && tsc -p scripts --noEmit
> test
> vitest run --project unit && vitest run --project browser
 RUN  v5.0.4 /Users/lee/Claude/FirstFeed
 Test Files  43 passed (43)
      Tests  273 passed (273)
   Start at  16:01:51
   Duration  2.25s (tests 53%, import 41%, transform 5%, worker 1%)
 RUN  v5.0.4 /Users/lee/Claude/FirstFeed
 Test Files  8 passed (8)
      Tests  54 passed (54)
   Start at  16:01:53
   Duration  33.32s (tests 95%, import 4%)
npm run check  66.08s user 13.99s system 181% cpu 44.048 total
exit=0
```

- 린트·타입 체크(server · app · scripts)는 오류 없이 지나감(출력 없음)
- 단위 43파일 273개, 실제 브라우저 8파일 54개 통과. 실제 AI 를 부르는 테스트(`*.live.test.ts`)는 기본 실행에서 빠진다(CLAUDE.md)

## 7. 확인 못 한 것 · 한계

- 작업 시간은 두 방법 모두 **근사**다. 사람이 생각한 시간·AI 측정을 기다린 시간·쉰 시간을 가르지 못한다
- 세션 = devlog 파일로 잘라서, 한 devlog 가 여러 날에 걸친 경우(10-13-04 는 밤을 넘김)가 있다
- 재작업은 키워드 기준이 사용자 요청이고, 사람이 가린 숫자는 제목 14개만 읽은 결과다(168개 전수 판정 아님)
- 커밋 작성자는 모두 이 레포의 한 사람(+ Claude 공동 작성 줄) — 1인 개발이라 사람별 측정은 없다

## 다시 재는 법

```bash
# 0) 커밋 목록 (KST, 오래된 것부터) — 세션·시간대 표의 원자료
TZ=Asia/Seoul git log --reverse 6069973 --format='%h %ad %s' --date=format-local:'%Y-%m-%d %H:%M'

# 1) 시간대 히스토그램 (KST 시)
TZ=Asia/Seoul git log 6069973 --format='%ad' --date=format-local:'%H' | sort | uniq -c

# 2) 재작업 키워드 (제목)
git log 6069973 --format='%h %s' | grep -E '정정|고침|되돌림|수정|[Ff][Ii][Xx]' | wc -l

# 3) 커밋별 추가/삭제 줄 (바이너리는 '-' 로 나와 뺀다)
git log 6069973 --numstat --format='@%h' | awk -F'\t' '/^@/{h=$0;next} $1!="-" && NF==3 {a+=$1; d+=$2} END{print "+"a" -"d}'

# 4) 「겪은 오류」 건수
awk '/^## 겪은 오류/{f=1;next} f && /^- \*\*/{n++} END{print n}' CLAUDE.md

# 5) 세션 표·속도 전체: 아래 스크립트를 파일로 저장해
#    node metrics.mjs . frdone.json 6069973
#    frdone.json = status.md 의 「끝남」 근거 커밋 { "FR-AI-4": "5cecb95", "FR-ID-1": "3c2769b", … }
```

<details><summary>metrics.mjs (세션 표·속도·재작업·시간대를 한 번에)</summary>

```js
// 프로세스 측정: git 기록만으로. 사용: node metrics.mjs <레포 경로> <FR 끝남 근거 JSON> <끝 커밋>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const repo = process.argv[2];
const frDone = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : {};
const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 1 << 26 });
const SEP = '\u001e', FS = '\u001f';
const REV = process.argv[4] ?? 'HEAD';
const commits = git('log', '--reverse', REV, `--format=${SEP}%h${FS}%at${FS}%s${FS}%b`).split(SEP).filter(Boolean).map((r) => {
  const [h, t, s, b] = r.split(FS);
  return { h, t: Number(t), s, b: b.trim() };
});
for (const c of commits) {
  const ns = git('show', '--numstat', '--format=', c.h).trim().split('\n').filter(Boolean);
  c.add = 0; c.del = 0; c.addCode = 0; c.delCode = 0;
  for (const l of ns) {
    const [a, d, f] = l.split('\t');
    if (a === '-') continue;
    c.add += +a; c.del += +d;
    if (/^(server|app|scripts)\/.*\.(ts|tsx|css|sql)$/.test(f) || /^prompts\//.test(f)) { c.addCode += +a; c.delCode += +d; }
  }
}
const kst = (t) => new Date((t + 9 * 3600) * 1000).toISOString().slice(0, 16).replace('T', ' ');
const hourKst = (t) => new Date((t + 9 * 3600) * 1000).getUTCHours();
const devlogs = fs.readdirSync(`${repo}/docs/devlog`).filter((f) => /^\d{4}-\d{2}-\d{2}-\d{2}/.test(f)).sort();
const idx = (h) => commits.findIndex((c) => c.h === h);
const ends = devlogs.map((f) => ({ f, end: idx(git('log', REV, '--diff-filter=A', '--format=%h', '--', `docs/devlog/${f}`).trim().split('\n').pop()) })).filter((e) => e.end >= 0);
const sessions = [];
let start = 0;
for (const e of ends) { sessions.push({ f: e.f, cs: commits.slice(start, e.end + 1) }); start = e.end + 1; }
if (start < commits.length) sessions.push({ f: '(devlog 없음)', cs: commits.slice(start) });
const GAP = 60 * 60;
const work = (cs) => cs.slice(1).reduce((n, c, i) => { const g = c.t - cs[i].t; return n + (g <= GAP ? g : 0); }, 0);
const doneBy = {};
for (const [fr, h] of Object.entries(frDone)) doneBy[h] = [...(doneBy[h] ?? []), fr];
const out = { sessions: [], commits: commits.length };
for (const s of sessions) {
  const frs = s.cs.flatMap((c) => doneBy[c.h] ?? []);
  out.sessions.push({ f: s.f, n: s.cs.length, first: kst(s.cs[0].t), last: kst(s.cs.at(-1).t), workMin: Math.round(work(s.cs) / 60), spanMin: Math.round((s.cs.at(-1).t - s.cs[0].t) / 60), add: s.cs.reduce((n, c) => n + c.add, 0), del: s.cs.reduce((n, c) => n + c.del, 0), addCode: s.cs.reduce((n, c) => n + c.addCode, 0), delCode: s.cs.reduce((n, c) => n + c.delCode, 0), frs });
}
const RE = /정정|고침|되돌림|수정|fix/i;
out.reworkSubject = commits.filter((c) => RE.test(c.s)).map((c) => `${c.h} ${c.s}`);
out.reworkAny = commits.filter((c) => RE.test(c.s) || RE.test(c.b)).length;
out.hours = Array.from({ length: 24 }, (_, h) => commits.filter((c) => hourKst(c.t) === h).length);
console.log(JSON.stringify(out, null, 1));
```

</details>

대화 기준 활동 시간(2절)은 레포 밖 대화 원본이 필요하다: 각 줄의 `"timestamp"` 를 모아 정렬하고, 이웃 간격 30분 이하만 더했다(KST 날짜별).
