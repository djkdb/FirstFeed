# 토큰 측정 · 2026-11-04 · model-smoke-sonnet

- 고정 입력: 실제 · 공개 fixture me(설문 8 + 고정 질문 5 · 프로필 스냅숏 · 키트 · 시안 A) + 소재 ig-claude-code-skills · 3회
- 프롬프트: self_review@v2, identity_profile@v2, identity_followup@v2, brand_visual@v2, brand_words_review@v2, card_body@v3, card_body_review@v4, caption_min@v1, caption_min_review@v2, series_plan@v4
- 모델: smoke_extract=sonnet, smoke_context_probe=sonnet, identity_followup=sonnet, task_extract=sonnet, insight_read=sonnet, identity_profile=opus, identity_alternatives=opus, brand_words=opus, brand_visual=opus, cover_titles=opus, series_plan=opus, card_body=opus, reel_script=opus, caption_set=opus, caption_min=opus, self_review=opus
- CLI: claude 2.1.318 (Claude Code) · 클라우드 개발 컨테이너(--cloud-session)
- 입력 합 = 캐시 안 된 입력 + 캐시 쓰기 + 캐시 읽기. 비용은 CLI 가 적은 표시 가격(구독에서는 청구되지 않음 — 비교용)

## 고정 토큰 (아주 짧은 프롬프트 + 작은 스키마)

| 모델 | 입력 합 | 캐시 안 됨 | 캐시 쓰기 | 캐시 읽기 | 출력 | 시간 |
|---|---|---|---|---|---|---|

## 호출 종류별 평균 (호출 1번 기준)

| 과제 | 종류 | 모델 | 호출 수 | 입력 합 | 캐시 안 됨 | 캐시 쓰기 | 캐시 읽기 | 출력 | 그중 생각 | 시간 |
|---|---|---|---|---|---|---|---|---|---|---|
| self_review ← smoke_extract | review | claude-opus-5-5 | 3 | 3,415 | 2 | 2,554 | 859 | 227 | 145 | 7.7초 |
| smoke_extract | generate | claude-sonnet-5-5 | 3 | 2,608 | 2 | 1,407 | 1,199 | 452 | 109 | 5.5초 |

## 과제별 합 (1회 평균 — 생성 · 재작성 · 자기 평가 포함)

| 과제 | 호출 수 | 입력 합 | 출력 | 시간 | 1회 통과 | 재작성 | 코드 규칙 위반 | 위반 코드 |
|---|---|---|---|---|---|---|---|---|
| smoke_extract | 2.0 | 6,022 | 678 | 13초 | 3/3 | 0·0·0 | 0·0·0 | - |

- 전체 1회 평균: 호출 2.0 · 입력 합 6,022 · 출력 678 · 표시 가격 $0.04 · 시간 13초

## 단계 결과

- 1회 smoke: 통과 · 재작성 0 · 밀가루상점은 2024년 3월 망원동에서 문을 열었다. / 사장 김하늘 씨는 하루 120개만 굽는 소금빵으로 이름을 알렸다. / 가게 인스타그램 계정은 개업 1년 만에 팔로워 8,300명을 모았다. (8초)
- 2회 smoke: 통과 · 재작성 0 · 밀가루상점은 2024년 3월 망원동에서 문을 연 동네 빵집이다. / 사장 김하늘 씨는 하루 120개만 굽는 소금빵으로 이름을 알렸다. / 가게 인스타그램은 개업 1년 만에 팔로워 8,300명을 모았다. (21초)
- 3회 smoke: 통과 · 재작성 0 · 밀가루상점 사장은 하루 120개만 굽는 소금빵으로 이름을 알렸다. / 가게 계정은 개업 1년 만에 팔로워 8,300명을 모았다. / 올해 9월부터 스마트스토어에서 냉동 소금빵을 판매한다. (12초)
