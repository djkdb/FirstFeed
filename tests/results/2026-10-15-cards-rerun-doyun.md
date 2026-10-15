# 카드뉴스 측정 · 2026-10-15 · cards-rerun-doyun

- 프롬프트: cover_titles@v1, cover_titles_review@v1, card_body@v1, card_body_review@v2, self_review@v2 · 모델 opus · 소재마다 2회 · 표지는 후보 중 첫 번째를 고름
- 짝: ai-tool-memo × me(시안 A) · budget-devlog × doyun(시안 C) · dessert-visit × seoyeon(시안 B) — 프로필·키트는 고정 스냅숏
- PNG: `tests/results/2026-10-15-cards-rerun-doyun/<소재>-<브랜드>-<회>/`
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
| 재작성 (표지 / 본문) 합 | 0 / 2 |
| AI 호출 합 (표지+본문) 평균 | 6.0 |
| 한 세트 시간 평균 | 133초 |
| 재작성 사유 — 근거 규칙 (문제 건수) | 0 |
| 재작성 사유 — 렌더링 넘침 (문제 건수) | 0 |
| 재작성 사유 — 개수 불일치 (문제 건수) | 0 |
| 재작성 사유 — 자기 평가 (문제 건수) | 2 |
| 재작성 사유 — 기타 (문제 건수) | 0 |
| 뺀 표지 후보의 사유 (재작성 아님) | 자기 평가 2 |
| 최종 카드의 원문 밖 숫자·영문 (FR-MK-2, 0이어야) | 0 |
| 표지 개수 표현 = 본문 카드 수 (개수 표현 있는 세트) | 0/0 |
| 잠자기가 낀 회차 | 0/2 |

### budget-devlog × doyun (시안 C) · 1회

표지 후보 6개 (호출 2·재작성 0): 「영수증 찍으면 알아서 나눠져요」 · 「가게 이름, 또 고치세요?」 · 「자주 틀리던 영수증 88%까지 맞혀요」 · 「영수증 모아만 두는 직장인에게」 · 「아무도 안 써서 지웠어요」 · 「친구 5명이 먼저 써 봤더니」

뺀 후보:
- 「주말 세 번을 **통째로** 썼어요」 — [review_fact] 소재에는 이 기능을 '주말 세 번을 통째로' 들여 만들었다고만 나오고 '퇴근 후'에 만들었다는 말은 없어서, 소재와 다른 사실을 쓰게 됐고 제목(주말)과도 엇갈립니다.

본문: saved (호출 2·재작성 0) · PNG `tests/results/2026-10-15-cards-rerun-doyun/budget-devlog-doyun-1`

- 1. [cover] 영수증 찍으면 ⏎ **알아서** 나눠져요 ⏎ 3주 동안 만든 영수증 사진 기능 이야기
- 2. [body] 주말 세 번을 ⏎ 통째로 썼어요 ⏎ 영수증 사진을 찍으면 항목이 알아서 나뉘는 기능을 만들었어요. ⏎  ⏎ 가계부에 하나하나 옮겨 적지 않아도 되게요. ⏎  ⏎ **3주 동안, 주말 세 번을 통째로** 여기에 썼어요.  ← 근거: "영수증 사진을 찍으면 항목이 알아서 나뉘는 기능을 3주 동안 만들었다. 주말 세 번을 통째로 썼다."  🖼 Flat pastel illustration of a crumpled paper receipt next to a smartphone lying on a desk, the phone screen showing abstract colored blocks splitting into neat rows, a small desk calendar with three weekend squares circled, cozy evening light, minimal clean style, no people, no hands, no text, 4:5 vertical composition, 1080x1350
- 3. [body] 금액은 맞는데 ⏎ 가게 이름이 틀렸어요 ⏎ 처음 버전은 금액은 잘 읽었어요. 그런데 가게 이름을 자주 틀렸어요. ⏎  ⏎ 친구 5명에게 먼저 써 보게 했더니, **가게 이름을 고치는 데 시간이 더 걸린다**는 말이 나왔어요. ⏎  ⏎ 편하자고 만든 기능인데 오히려 손이 더 가고 있었던 거죠.  ← 근거: "처음 버전은 금액을 잘 읽었지만 가게 이름을 자주 틀렸다. 친구 5명에게 써 보게 했더니 가게 이름을 고치는 데 시간이 더 걸린다는 말이 나왔다."
- 4. [body] 한 번 고치면 ⏎ 다음부턴 기억해요 ⏎ 그래서 방법을 바꿨어요. 가게 이름은 처음 한 번만 고치면 다음부터 기억해요. ⏎  ⏎ **같은 가게를 두 번째 찍을 때부터는 고칠 필요가 없어요.** ⏎  ⏎ 자주 가는 편의점이나 단골 식당이라면 처음 한 번만 손보면 돼요.  ← 근거: "그래서 가게 이름은 처음 한 번만 고치면 다음부터 기억하게 바꿨다. 같은 가게를 두 번째 찍을 때부터는 고칠 필요가 없다."
- 5. [body] 72%에서 ⏎ 88%까지 ⏎ 영수증 항목을 제대로 나누는 비율이 처음엔 72%였어요. ⏎  ⏎ 그래서 자주 틀리는 항목 30개를 따로 정리해서 넣었어요. ⏎  ⏎ 그 뒤로 **88%까지** 올라갔어요. 자주 틀리는 것부터 하나씩 챙긴 게 컸어요.  ← 근거: "항목 나누기 정확도는 처음 72%였는데, 자주 틀리는 항목 30개를 따로 정리해 넣은 뒤 88%까지 올랐다."  🖼 Minimal flat infographic illustration of two rounded vertical bars, a shorter muted bar and a taller bright mint bar, with a small upward arrow between them and a paper receipt icon beside, soft pastel background, clean modern style, no people, no hands, no text, no numbers, 4:5 vertical composition, 1080x1350
- 6. [body] 아무도 안 써서 ⏎ 지운 기능도 있어요 ⏎ 만들기만 한 건 아니에요. 지운 것도 있어요. ⏎  ⏎ 영수증을 찍으면 카테고리 색이 자동으로 바뀌는 기능이었는데요. ⏎  ⏎ **친구들이 아무도 안 썼어요.** 그래서 지웠어요.  ← 근거: "반대로 지운 기능도 있다. 영수증을 찍으면 자동으로 카테고리 색을 바꾸는 기능은 친구들이 아무도 안 써서 지웠다."  🖼 Flat pastel illustration of a row of colorful category color swatch chips on a desk, one set of swatches being swept into a small trash bin icon, calm and slightly humorous mood, minimal clean style, no people, no hands, no text, 4:5 vertical composition, 1080x1350
- 7. [body] 다음엔 영수증 ⏎ 없이도 기록되게 ⏎ 다음에는 카드 문자 알림을 읽어서 영수증 없이도 기록되게 해 볼 생각이에요. ⏎  ⏎ **아직 시작은 안 했어요.** 지금은 생각만 해 둔 단계예요.  ← 근거: "다음에는 카드 문자 알림을 읽어서 영수증 없이도 기록되게 해 볼 생각이다. 아직 시작은 안 했다."
- 8. [closing] 다음 제작기도 ⏎ 궁금하다면 팔로우 ⏎ 영수증 정리 어떻게 하는지 댓글로 알려 주세요
재작성 사유: 없음

### budget-devlog × doyun (시안 C) · 2회

표지 후보 6개 (호출 2·재작성 0): 「영수증 찍으면 항목이 알아서」 · 「72%에서 88%까지 올린 법」 · 「가게 이름, 또 고치고 계세요?」 · 「두 번째부터는 안 고쳐도 돼요」 · 「아무도 안 써서 지운 기능」 · 「주말 세 번을 통째로 썼어요」

뺀 후보:
- 「친구 5명이 써 보고 바뀐 **3가지**」 — [review_fact] 제목은 세 가지가 모두 친구 5명이 써 본 뒤에 바뀌었다고 말하지만, 소재에서 친구 5명의 말로 바뀐 것은 가게 이름 기억뿐입니다. 30개 항목을 정리한 일은 친구 의견과 이어져 있지 않고, 지운 기능도 '친구들'이라고만 적혀 있어 그 5명인지 알 수 없습니다.

본문: saved (호출 6·재작성 2) · PNG `tests/results/2026-10-15-cards-rerun-doyun/budget-devlog-doyun-2`

- 1. [cover] 영수증 찍으면 ⏎ **항목**이 알아서 ⏎ 주말 세 번을 통째로 써서 만든 기능 이야기
- 2. [body] 주말 세 번을 ⏎ 통째로 썼어요 ⏎ 영수증 사진을 찍으면 항목이 알아서 나뉘는 기능을 만들었어요. ⏎  ⏎ 걸린 시간은 3주. **주말 세 번을 통째로** 썼어요.  ← 근거: "영수증 사진을 찍으면 항목이 알아서 나뉘는 기능을 3주 동안 만들었다. 주말 세 번을 통째로 썼다."  🖼 Flat pastel illustration of a crumpled paper receipt next to a smartphone whose screen shows neatly sorted colorful list blocks, soft shadows, calm minimal background, no people, no hands, no text, 4:5 vertical composition, 1080x1350
- 3. [body] 가게 이름이 ⏎ 자꾸 틀렸어요 ⏎ 처음 버전은 금액은 잘 읽었어요. 문제는 가게 이름이었어요. 자주 틀렸거든요. ⏎  ⏎ 친구 5명에게 먼저 써 보게 했더니, 가게 이름을 고치는 데 **시간이 더 걸린다**는 말이 나왔어요. ⏎  ⏎ 편하자고 만든 기능이 오히려 일을 늘리고 있었던 거예요.  ← 근거: "처음 버전은 금액을 잘 읽었지만 가게 이름을 자주 틀렸다. 친구 5명에게 써 보게 했더니 가게 이름을 고치는 데 시간이 더 걸린다는 말이 나왔다."
- 4. [body] 한 번 고치면 ⏎ 다음엔 기억해요 ⏎ 그래서 방법을 바꿨어요. ⏎  ⏎ 가게 이름은 처음 한 번만 고치면, 다음부터는 앱이 기억해요. ⏎  ⏎ **같은 가게를 두 번째 찍을 때부터는 고칠 필요가 없어요.** ⏎  ⏎ 자주 가는 곳이라면 한 번 손보고 끝이에요.  ← 근거: "그래서 가게 이름은 처음 한 번만 고치면 다음부터 기억하게 바꿨다. 같은 가게를 두 번째 찍을 때부터는 고칠 필요가 없다."
- 5. [body] 72%에서 ⏎ 88%까지 ⏎ 항목을 맞게 나누는 비율은 처음에 72%였어요. ⏎  ⏎ 자주 틀리는 항목 30개를 따로 정리해서 넣었더니 **88%까지** 올랐어요.  ← 근거: "항목 나누기 정확도는 처음 72%였는데, 자주 틀리는 항목 30개를 따로 정리해 넣은 뒤 88%까지 올랐다."  🖼 Minimal flat infographic illustration of two vertical bars, a shorter muted bar and a taller bright bar with an upward arrow between them, pastel colors, clean background, no people, no hands, no text, no numbers, 4:5 vertical composition, 1080x1350
- 6. [body] 아무도 안 써서 ⏎ 지운 기능 ⏎ 만든 것만 있는 건 아니에요. 지운 기능도 있어요. ⏎  ⏎ 영수증을 찍으면 카테고리 색이 자동으로 바뀌는 기능이었는데, **친구들이 아무도 안 썼어요.** ⏎  ⏎ 그래서 지웠어요.  ← 근거: "반대로 지운 기능도 있다. 영수증을 찍으면 자동으로 카테고리 색을 바꾸는 기능은 친구들이 아무도 안 써서 지웠다."  🖼 Flat pastel illustration of a row of colorful category color swatches with one faded swatch being swept into a small trash bin, soft minimal background, no people, no hands, no text, 4:5 vertical composition, 1080x1350
- 7. [body] 다음엔 영수증 ⏎ 없이도? ⏎ 다음엔 카드 문자 알림을 읽어서, 영수증이 없어도 기록되게 해 볼 생각이에요. ⏎  ⏎ **아직 시작은 안 했어요.** ⏎  ⏎ 생각만 해 둔 단계라, 솔직하게 여기까지만 적어 둘게요.  ← 근거: "다음에는 카드 문자 알림을 읽어서 영수증 없이도 기록되게 해 볼 생각이다. 아직 시작은 안 했다."
- 8. [closing] 다음 제작기가 ⏎ 궁금하면 팔로우 ⏎ 카드 문자로 기록되면 쓸 것 같은지 댓글로 알려 주세요
재작성 사유: 자기 평가 2
