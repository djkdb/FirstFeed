# 토큰 측정 · 2026-11-04 · after-step1

- 고정 입력: 실제 · 공개 fixture me(설문 8 + 고정 질문 5 · 프로필 스냅숏 · 키트 · 시안 A) + 소재 ig-claude-code-skills · 2회
- 프롬프트: self_review@v2, identity_profile@v2, identity_followup@v2, brand_visual@v2, brand_words_review@v2, card_body@v3, card_body_review@v4, caption_min@v1, caption_min_review@v2, series_plan@v4
- 모델: smoke_extract=sonnet, smoke_context_probe=sonnet, identity_followup=sonnet, task_extract=sonnet, insight_read=sonnet, identity_profile=opus, identity_alternatives=opus, brand_words=opus, brand_visual=opus, cover_titles=opus, series_plan=opus, card_body=opus, reel_script=opus, caption_set=opus, caption_min=opus, self_review=opus
- CLI: claude 2.1.318 (Claude Code) · 클라우드 개발 컨테이너(--cloud-session)
- 입력 합 = 캐시 안 된 입력 + 캐시 쓰기 + 캐시 읽기. 비용은 CLI 가 적은 표시 가격(구독에서는 청구되지 않음 — 비교용)

## 고정 토큰 (아주 짧은 프롬프트 + 작은 스키마)

| 모델 | 입력 합 | 캐시 안 됨 | 캐시 쓰기 | 캐시 읽기 | 출력 | 시간 |
|---|---|---|---|---|---|---|
| sonnet | 2,167 | 2 | 807 | 1,358 | 52 | 2.1초 |
| sonnet | 2,168 | 2 | 808 | 1,358 | 52 | 4.3초 |
| opus | 2,162 | 2 | 804 | 1,356 | 52 | 4.2초 |
| opus | 2,163 | 2 | 805 | 1,356 | 52 | 2.4초 |

## 호출 종류별 평균 (호출 1번 기준)

| 과제 | 종류 | 모델 | 호출 수 | 입력 합 | 캐시 안 됨 | 캐시 쓰기 | 캐시 읽기 | 출력 | 그중 생각 | 시간 |
|---|---|---|---|---|---|---|---|---|---|---|
| brand_visual | generate | claude-opus-5-5 | 2 | 5,112 | 2 | 2,955 | 2,156 | 2,763 | 1,005 | 29.0초 |
| brand_words | generate | claude-opus-5-5 | 2 | 4,748 | 2 | 2,775 | 1,971 | 3,102 | 1,110 | 29.8초 |
| caption_min | generate | claude-opus-5-5 | 2 | 5,559 | 2 | 5,047 | 511 | 887 | 445 | 9.1초 |
| card_body | generate | claude-opus-5-5 | 2 | 5,991 | 2 | 5,356 | 634 | 2,775 | 1,237 | 24.9초 |
| card_body | rewrite | claude-opus-5-5 | 2 | 7,836 | 2 | 6,567 | 1,267 | 1,776 | 290 | 14.1초 |
| cover_titles | generate | claude-opus-5-5 | 2 | 4,458 | 2 | 2,630 | 1,826 | 2,085 | 880 | 22.6초 |
| identity_followup | generate | claude-sonnet-5-5 | 2 | 4,078 | 2 | 2,442 | 1,634 | 638 | 248 | 6.7초 |
| identity_profile | generate | claude-opus-5-5 | 2 | 4,729 | 2 | 2,766 | 1,961 | 2,975 | 1,392 | 26.1초 |
| self_review ← brand_words | review | claude-opus-5-5 | 2 | 7,428 | 2 | 6,567 | 859 | 1,382 | 1,058 | 14.2초 |
| self_review ← caption_min | review | claude-opus-5-5 | 2 | 6,777 | 2 | 5,916 | 859 | 522 | 370 | 6.8초 |
| self_review ← card_body | review | claude-opus-5-5 | 2 | 8,483 | 2 | 7,622 | 859 | 1,047 | 721 | 12.2초 |
| self_review ← cover_titles | review | claude-opus-5-5 | 2 | 6,270 | 2 | 5,409 | 859 | 1,046 | 730 | 11.4초 |
| self_review ← identity_profile | review | claude-opus-5-5 | 2 | 6,477 | 2 | 6,045 | 430 | 1,917 | 1,408 | 19.6초 |
| series_plan | generate | claude-opus-5-5 | 2 | 4,689 | 2 | 2,746 | 1,942 | 2,645 | 2,191 | 26.5초 |

## 과제별 합 (1회 평균 — 생성 · 재작성 · 자기 평가 포함)

| 과제 | 호출 수 | 입력 합 | 출력 | 시간 | 1회 통과 | 재작성 | 코드 규칙 위반 |
|---|---|---|---|---|---|---|---|
| identity_followup | 1.0 | 4,078 | 638 | 7초 | 2/2 | 0·0 | 0·0 |
| identity_profile | 2.0 | 11,205 | 4,892 | 46초 | 2/2 | 0·0 | 0·0 |
| brand_words | 2.0 | 12,176 | 4,484 | 44초 | 1/2 | 0·0 | 0·0 |
| brand_visual | 1.0 | 5,112 | 2,763 | 29초 | 2/2 | 0·0 | 0·0 |
| series_plan | 1.0 | 4,689 | 2,645 | 26초 | 2/2 | 0·0 | 0·0 |
| cover_titles | 2.0 | 10,728 | 3,131 | 34초 | 0/2 | 0·0 | 1·2 |
| card_body | 3.0 | 22,309 | 5,598 | 51초 | 0/2 | 1·1 | 1·3 |
| caption_min | 2.0 | 12,336 | 1,409 | 16초 | 2/2 | 0·0 | 0·0 |

- 전체 1회 평균: 호출 14.0 · 입력 합 82,633 · 출력 25,558 · 표시 가격 $1.02 · 시간 253초

## 단계 결과

- 1회 followup: asked (7초)
- 1회 profile: saved · 재작성 0 (43초)
- 1회 words: 뺀 후보 1 · 재작성 0 (44초)
- 1회 visual: 뺀 후보 0 · 재작성 0 (26초)
- 1회 plan: 칸 9 · 재작성 0 (28초)
- 1회 cards: 표지 6개(뺀 1) · 재작성 0 / 본문 saved · 재작성 1 (96초)
- 1회 caption: saved · 재작성 0 (18초)
- 2회 followup: asked (7초)
- 2회 profile: saved · 재작성 0 (49초)
- 2회 words: 뺀 후보 0 · 재작성 0 (45초)
- 2회 visual: 뺀 후보 0 · 재작성 0 (32초)
- 2회 plan: 칸 9 · 재작성 0 (25초)
- 2회 cards: 표지 6개(뺀 2) · 재작성 0 / 본문 saved · 재작성 1 (82초)
- 2회 caption: saved · 재작성 0 (14초)
