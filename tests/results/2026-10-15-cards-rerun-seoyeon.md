# 카드뉴스 측정 · 2026-10-15 · cards-rerun-seoyeon

- 프롬프트: cover_titles@v1, cover_titles_review@v1, card_body@v1, card_body_review@v2, self_review@v2 · 모델 opus · 소재마다 2회 · 표지는 후보 중 첫 번째를 고름
- 짝: ai-tool-memo × me(시안 A) · budget-devlog × doyun(시안 C) · dessert-visit × seoyeon(시안 B) — 프로필·키트는 고정 스냅숏
- PNG: `tests/results/2026-10-15-cards-rerun-seoyeon/<소재>-<브랜드>-<회>/`
- 재작성 사유는 재작성을 부른 회차의 코드 규칙 위반 건수(자기 평가의 fact·broken 은 「자기 평가」). 표지 후보에서 빼고 받아들인 것은 「뺀 후보」로 따로

## 실제 · 공개 (0회)

자료 없음

## 실제 · 비공개 (0회)

자료 없음

## AI 생성 (2회)

| 지표 | 값 |
|---|---|
| 세트 저장 / 직접 줄이기 필요 / 실패 | 2 / 0 / 0 |
| 표지 후보 보인 수 평균 · 뺀 후보 합 | 6.0 · 2 |
| 재작성 (표지 / 본문) 합 | 0 / 1 |
| AI 호출 합 (표지+본문) 평균 | 5.0 |
| 한 세트 시간 평균 | 102초 |
| 단계 시간 (회차별) 표지 / 본문 | 47 · 48 / 65 · 45초 |
| 재작성 사유 — 근거 규칙 (문제 건수) | 0 |
| 재작성 사유 — 렌더링 넘침 (문제 건수) | 0 |
| 재작성 사유 — 개수 불일치 (문제 건수) | 0 |
| 재작성 사유 — 자기 평가 (문제 건수) | 2 |
| 재작성 사유 — 기타 (문제 건수) | 0 |
| 뺀 표지 후보의 사유 (재작성 아님) | 근거 규칙 1 · 자기 평가 1 |
| 최종 카드의 원문 밖 숫자·영문 (FR-MK-2, 0이어야) | 0 |
| 표지 개수 표현 = 본문 카드 수 (개수 표현 있는 세트) | 0/0 |
| 잠자기가 낀 회차 | 0/2 |

### dessert-visit × seoyeon (시안 B) · 1회

표지 후보 6개 (호출 2·재작성 0): 「온실 베이커리 줄 서도 될까?」 · 「주말 웨이팅 40분, 그래도 가요」 · 「딸기 타르트 하나로 줄 설 가치 있음」 · 「주말엔 무조건 11시에 가세요」 · 「피스타치오 크루아상 2시면 품절」 · 「기다리기 싫다면 포장은 바로 돼요」

본문: saved (호출 4·재작성 1) · PNG `tests/results/2026-10-15-cards-rerun-seoyeon/dessert-visit-seoyeon-1`

- 1. [cover] 온실 베이커리 ⏎ **줄 서도** 될까? ⏎ 평일·주말 한 번씩 가 보고 내린 판정
- 2. [body] 결론부터, 줄 서도 돼요 ⏎ 딸기 타르트 하나 먹으러 가는 거라면 **줄 서도 아깝지 않아요.** ⏎  ⏎ 다만 주말에 갈 거면 오픈 시간에 맞춰 가는 걸 추천해요. 평일 한 번, 주말 한 번 가 보고 내린 판정이에요.  ← 근거: "결론: 딸기 타르트 때문이라면 줄 서도 아깝지 않다. 다만 주말이면 오픈 시간에 맞춰 가자."  🖼 A strawberry tart on a small plate on a wooden table inside a bright greenhouse-style bakery, plants and glass windows softly blurred in the background, warm natural daylight, cozy editorial food photography, no people, no text, 4:5 vertical composition, 1080x1350
- 3. [body] 주말엔 11시 오픈런 ⏎ 평일 오후 3시에 갔을 땐 웨이팅이 아예 없었어요. ⏎  ⏎ 그런데 주말 오후 1시엔 40분을 기다렸어요. 주말에 갈 거면 **문 여는 11시에 맞춰 가는 게 나아요.**  ← 근거: "평일 오후 3시에는 웨이팅이 없었다. 주말 오후 1시에는 40분을 기다렸다. 주말에 갈 거면 문 여는 11시에 맞춰 가는 게 낫다."
- 4. [body] 딸기 타르트는 두 번 다 만족 ⏎ 대표 메뉴 딸기 타르트는 7,500원이에요. ⏎  ⏎ 딸기가 크고 크림이 덜 달아요. 평일에도 주말에도 **두 번 다 만족했어요.** 줄 선 값은 이걸로 충분해요.  ← 근거: "대표 메뉴인 딸기 타르트는 7,500원이다. 딸기가 크고 크림이 덜 달아서 두 번 다 만족했다."  🖼 Close-up of a strawberry tart with large fresh strawberries and light cream on a pastry base, soft daylight, clean minimal background, appetizing bakery food photography, no people, no text, 4:5 vertical, 1080x1350
- 5. [body] 크루아상은 일찍 가야 있어요 ⏎ 피스타치오 크루아상은 6,800원이에요. ⏎  ⏎ 주말에 갔을 땐 **오후 2시에 이미 다 팔렸어요.** 이것까지 먹고 싶다면 주말엔 더더욱 일찍 가는 게 좋아요.  ← 근거: "피스타치오 크루아상은 6,800원인데, 주말에 갔을 때는 오후 2시에 이미 다 팔렸다."  🖼 An empty bakery display tray with a few crumbs and a small blank sold-out card, pistachio-green accents, bright bakery interior, simple illustration style, no people, no text, 4:5 vertical, 1080x1350
- 6. [body] 자리는 12석, 창가가 명당 ⏎ 자리는 12석뿐이에요. ⏎  ⏎ 창가 4석이 제일 밝아서 **사진 찍기엔 창가가 명당**이에요. 자리가 없으면 포장도 괜찮아요. 포장은 기다리지 않고 바로 돼요.  ← 근거: "자리는 12석뿐이다. 창가 자리 4석이 제일 밝아서 사진 찍기 좋다. 포장은 기다리지 않고 바로 된다."  🖼 Small cozy cafe seating by a large bright window with four seats, sunlight streaming in, potted plants, greenhouse bakery atmosphere, empty seats, no people, no text, 4:5 vertical, 1080x1350
- 7. [body] 아쉬운 건 아메리카노 ⏎ 솔직히 커피는 아쉬웠어요. ⏎  ⏎ 디저트에 비해 **아메리카노 맛이 평범했어요.** 커피 맛집을 기대하고 가면 실망할 수 있어요. 여긴 디저트 보고 가는 곳이에요.  ← 근거: "아쉬웠던 건 아메리카노다. 디저트에 비해 커피 맛이 평범했다."
- 8. [closing] 주말 가기 전 ⏎ 저장해 두세요 ⏎ 같이 갈 친구도 댓글로 태그해 주세요
재작성 사유: 자기 평가 2

### dessert-visit × seoyeon (시안 B) · 2회

표지 후보 6개 (호출 2·재작성 0): 「온실 베이커리 줄 설 만해요」 · 「딸기 타르트 좋아하면 필수」 · 「디저트는 합격 커피는 평범」 · 「온실 베이커리 알고 갈 5가지」 · 「피스타치오 크루아상 2시면 품절」 · 「12석뿐인 카페 창가 4석 노려요」

뺀 후보:
- 「온실 베이커리 **40분** 기다릴까?」 — [number_not_in_source] 소재·프로필·메모에 없는 숫자 "0" 을(를) 썼습니다.
- 「딸기 타르트 하나로 **두 번** 간 이유」 — [review_fact] 소재에는 판정을 위해 평일·주말에 한 번씩 갔다고만 나오고 '딸기 타르트 때문에 두 번 갔다'는 동기는 없어서, 제목이 약속하는 '이유'는 지어낸 사실이에요.

본문: saved (호출 2·재작성 0) · PNG `tests/results/2026-10-15-cards-rerun-seoyeon/dessert-visit-seoyeon-2`

- 1. [cover] 온실 베이커리 ⏎ **줄 설 만해요** ⏎ 평일·주말 두 번 가 보고 내린 판정
- 2. [body] 결론부터, 줄 서도 아깝지 않아요 ⏎ 온실 베이커리에 평일 한 번, 주말 한 번 가 봤어요. ⏎  ⏎ 결론은 **딸기 타르트 때문이라면 줄 서도 아깝지 않아요.** ⏎  ⏎ 다만 주말에 간다면 오픈 시간에 맞춰 가는 걸 추천해요.  ← 근거: "결론: 딸기 타르트 때문이라면 줄 서도 아깝지 않다. 다만 주말이면 오픈 시간에 맞춰 가자."
- 3. [body] 주말엔 11시 오픈에 맞춰 가세요 ⏎ 평일 오후 3시에는 웨이팅이 없었어요. 그런데 주말 오후 1시에는 40분을 기다렸어요. ⏎  ⏎ **주말에 갈 거면 문 여는 11시에 맞춰 가는 게 나아요.**  ← 근거: "평일 오후 3시에는 웨이팅이 없었다. 주말 오후 1시에는 40분을 기다렸다. 주말에 갈 거면 문 여는 11시에 맞춰 가는 게 낫다."
- 4. [body] 딸기 타르트는 두 번 다 만족 ⏎ 대표 메뉴인 딸기 타르트는 7,500원이에요. ⏎  ⏎ 딸기가 크고 크림이 덜 달아서 **두 번 다 만족했어요.** 줄 서는 이유는 이 타르트 하나로 충분해요.  ← 근거: "대표 메뉴인 딸기 타르트는 7,500원이다. 딸기가 크고 크림이 덜 달아서 두 번 다 만족했다."  🖼 Close-up food photograph of a strawberry tart with large fresh whole strawberries on light cream, on a small ceramic plate on a wooden cafe table, soft natural window light, warm cozy greenhouse bakery mood with green plants blurred in background, no people, no hands, no text, 4:5 vertical composition, 1080x1350
- 5. [body] 피스타치오 크루아상은 일찍 품절 ⏎ 피스타치오 크루아상은 6,800원이에요. ⏎  ⏎ 주말에 갔을 때는 **오후 2시에 이미 다 팔렸어요.** 이걸 노린다면 주말엔 더더욱 오픈 시간에 맞춰 가세요.  ← 근거: "피스타치오 크루아상은 6,800원인데, 주말에 갔을 때는 오후 2시에 이미 다 팔렸다."
- 6. [body] 자리는 12석, 창가 4석이 명당 ⏎ 자리는 12석뿐이에요. ⏎  ⏎ **창가 자리 4석이 제일 밝아서 사진 찍기 좋아요.** ⏎  ⏎ 자리가 없으면 포장도 방법이에요. 포장은 기다리지 않고 바로 돼요.  ← 근거: "자리는 12석뿐이다. 창가 자리 4석이 제일 밝아서 사진 찍기 좋다. 포장은 기다리지 않고 바로 된다."  🖼 Interior of a small bright greenhouse-style bakery cafe, a row of empty window seats bathed in soft daylight, glass walls and potted green plants, small wooden tables, calm and airy atmosphere, no people, no text, 4:5 vertical composition, 1080x1350
- 7. [body] 아쉬운 건 아메리카노 ⏎ 솔직히 아메리카노는 아쉬웠어요. ⏎  ⏎ 디저트에 비해 **커피 맛이 평범했어요.** 커피까지 기대하고 가면 실망할 수 있어요.  ← 근거: "아쉬웠던 건 아메리카노다. 디저트에 비해 커피 맛이 평범했다."
- 8. [closing] 주말 가기 전에 저장해 두세요 ⏎ 같이 갈 친구를 댓글로 태그해 주세요
재작성 사유: 없음
