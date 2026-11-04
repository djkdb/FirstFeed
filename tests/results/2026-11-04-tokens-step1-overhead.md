# 토큰 측정 · 2026-11-04 · step1-overhead

- 고정 입력: 실제 · 공개 fixture me(설문 8 + 고정 질문 5 · 프로필 스냅숏 · 키트 · 시안 A) + 소재 ig-claude-code-skills · 2회
- 프롬프트: self_review@v2, identity_profile@v2, identity_followup@v2, brand_visual@v2, brand_words_review@v2, card_body@v3, card_body_review@v4, caption_min@v1, caption_min_review@v2, series_plan@v4
- 모델: smoke_extract=sonnet, smoke_context_probe=sonnet, identity_followup=sonnet, task_extract=sonnet, insight_read=sonnet, identity_profile=opus, identity_alternatives=opus, brand_words=opus, brand_visual=opus, cover_titles=opus, series_plan=opus, card_body=opus, reel_script=opus, caption_set=opus, caption_min=opus, self_review=opus
- CLI: claude 2.1.318 (Claude Code) · 클라우드 개발 컨테이너(--cloud-session)
- 입력 합 = 캐시 안 된 입력 + 캐시 쓰기 + 캐시 읽기. 비용은 CLI 가 적은 표시 가격(구독에서는 청구되지 않음 — 비교용)

## 고정 토큰 (아주 짧은 프롬프트 + 작은 스키마)

| 모델 | 입력 합 | 캐시 안 됨 | 캐시 쓰기 | 캐시 읽기 | 출력 | 시간 |
|---|---|---|---|---|---|---|
| sonnet | 2,170 | 2 | 2,168 | 0 | 52 | 2.5초 |
| sonnet | 2,166 | 2 | 806 | 1,358 | 52 | 1.8초 |
| opus | 2,160 | 2 | 2,158 | 0 | 52 | 4.5초 |
| opus | 2,161 | 2 | 803 | 1,356 | 52 | 2.2초 |
