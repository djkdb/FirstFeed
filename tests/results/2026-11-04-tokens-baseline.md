# 토큰 측정 · 2026-11-04 · baseline

- 고정 입력: 실제 · 공개 fixture me(설문 8 + 고정 질문 5 · 프로필 스냅숏 · 키트 · 시안 A) + 소재 ig-claude-code-skills · 2회
- 프롬프트: self_review@v2, identity_profile@v2, identity_followup@v2, brand_visual@v2, brand_words_review@v2, card_body@v3, card_body_review@v4, caption_min@v1, caption_min_review@v2, series_plan@v4
- 모델: smoke_extract=sonnet, smoke_context_probe=sonnet, identity_followup=sonnet, task_extract=sonnet, insight_read=sonnet, identity_profile=opus, identity_alternatives=opus, brand_words=opus, brand_visual=opus, cover_titles=opus, series_plan=opus, card_body=opus, reel_script=opus, caption_set=opus, caption_min=opus, self_review=opus
- CLI: claude 2.1.318 (Claude Code) · 클라우드 개발 컨테이너(--cloud-session)
- 입력 합 = 캐시 안 된 입력 + 캐시 쓰기 + 캐시 읽기. 비용은 CLI 가 적은 표시 가격(구독에서는 청구되지 않음 — 비교용)

## 고정 토큰 (아주 짧은 프롬프트 + 작은 스키마)

| 모델 | 입력 합 | 캐시 안 됨 | 캐시 쓰기 | 캐시 읽기 | 출력 | 시간 |
|---|---|---|---|---|---|---|
| sonnet | 3,288 | 2 | 807 | 2,479 | 52 | 5.8초 |
| sonnet | 3,288 | 2 | 807 | 2,479 | 52 | 2.8초 |
| opus | 3,357 | 2 | 802 | 2,553 | 52 | 4.2초 |
| opus | 3,359 | 2 | 804 | 2,553 | 52 | 8.8초 |

## 호출 종류별 평균 (호출 1번 기준)

| 과제 | 종류 | 모델 | 호출 수 | 입력 합 | 캐시 안 됨 | 캐시 쓰기 | 캐시 읽기 | 출력 | 시간 |
|---|---|---|---|---|---|---|---|---|---|
| brand_visual | generate | claude-opus-5-5 | 2 | 6,316 | 2 | 3,560 | 2,754 | 2,799 | 29.0초 |
| brand_words | generate | claude-opus-5-5 | 2 | 5,949 | 2 | 3,377 | 2,570 | 3,305 | 31.0초 |
| caption_min | generate | claude-opus-5-5 | 2 | 6,923 | 2 | 5,812 | 1,109 | 859 | 9.6초 |
| card_body | generate | claude-opus-5-5 | 2 | 7,194 | 2 | 5,960 | 1,232 | 3,475 | 32.1초 |
| card_body | rewrite | claude-opus-5-5 | 2 | 9,853 | 2 | 7,387 | 2,464 | 2,480 | 20.8초 |
| cover_titles | generate | claude-opus-5-5 | 2 | 5,656 | 2 | 3,229 | 2,425 | 2,125 | 23.6초 |
| identity_followup | generate | claude-sonnet-5-5 | 2 | 7,812 | 3 | 4,574 | 3,236 | 715 | 22.2초 |
| identity_profile | generate | claude-opus-5-5 | 2 | 5,922 | 2 | 3,361 | 2,559 | 3,053 | 28.6초 |
| identity_profile | rewrite | claude-opus-5-5 | 3 | 7,854 | 2 | 5,394 | 2,458 | 1,759 | 16.9초 |
| self_review ← brand_words | review | claude-opus-5-5 | 2 | 8,892 | 2 | 6,834 | 2,056 | 1,380 | 16.3초 |
| self_review ← caption_min | review | claude-opus-5-5 | 2 | 8,120 | 2 | 6,062 | 2,056 | 465 | 7.4초 |
| self_review ← card_body | review | claude-opus-5-5 | 3 | 10,405 | 2 | 8,347 | 2,056 | 1,247 | 12.8초 |
| self_review ← cover_titles | review | claude-opus-5-5 | 2 | 7,521 | 2 | 5,463 | 2,056 | 1,364 | 15.0초 |
| self_review ← identity_profile | review | claude-opus-5-5 | 5 | 7,736 | 2 | 6,089 | 1,645 | 1,855 | 20.0초 |
| series_plan | generate | claude-opus-5-5 | 2 | 5,885 | 2 | 3,343 | 2,540 | 2,579 | 28.7초 |
| series_plan | rewrite | claude-opus-5-5 | 2 | 6,541 | 2 | 4,484 | 2,055 | 839 | 9.7초 |

## 과제별 합 (1회 평균 — 생성 · 재작성 · 자기 평가 포함)

| 과제 | 호출 수 | 입력 합 | 출력 | 시간 | 1회 통과 | 재작성 | 코드 규칙 위반 |
|---|---|---|---|---|---|---|---|
| identity_followup | 1.0 | 7,812 | 715 | 22초 | 2/2 | 0·0 | 0·0 |
| identity_profile | 5.0 | 37,043 | 10,328 | 104초 | 0/2 | 1·2 | 0·0 |
| brand_words | 2.0 | 14,840 | 4,685 | 47초 | 1/2 | 0·0 | 1·0 |
| brand_visual | 1.0 | 6,316 | 2,799 | 29초 | 2/2 | 0·0 | 0·0 |
| series_plan | 2.0 | 12,426 | 3,418 | 38초 | 0/2 | 1·1 | 1·1 |
| cover_titles | 2.0 | 13,177 | 3,488 | 39초 | 1/2 | 0·0 | 0·1 |
| card_body | 3.5 | 32,654 | 7,824 | 72초 | 1/2 | 2·0 | 1·0 |
| caption_min | 2.0 | 15,042 | 1,324 | 17초 | 2/2 | 0·0 | 0·0 |

- 전체 1회 평균: 호출 18.5 · 입력 합 139,309 · 출력 34,579 · 표시 가격 $1.47 · 시간 368초

## 단계 결과

- 1회 followup: asked (34초)
- 1회 profile: saved · 재작성 1 (88초)
- 1회 words: 뺀 후보 1 · 재작성 0 (44초)
- 1회 visual: 뺀 후보 0 · 재작성 0 (30초)
- 1회 plan: 칸 9 · 재작성 1 (34초)
- 1회 cards: 표지 6개(뺀 0) · 재작성 0 / 본문 saved · 재작성 2 (145초)
- 1회 caption: saved · 재작성 0 (18초)
- 2회 followup: asked (11초)
- 2회 profile: failed · 재작성 2 (120초)
- 2회 words: 뺀 후보 0 · 재작성 0 (51초)
- 2회 visual: 뺀 후보 0 · 재작성 0 (28초)
- 2회 plan: 칸 9 · 재작성 1 (43초)
- 2회 cards: 표지 6개(뺀 1) · 재작성 0 / 본문 saved · 재작성 0 (87초)
- 2회 caption: saved · 재작성 0 (16초)
