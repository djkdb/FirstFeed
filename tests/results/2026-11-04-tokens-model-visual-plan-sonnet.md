# 토큰 측정 · 2026-11-04 · model-visual-plan-sonnet

- 고정 입력: 실제 · 공개 fixture me(설문 8 + 고정 질문 5 · 프로필 스냅숏 · 키트 · 시안 A) + 소재 ig-claude-code-skills · 2회
- 프롬프트: self_review@v2, identity_profile@v2, identity_followup@v2, brand_visual@v2, brand_words_review@v2, card_body@v3, card_body_review@v4, caption_min@v1, caption_min_review@v2, series_plan@v4
- 모델: smoke_extract=sonnet, smoke_context_probe=sonnet, identity_followup=sonnet, task_extract=sonnet, insight_read=sonnet, identity_profile=opus, identity_alternatives=opus, brand_words=opus, brand_visual=sonnet, cover_titles=opus, series_plan=sonnet, card_body=opus, reel_script=opus, caption_set=opus, caption_min=opus, self_review=opus (바꾼 것: {"brand_visual":"sonnet","series_plan":"sonnet"})
- CLI: claude 2.1.318 (Claude Code) · 클라우드 개발 컨테이너(--cloud-session)
- 입력 합 = 캐시 안 된 입력 + 캐시 쓰기 + 캐시 읽기. 비용은 CLI 가 적은 표시 가격(구독에서는 청구되지 않음 — 비교용)

## 고정 토큰 (아주 짧은 프롬프트 + 작은 스키마)

| 모델 | 입력 합 | 캐시 안 됨 | 캐시 쓰기 | 캐시 읽기 | 출력 | 시간 |
|---|---|---|---|---|---|---|

## 호출 종류별 평균 (호출 1번 기준)

| 과제 | 종류 | 모델 | 호출 수 | 입력 합 | 캐시 안 됨 | 캐시 쓰기 | 캐시 읽기 | 출력 | 그중 생각 | 시간 |
|---|---|---|---|---|---|---|---|---|---|---|
| brand_visual | generate | claude-sonnet-5-5 | 2 | 5,119 | 2 | 2,960 | 2,157 | 2,683 | 1,091 | 21.3초 |
| series_plan | generate | claude-sonnet-5-5 | 2 | 4,695 | 2 | 2,750 | 1,943 | 2,408 | 1,973 | 21.3초 |
| series_plan | rewrite | claude-sonnet-5-5 | 1 | 5,254 | 2 | 4,394 | 858 | 689 | 251 | 6.4초 |

## 과제별 합 (1회 평균 — 생성 · 재작성 · 자기 평가 포함)

| 과제 | 호출 수 | 입력 합 | 출력 | 시간 | 1회 통과 | 재작성 | 코드 규칙 위반 | 위반 코드 |
|---|---|---|---|---|---|---|---|---|
| brand_visual | 1.0 | 5,119 | 2,683 | 21초 | 2/2 | 0·0 | 0·0 | - |
| series_plan | 1.5 | 7,322 | 2,753 | 25초 | 1/2 | 1·0 | 1·0 | english_not_in_source |

- 전체 1회 평균: 호출 2.5 · 입력 합 12,440 · 출력 5,435 · 표시 가격 $0.09 · 시간 46초

## 단계 결과

- 1회 visual: 뺀 후보 0 · 재작성 0 · 팔레트 딥 네이비 노트(#1F3A8A #5B7CFA #FFB020 #F5F7FB #111827) / 민트 터미널(#0F766E #5EEAD4 #F97316 #F0FAF8 #0B1F1C) / 크림 페이퍼(#7C2D12 #D97706 #0E7490 #FFF8EE #2B1A12) · 폰트 pretendard+gowun-dodum / noto-serif-kr+pretendard / paperlogy+noto-sans-kr · 그림 [profile] A friendly, simple mascot-style emblem for an AI tools beginner account, drawn by following the user's own existing ZUN character artwork as the reference for the character's look (do not invent new features). The character stands centered on a clean off-white background (#F5F7FB) with a small glowing amber sparkle and a tiny code bracket icon floating nearby, deep navy (#1F3A8A) accents. Flat clean illustration, soft shapes, strong silhouette readable at small size. 1:1, 1080x1080, no text, no people, no letters, no logos. / [highlight] Minimal flat illustration of a glowing toolbox with a wrench and a small sparkle opening on a tidy desk, deep navy (#1F3A8A) and amber (#FFB020) on an off-white background (#F5F7FB). The key subject is centered within a circle, with calm empty space around it so it survives circular cropping. 9:16, 1080x1920, no text, no people, no letters. / [highlight] Minimal flat illustration of colorful code blocks snapping together into a small abstract app window on a laptop screen, with a tiny sparkle, deep navy (#1F3A8A), violet (#A78BFA) and mint green accents on an off-white background. The key subject is centered within a circle, with plain space around it for circular cropping. 9:16, 1080x1920, no text, no people, no letters. / [highlight] Minimal flat illustration of two puzzle pieces connecting next to a small paper plane and an event ticket, deep navy (#1F3A8A) and warm amber (#FFB020) on an off-white background (#F5F7FB). The key subject is centered within a circle, with calm empty margin around it for circular cropping. 9:16, 1080x1920, no text, no people, no letters. (24초)
- 1회 plan: 칸 9 · 재작성 1 · [d504e3e51e772165] 바이브코딩, 처음엔 뭐부터? / [1a73b8075a69b404] 새 도구, 문서부터 읽나요? / [555fe14aff188a1e] 계정이 이어 준 AI 디깅클럽 / [1a73b8075a69b404] Claude Max, 첫날 해 볼 것 / [d504e3e51e772165] AI가 만들어도 달라지는 관점 / [1a73b8075a69b404] 좋아진 점만 보고 넘기면 놓치는 것 / [555fe14aff188a1e] 청년 공공 AX 서포터즈 선정 후 / [1a73b8075a69b404] 직접 써 보기 전엔 말 안 해요 / [d504e3e51e772165] 한 줄 요청보다 대화로 만들기 (28초)
- 2회 visual: 뺀 후보 0 · 재작성 0 · 팔레트 터미널 민트(#0F766E #A7F3D0 #F59E0B #F7FAF9 #10231F) / 미드나잇 인디고(#3730A3 #C7D2FE #FB7185 #F5F5FF #1E1B4B) / 따뜻한 종이(#9A3412 #FDBA74 #0EA5E9 #FFF8F0 #2B1A12) · 폰트 pretendard+noto-sans-kr / noto-serif-kr+pretendard / paperlogy+suit · 그림 [profile] Square 1:1 profile image, 1080x1080, no text. A friendly mascot character standing in for the account owner, drawn closely following the user's own existing ZUN character artwork (do not invent its look). The character sits centered in front of a softly glowing laptop on a clean flat background in calm teal and warm amber tones. Simple flat illustration, soft shadows, no people, no text, no logos. / [highlight] Vertical 9:16 highlight cover, 1080x1920, no text. A glowing toolbox with a small sparkle opening above a laptop, the key subject centered within a circle, with plenty of empty margin around it. Flat illustration in calm teal and amber on a clean light background, no people, no text, no logos. / [highlight] Vertical 9:16 highlight cover, 1080x1920, no text. A small half-built app window with floating code blocks and a tiny sparkle wand beside it, centered within a circle, with plenty of empty margin around it. Flat illustration in deep indigo with lime accents, no people, no text, no logos. / [highlight] Vertical 9:16 highlight cover, 1080x1920, no text. Two overlapping speech bubbles joined by a small handshake-like link of connecting lines, next to a notebook and a pin, centered within a circle, with plenty of empty margin around it. Warm paper-toned flat illustration in terracotta and sky blue, no people, no text, no logos. (20초)
- 2회 plan: 칸 9 · 재작성 0 · [1a73b8075a69b404] 새 도구, 문서부터 읽어요? / [d504e3e51e772165] 전공 아닌데 AI로 만들어도 될까? / [1a73b8075a69b404] 소개만 보고 따라 쓰다 막히는 곳 / [555fe14aff188a1e] 계정 하나가 이어 준 대외활동 / [1a73b8075a69b404] Claude Max, 질문부터 바꾸면 / [d504e3e51e772165] 도구 말고 관점의 차이 / [1a73b8075a69b404] 새 기능이 나온 날 할 일 / [d504e3e51e772165] AI에게 맡긴 것, 내가 정한 것 / [555fe14aff188a1e] 공공 AX 서포터즈에 선정되고 (21초)
