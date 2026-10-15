# 카드뉴스 측정 · 2026-10-15 · cards-body-v1

- 프롬프트: cover_titles@v1, cover_titles_review@v1, card_body@v1, card_body_review@v2, self_review@v2 · 모델 opus · 소재마다 2회 · 표지는 후보 중 첫 번째를 고름
- 짝: ai-tool-memo × me(시안 A) · budget-devlog × doyun(시안 C) · dessert-visit × seoyeon(시안 B) — 프로필·키트는 고정 스냅숏
- PNG: `tests/results/2026-10-15-cards-body-v1/<소재>-<브랜드>-<회>/`
- 재작성 사유는 재작성을 부른 회차의 코드 규칙 위반 건수(자기 평가의 fact·broken 은 「자기 평가」). 표지 후보에서 빼고 받아들인 것은 「뺀 후보」로 따로

## 실제 · 공개 (0회)

자료 없음

## 실제 · 비공개 (0회)

자료 없음

## AI 생성 (6회)

| 지표 | 값 |
|---|---|
| 세트 저장 / 직접 줄이기 필요 / 실패 | 6 / 0 / 0 |
| 표지 후보 보인 수 평균 · 뺀 후보 합 | 6.0 · 2 |
| 재작성 (표지 / 본문) 합 | 0 / 4 |
| AI 호출 합 (표지+본문) 평균 | 5.2 |
| 한 세트 시간 평균 | 109초 |
| 단계 시간 (회차별) 표지 / 본문 | 48 · 42 · 44 · 50 · 39 · 41 / 78 · 36 · 51 · 58 · 105 · 62초 |
| 재작성 사유 — 근거 규칙 (문제 건수) | 1 |
| 재작성 사유 — 렌더링 넘침 (문제 건수) | 0 |
| 재작성 사유 — 개수 불일치 (문제 건수) | 0 |
| 재작성 사유 — 자기 평가 (문제 건수) | 3 |
| 재작성 사유 — 기타 (문제 건수) | 0 |
| 뺀 표지 후보의 사유 (재작성 아님) | 자기 평가 1 · 근거 규칙 1 |
| 최종 카드의 원문 밖 숫자·영문 (FR-MK-2, 0이어야) | 0 |
| 표지 개수 표현 = 본문 카드 수 (개수 표현 있는 세트) | 1/1 |
| 풀이 표시 (⚑) 합 — card_body v2 부터 | 0 |
| 잠자기가 낀 회차 | 0/6 |

### ai-tool-memo × me (시안 A) · 1회

표지 후보 6개 (호출 2·재작성 0): 「모아 1.2 일주일 써 본 메모」 · 「모아 1.2에서 손이 간 3가지」 · 「폴더 아직 직접 만드세요?」 · 「검색창에 '어제' 써 보세요」 · 「공유 링크, 7일 뒤엔 안 열려요」 · 「모아 처음이라면 태그부터」

뺀 후보:
- 「노트 **500개** 넘기면 어떻게 될까」 / 부제 「새 노트는 막히고, 기존 노트는 그대로 보여요」 — [review_fact] 원문에서 노트 500개 제한은 '무료 요금제'에만 해당하는데, 제목과 부제 모두 이 조건을 빼서 모든 사용자가 500개를 넘기면 새 노트가 막히는 것처럼 원문과 다르게 읽힌다.

본문: saved (호출 4·재작성 1) · PNG `tests/results/2026-10-15-cards-body-v1/ai-tool-memo-me-1`

- 1. [cover] 모아 1.2 ⏎ 일주일 써 본 **메모** ⏎ 바뀐 것 중 실제로 손이 간 것만 골랐어요
- 2. [body] 태그 하나로 ⏎ 노트가 알아서 묶여요 ⏎ 모아 1.2에서는 태그만 붙이면 노트가 자동으로 묶여요. ⏎  ⏎ 예전에는 폴더를 직접 만들어야 했어요. 이제는 **태그 하나로 같은 주제 노트가 한 화면에 모여요.** ⏎  ⏎ 노트를 쓰고 나서 태그만 달아 두면 정리가 끝나요.  ← 근거: "태그를 붙이면 노트가 자동으로 묶인다. 예전에는 폴더를 직접 만들어야 했는데, 이제 태그 하나로 같은 주제 노트가 한 화면에 모인다."  🖼 Flat illustration of a note-taking app screen where several colorful note cards with small tag icons are gathering into one neat group on a single screen, soft pastel background, clean minimal UI style, no people, no hands, no text, 4:5 vertical, 1080x1350
- 3. [body] 검색창에 ⏎ '어제'라고 써 보세요 ⏎ 검색창에 날짜를 쓰면 그날 쓴 노트만 보여요. ⏎  ⏎ 날짜 대신 **"어제"라고 써도 돼요.** ⏎  ⏎ 일주일 동안 회의록을 찾을 때 이 기능을 제일 많이 썼어요.  ← 근거: "검색창에 날짜를 쓰면 그날 쓴 노트만 보인다. "어제"라고 써도 된다. 회의록을 찾을 때 제일 많이 썼다."  🖼 Minimal flat illustration of an app search bar with a small calendar icon beside it, below it a short filtered list of note cards from a single day, calm blue and white palette, no people, no hands, no text, 4:5 vertical, 1080x1350
- 4. [body] 공유 링크는 ⏎ 7일 뒤 사라져요 ⏎ 링크를 보낸 사람이 일주일 지나서 열면 안 열려요. ⏎  ⏎ 그래서 **오래 둘 자료는 내보내기로 따로 저장해야 해요.** ⏎  ⏎ 링크만 보내 두고 안심하면 나중에 곤란할 수 있어요.  ← 근거: "공유 링크는 7일 뒤 사라진다. 링크를 보낸 사람이 일주일 지나서 열면 안 열린다는 뜻이라, 오래 둘 자료는 내보내기로 따로 저장해야 한다."  🖼 Flat illustration of a chain link icon slowly fading away next to a small calendar showing a week passing, simple soft colors, clean minimal style, no people, no hands, no text, 4:5 vertical, 1080x1350
- 5. [body] 무료는 ⏎ 노트 500개까지예요 ⏎ 무료 요금제는 노트를 500개까지 만들 수 있어요. ⏎  ⏎ 500개를 넘기면 새 노트는 못 만들어요. 그래도 **기존 노트는 그대로 볼 수 있어요.**  ← 근거: "무료 요금제는 노트 500개까지다. 500개를 넘기면 새 노트를 만들 수 없고, 기존 노트는 그대로 볼 수 있다."
- 6. [body] 내보내기는 ⏎ Markdown 파일로만 ⏎ 내보내기는 Markdown 파일로만 돼요. ⏎  ⏎ **PDF로 바로 뽑는 기능은 아직 없어요.** ⏎  ⏎ PDF가 꼭 필요한 자료라면 이 점을 미리 알아 두세요.  ← 근거: "내보내기는 Markdown 파일로만 된다. PDF 로 바로 뽑는 기능은 아직 없다."
- 7. [body] 처음이라면 ⏎ 태그부터 붙여 보세요 ⏎ 모아를 처음 쓴다면 **태그부터 붙여 보는 걸 권해요.** ⏎  ⏎ 폴더를 먼저 만들 필요가 없어요. 노트 하나를 쓰고 태그 하나만 달아 보세요.  ← 근거: "처음 쓰는 사람이라면 태그부터 붙여 보는 걸 권한다. 폴더를 먼저 만들 필요가 없다."
- 8. [closing] 저장해 두고 ⏎ 오늘 태그 하나 ⏎ 붙여 보세요 ⏎ 써 본 기능이 있으면 댓글로 알려 주세요

본문 자기 평가 지적:
- 1번째 생성 · fact · cards.3.text: 원문은 "링크를 보낸 사람이 일주일 지나서 열면"인데, 카드에서는 "링크를 받은 사람이"로 주어가 바뀌었습니다.
- 1번째 생성 · style · cards.1.text: "태그만 달아 두면 정리가 끝나요"는 원문(같은 주제 노트가 한 화면에 모인다)보다 조금 단정적인 평가라서, 원문에 가깝게 누그러뜨리는 편이 좋겠습니다.
- 1번째 생성 · style · cards.6: 1번 카드와 같은 태그 이야기를 되풀이합니다. 원문 마지막 문단을 그대로 살린 카드라 써도 되지만, 이 카드는 '첫 행동' 하나에 초점을 맞추면 더 좋겠습니다.
- 2번째 재작성 · style · cards.0.text: '태그만 달아 두면 정리가 끝나요'는 원문의 '같은 주제 노트가 한 화면에 모인다'보다 조금 과장되게 들리므로 '같은 주제끼리 한 화면에 모여요' 정도로 맞추면 좋겠다.
- 2번째 재작성 · style · cards.5: 태그 권유가 1번 카드, 마지막 본문 카드, 마무리 카드에 거듭 나와 겹치는 느낌이 있으니 마지막 본문 카드는 '폴더 없이 시작한다'는 점에 무게를 두면 반복이 줄어든다.
재작성 사유: 자기 평가 1

### ai-tool-memo × me (시안 A) · 2회

표지 후보 6개 (호출 2·재작성 0): 「모아 1.2 써 보니 바뀐 것 4가지」 · 「폴더 아직 직접 만드세요?」 · 「회의록은 "어제"로 찾아요」 · 「보낸 공유 링크 7일 뒤 안 열려요」 · 「모아 처음이라면 태그부터 붙이세요」 · 「써 보고 알게 된 주의할 점 3가지」

본문: saved (호출 2·재작성 0) · PNG `tests/results/2026-10-15-cards-body-v1/ai-tool-memo-me-2`

- 1. [cover] 모아 1.2 ⏎ 써 보니 **바뀐 것** 4가지 ⏎ 일주일 써 보고 실제로 손이 간 것만 골랐어요
- 2. [body] 폴더 대신 ⏎ 태그 하나로 묶여요 ⏎ 모아 1.2에서 가장 먼저 손이 간 건 태그예요. ⏎  ⏎ 예전에는 폴더를 직접 만들어야 했는데, 이제 **태그 하나로 같은 주제 노트가 한 화면에 모여요.** 태그를 붙이면 노트가 자동으로 묶이거든요. ⏎  ⏎ 그래서 처음 쓰는 분이라면 폴더부터 만들 필요가 없어요. 노트를 쓰고 태그만 붙여 보세요.  ← 근거: "태그를 붙이면 노트가 자동으로 묶인다. 예전에는 폴더를 직접 만들어야 했는데, 이제 태그 하나로 같은 주제 노트가 한 화면에 모인다."  🖼 Flat minimal illustration of a note-taking app screen where several note cards with matching colored tag labels gather together into one neat group, soft pastel colors, clean UI style, no people, no hands, no text, 4:5 aspect ratio, 1080x1350
- 3. [body] 검색창에 ⏎ "어제"라고 써 보세요 ⏎ 검색창에 날짜를 쓰면 그날 쓴 노트만 보여요. ⏎  ⏎ 날짜를 정확히 몰라도 괜찮아요. **"어제"라고 써도 돼요.** ⏎  ⏎ 일주일 써 보면서 회의록을 찾을 때 이 기능을 제일 많이 썼어요. 언제 썼는지만 기억나면 바로 찾을 수 있어요.  ← 근거: "검색창에 날짜를 쓰면 그날 쓴 노트만 보인다. "어제"라고 써도 된다. 회의록을 찾을 때 제일 많이 썼다."  🖼 Flat minimal illustration of a search bar with a small calendar icon beside it, below it a short filtered list of note cards, soft pastel colors, clean app UI style, no people, no hands, no text, 4:5 aspect ratio, 1080x1350
- 4. [body] 공유 링크는 ⏎ 7일 뒤 사라져요 ⏎ 링크를 보낸 사람이 일주일 지나서 열면 안 열려요. ⏎  ⏎ 잠깐 보여 줄 자료라면 공유 링크로 충분해요. 하지만 **오래 둘 자료는 내보내기로 따로 저장해야 해요.** ⏎  ⏎ 팀플 자료처럼 나중에 다시 볼 것 같다면 링크만 보내고 끝내지 마세요.  ← 근거: "공유 링크는 7일 뒤 사라진다. 링크를 보낸 사람이 일주일 지나서 열면 안 열린다는 뜻이라, 오래 둘 자료는 내보내기로 따로 저장해야 한다."  🖼 Flat minimal illustration of a chain link icon slowly fading away next to a small hourglass and a calendar, soft pastel colors, simple symbolic style, no people, no hands, no text, 4:5 aspect ratio, 1080x1350
- 5. [body] 내보내기는 ⏎ Markdown 파일로만 ⏎ 내보내기는 Markdown 파일로만 돼요. ⏎  ⏎ **PDF로 바로 뽑는 기능은 아직 없어요.** 과제나 보고서처럼 PDF가 꼭 필요하다면 이 점을 미리 알고 쓰는 게 좋아요. ⏎  ⏎ 공유 링크가 7일 뒤 사라지니까, 남겨 둘 노트는 Markdown 파일로 내보내 두세요.  ← 근거: "내보내기는 Markdown 파일로만 된다. PDF 로 바로 뽑는 기능은 아직 없다."
- 6. [closing] 오늘은 노트에 ⏎ 태그부터 붙여 봐요 ⏎ 나중에 다시 보려면 저장해 두세요

본문 자기 평가 지적:
- 1번째 생성 · style · cards.0.text: 원문은 '실제로 손이 간 것'이라고만 했는데 '가장 먼저 손이 간 건 태그예요'라고 하면 순서까지 단정하는 말이 되니 '먼저 소개할 건 태그예요'처럼 누그러뜨리는 게 안전하다.
- 1번째 생성 · style · cards.1.text: '날짜를 정확히 몰라도 괜찮아요'는 원문의 '"어제"라고 써도 된다'보다 넓게 읽힐 수 있으니 '날짜 대신 "어제"라고 써도 돼요'처럼 범위를 원문에 맞추는 편이 낫다.
- 1번째 생성 · style · cards.3.text: 마지막 단락에서 3번 카드의 공유 링크 7일 이야기를 다시 꺼내 내보내기 카드의 초점이 흐려지니, 이 카드에서 바로 해 볼 행동 하나로 마무리하는 편이 깔끔하다.
재작성 사유: 없음

### budget-devlog × doyun (시안 C) · 1회

표지 후보 6개 (호출 2·재작성 0): 「영수증 찍으면 알아서 나뉜다」 · 「가게 이름 한 번만 고치면 끝」 · 「72%에서 88%로 올린 방법」 · 「아무도 안 써서 지운 기능」 · 「친구 5명이 먼저 써 봤더니」 · 「주말 세 번을 통째로 썼다」

본문: saved (호출 2·재작성 0) · PNG `tests/results/2026-10-15-cards-body-v1/budget-devlog-doyun-1`

- 1. [cover] 영수증 찍으면 ⏎ **알아서** 나뉜다 ⏎ 주말 세 번 써서 만든 영수증 사진 기능
- 2. [body] 주말 세 번을 ⏎ 통째로 썼어요 ⏎ 영수증 사진을 찍으면 항목이 알아서 나뉘는 기능을 만들었어요. ⏎  ⏎ 찍기만 하면 하나하나 옮겨 적지 않아도 되는 기능이에요. ⏎  ⏎ 만드는 데 3주가 걸렸고, **주말 세 번을 통째로** 여기에 썼어요.  ← 근거: "영수증 사진을 찍으면 항목이 알아서 나뉘는 기능을 3주 동안 만들었다. 주말 세 번을 통째로 썼다."  🖼 Flat pastel illustration of a smartphone scanning a crumpled paper receipt on a desk, the phone screen showing neatly separated colored item blocks, soft warm lighting, minimal clean background, no people, no hands, no text, 4:5 vertical composition, 1080x1350
- 3. [body] 가게 이름을 ⏎ 자꾸 틀렸어요 ⏎ 처음 버전은 금액은 잘 읽었는데, 가게 이름을 자주 틀렸어요. ⏎  ⏎ 친구 5명에게 먼저 써 보게 했더니 이런 말이 나왔어요. ⏎  ⏎ **가게 이름을 고치는 데 시간이 더 걸린다고요.** ⏎  ⏎ 편하자고 만든 기능인데, 오히려 손이 더 가고 있었던 거예요.  ← 근거: "처음 버전은 금액을 잘 읽었지만 가게 이름을 자주 틀렸다. 친구 5명에게 써 보게 했더니 가게 이름을 고치는 데 시간이 더 걸린다는 말이 나왔다."
- 4. [body] 한 번 고치면 ⏎ 다음부턴 기억해요 ⏎ 그래서 방식을 바꿨어요. 가게 이름은 처음 한 번만 고쳐 주면, 다음부터는 앱이 기억해요. ⏎  ⏎ **같은 가게를 두 번째 찍을 때부터는 고칠 필요가 없어요.** ⏎  ⏎ 자주 가는 가게일수록 손댈 일이 줄어드는 거죠.  ← 근거: "그래서 가게 이름은 처음 한 번만 고치면 다음부터 기억하게 바꿨다. 같은 가게를 두 번째 찍을 때부터는 고칠 필요가 없다."
- 5. [body] 72%에서 ⏎ 88%까지 ⏎ 영수증 속 항목을 제대로 나누는 정확도는 처음에 72%였어요. ⏎  ⏎ 그래서 자주 틀리는 항목 30개를 따로 정리해서 넣어 줬어요. ⏎  ⏎ 그랬더니 **88%까지 올랐어요.**  ← 근거: "항목 나누기 정확도는 처음 72%였는데, 자주 틀리는 항목 30개를 따로 정리해 넣은 뒤 88%까지 올랐다."  🖼 Minimal flat infographic of two rounded vertical bars, a shorter muted bar and a taller bright mint bar with an upward arrow between them, pastel background, clean geometric style, no people, no text, no numbers, 4:5 vertical composition, 1080x1350
- 6. [body] 아무도 안 써서 ⏎ 지운 기능도 있어요 ⏎ 만들기만 한 건 아니에요. 지운 기능도 있어요. ⏎  ⏎ 영수증을 찍으면 카테고리 색이 자동으로 바뀌는 기능이었는데요. ⏎  ⏎ 친구들이 **아무도 안 써서** 지웠어요.  ← 근거: "반대로 지운 기능도 있다. 영수증을 찍으면 자동으로 카테고리 색을 바꾸는 기능은 친구들이 아무도 안 써서 지웠다."  🖼 Flat pastel illustration of a row of colorful category color swatches on a phone screen, one swatch being dropped into a small trash bin icon, playful minimal style, soft background, no people, no hands, no text, 4:5 vertical composition, 1080x1350
- 7. [body] 다음엔 영수증 ⏎ 없이도 기록되게 ⏎ 다음에는 카드 문자 알림을 읽어서, 영수증이 없어도 기록되게 해 볼 생각이에요. ⏎  ⏎ 다만 **아직 시작은 안 했어요.** ⏎  ⏎ 지금은 생각만 해 둔 단계예요.  ← 근거: "다음에는 카드 문자 알림을 읽어서 영수증 없이도 기록되게 해 볼 생각이다. 아직 시작은 안 했다."
- 8. [closing] 다음 제작기도 ⏎ 같이 봐요 ⏎ 저장해 두고, 궁금한 건 댓글로 물어봐 주세요

본문 자기 평가 지적:
- 1번째 생성 · style · cards.0.text: '하나하나 옮겨 적지 않아도 되는 기능'은 소재에 직접 나온 말이 아니라 뜻을 풀어 쓴 설명이에요. 사실을 지어낸 건 아니지만, 원문 표현('항목이 알아서 나뉘는')에 더 가깝게 쓰면 더 안전해요.
재작성 사유: 없음

### budget-devlog × doyun (시안 C) · 2회

표지 후보 6개 (호출 2·재작성 0): 「영수증 찍으면 항목이 알아서」 · 「가게 이름, 또 고치세요?」 · 「72%에서 88%까지」 · 「영수증 정리 귀찮은 직장인께」 · 「친구 5명이 먼저 써 보고 한 말」 · 「주말 세 번을 통째로 썼어요」

본문: saved (호출 2·재작성 0) · PNG `tests/results/2026-10-15-cards-body-v1/budget-devlog-doyun-2`

- 1. [cover] 영수증 찍으면 ⏎ **항목이 알아서** ⏎ 주말 세 번을 통째로 써서 만든 기능 이야기
- 2. [body] 주말 세 번을 ⏎ 통째로 넣었어요 ⏎ 영수증 사진을 찍으면 항목이 알아서 나뉘는 기능을 만들었어요. ⏎  ⏎ 만드는 데 **3주**가 걸렸고, 그동안 주말 세 번을 통째로 썼어요. ⏎  ⏎ 산 것들을 하나하나 직접 적지 않아도 되게요.  ← 근거: "영수증 사진을 찍으면 항목이 알아서 나뉘는 기능을 3주 동안 만들었다. 주말 세 번을 통째로 썼다."  🖼 Flat pastel illustration of a smartphone camera scanning a paper receipt on a desk, the receipt lines floating out and sorting themselves into neat colored blocks, calm weekend mood with a small calendar and coffee cup, no people, no hands, no faces, no text, 4:5 vertical, 1080x1350
- 3. [body] 금액은 맞는데 ⏎ 가게 이름이 틀렸어요 ⏎ 처음 버전은 금액은 잘 읽었는데, 가게 이름을 자주 틀렸어요. ⏎  ⏎ 친구 5명에게 먼저 써 보게 했더니 이런 말이 나왔어요. ⏎  ⏎ **가게 이름 고치는 데 시간이 더 걸린다** ⏎  ⏎ 편하자고 만든 기능인데, 오히려 손이 더 가고 있었던 거죠.  ← 근거: "처음 버전은 금액을 잘 읽었지만 가게 이름을 자주 틀렸다. 친구 5명에게 써 보게 했더니 가게 이름을 고치는 데 시간이 더 걸린다는 말이 나왔다."
- 4. [body] 한 번만 고치면 ⏎ 다음부턴 기억해요 ⏎ 그래서 방법을 바꿨어요. ⏎  ⏎ 가게 이름은 처음 한 번만 고쳐 주면, 앱이 그걸 기억해요. ⏎  ⏎ **같은 가게를 두 번째 찍을 때부터는 고칠 필요가 없어요.** ⏎  ⏎ 자주 가는 가게라면 한 번 고치고 끝이에요.  ← 근거: "그래서 가게 이름은 처음 한 번만 고치면 다음부터 기억하게 바꿨다. 같은 가게를 두 번째 찍을 때부터는 고칠 필요가 없다."
- 5. [body] 72%에서 88%로 ⏎ 올라간 이유 ⏎ 영수증 속 항목을 제대로 나누는 비율은 처음에 72%였어요. ⏎  ⏎ 자주 틀리는 항목 30개를 따로 정리해서 넣었더니 **88%까지 올랐어요.** ⏎  ⏎ 특별한 비법보다는, 자주 틀리는 걸 모아서 하나씩 챙긴 게 컸어요.  ← 근거: "항목 나누기 정확도는 처음 72%였는데, 자주 틀리는 항목 30개를 따로 정리해 넣은 뒤 88%까지 올랐다."  🖼 Minimal flat illustration of two vertical bars rising like a progress chart, the second bar taller and glowing, small receipt icons and checkmark symbols stacked beside it, soft pastel palette, clean background, no people, no hands, no text, no numbers, 4:5 vertical, 1080x1350
- 6. [body] 아무도 안 써서 ⏎ 지운 기능도 있어요 ⏎ 반대로 지운 기능도 있어요. ⏎  ⏎ 영수증을 찍으면 카테고리 색이 자동으로 바뀌는 기능이었는데요. ⏎  ⏎ 친구들이 **아무도 안 썼어요.** 그래서 지웠어요. ⏎  ⏎ 만든 걸 빼는 것도 만드는 일의 일부더라고요.  ← 근거: "반대로 지운 기능도 있다. 영수증을 찍으면 자동으로 카테고리 색을 바꾸는 기능은 친구들이 아무도 안 써서 지웠다."  🖼 Flat pastel illustration of colorful category color swatches gently falling into a small minimalist trash bin, a phone screen nearby showing plain blank blocks, quiet and honest mood, no people, no hands, no faces, no text, 4:5 vertical, 1080x1350
- 7. [body] 다음엔 영수증 ⏎ 없이도 기록되게 ⏎ 다음에는 카드 문자 알림을 읽어서, 영수증이 없어도 기록되게 해 볼 생각이에요. ⏎  ⏎ **아직 시작은 안 했어요.** ⏎  ⏎ 생각만 해 둔 단계라, 어떻게 될지는 저도 아직 몰라요.  ← 근거: "다음에는 카드 문자 알림을 읽어서 영수증 없이도 기록되게 해 볼 생각이다. 아직 시작은 안 했다."
- 8. [closing] 다음 제작기도 ⏎ 팔로우로 받아 보세요 ⏎ 가계부 쓸 때 제일 귀찮은 게 뭔지 댓글로 알려 주세요

본문 자기 평가 지적:
- 1번째 생성 · style · cards.4: '특별한 비법보다는, 자주 틀리는 걸 모아서 하나씩 챙긴 게 컸어요'는 원문에 없는 평가라서, 원문대로 '30개를 정리해 넣은 뒤 올랐다'는 사실만 남기는 편이 안전합니다.
- 1번째 생성 · style · cards.1: 마지막 줄 '산 것들을 하나하나 직접 적지 않아도 되게요.'는 앞 문장과 이어지지 않는 조각 문장이라, '~하려고 만든 기능이에요'처럼 이어 주면 더 자연스럽습니다.
- 1번째 생성 · style · cards.5: '만든 걸 빼는 것도 만드는 일의 일부더라고요'는 원문에 없는 소감이지만 말투 규칙에 맞는 정도라, 꼭 고칠 필요는 없고 더 담백하게 줄여도 됩니다.
재작성 사유: 없음

### dessert-visit × seoyeon (시안 B) · 1회

표지 후보 6개 (호출 2·재작성 0): 「온실 베이커리 줄 서도 될까?」 · 「주말 40분 웨이팅 딸기 타르트는 값했다」 · 「주말에 온실 갈 사람 11시에 가세요」 · 「타르트는 합격 커피는 평범했다」 · 「온실 베이커리 웨이팅 피하는 3가지」 · 「평일엔 줄 없고 주말엔 40분」

본문: saved (호출 6·재작성 2) · PNG `tests/results/2026-10-15-cards-body-v1/dessert-visit-seoyeon-1`

- 1. [cover] 온실 베이커리 ⏎ **줄 서도** 될까? ⏎ 평일·주말 두 번 가 보고 내린 결론
- 2. [body] 결론: 딸기 타르트라면 ⏎ 줄 서도 돼요 ⏎ 평일 한 번, 주말 한 번 가 보고 내린 결론부터 말할게요. ⏎  ⏎ **딸기 타르트 때문이라면 줄 서도 아깝지 않아요.** ⏎  ⏎ 다만 주말에 갈 거면 오픈 시간에 맞춰 가는 걸 추천해요. 왜 그런지는 다음 장에서 바로 알려 줄게요.  ← 근거: "결론: 딸기 타르트 때문이라면 줄 서도 아깝지 않다. 다만 주말이면 오픈 시간에 맞춰 가자."
- 3. [body] 평일은 바로 입장, ⏎ 주말은 40분 대기 ⏎ 평일 오후 3시에 갔을 땐 웨이팅이 아예 없었어요. ⏎  ⏎ 그런데 주말 오후 1시에 갔더니 40분을 기다렸어요. ⏎  ⏎ 주말에 간다면 **문 여는 11시에 맞춰 가는 게** 제일 나아요. 시간 여유 있으면 평일 오후가 훨씬 편해요.  ← 근거: "평일 오후 3시에는 웨이팅이 없었다. 주말 오후 1시에는 40분을 기다렸다. 주말에 갈 거면 문 여는 11시에 맞춰 가는 게 낫다."
- 4. [body] 딸기 타르트는 ⏎ 두 번 다 만족했어요 ⏎ 대표 메뉴인 딸기 타르트는 7,500원이에요. ⏎  ⏎ 딸기가 크고 크림이 덜 달아서 **평일에도 주말에도 두 번 다 만족했어요.** ⏎  ⏎ 줄 서는 이유가 이 타르트라면 충분히 납득돼요.  ← 근거: "대표 메뉴인 딸기 타르트는 7,500원이다. 딸기가 크고 크림이 덜 달아서 두 번 다 만족했다."  🖼 Close-up food photo of a strawberry tart with large fresh strawberries on light cream, on a simple ceramic plate on a wooden cafe table, soft natural window light, warm bakery mood, no people, no hands, no text, 4:5 vertical composition, 1080x1350
- 5. [body] 피스타치오 크루아상은 ⏎ 주말엔 일찍 품절돼요 ⏎ 피스타치오 크루아상은 6,800원이에요. ⏎  ⏎ 주말에 갔을 땐 **오후 2시에 이미 다 팔리고 없었어요.** ⏎  ⏎ 이 메뉴까지 먹어 보고 싶다면 주말엔 더더욱 오픈 시간에 맞춰 가세요.  ← 근거: "피스타치오 크루아상은 6,800원인데, 주말에 갔을 때는 오후 2시에 이미 다 팔렸다."
- 6. [body] 자리는 12석뿐, ⏎ 창가 4석을 노려요 ⏎ 자리는 딱 12석뿐이에요. ⏎  ⏎ 그중 **창가 자리 4석이 제일 밝아서 사진 찍기 좋아요.** 사진 남기고 싶으면 창가부터 확인하세요. ⏎  ⏎ 자리가 없으면 포장도 방법이에요. 포장은 기다리지 않고 바로 돼요.  ← 근거: "자리는 12석뿐이다. 창가 자리 4석이 제일 밝아서 사진 찍기 좋다. 포장은 기다리지 않고 바로 된다."  🖼 Cozy small bakery cafe interior with a few window-side seats bathed in bright natural daylight, greenhouse-like plants near the glass, empty chairs and small tables, no people, no hands, no text, 4:5 vertical composition, 1080x1350
- 7. [body] 아쉬운 건 ⏎ 아메리카노였어요 ⏎ 솔직히 아메리카노는 아쉬웠어요. ⏎  ⏎ **디저트에 비해 커피 맛이 평범했어요.** ⏎  ⏎ 여기는 커피보다 디저트를 먹으러 가는 곳이라고 생각하고 가면 실망이 덜할 거예요.  ← 근거: "아쉬웠던 건 아메리카노다. 디저트에 비해 커피 맛이 평범했다."
- 8. [closing] 주말 가기 전에 ⏎ 저장해 두세요 ⏎ 같이 갈 친구도 태그해 주세요

본문 자기 평가 지적:
- 1번째 생성 · fact · cards.4: 원문은 '자리는 12석뿐이다'라고만 했는데 카드에 '금방 차요'라는 평가를 더했어요. 소재 원문 어디에도 없는 말이에요.
- 1번째 생성 · style · cards.3: 제목 '일찍 품절돼요'에서 주말 조건이 빠져 늘 그런 것처럼 읽혀요. '주말엔 일찍 품절돼요'처럼 조건을 넣으면 원문과 더 맞아요.
- 2번째 재작성 · fact · cards.3.title: 원문은 '주말에 갔을 때는 오후 2시에 이미 다 팔렸다'는 한 번의 주말 경험인데, 제목 '일찍 품절돼요'는 '주말'이라는 조건을 빼고 늘 일찍 품절되는 것처럼 범위를 넓혔으므로 '주말엔 일찍 품절돼요'처럼 조건을 살려야 한다.
- 2번째 재작성 · style · cards.4.image.prompt: 'greenhouse-like plants near the glass'는 가게 이름 '온실'에서 짐작한 묘사일 뿐 원문에 식물 이야기는 없어서, 실제 매장과 다른 인상을 줄 수 있으니 빼는 편이 안전하다.
- 3번째 재작성 · style · cards.4.image.prompt: 'greenhouse-like plants near the glass'는 가게 이름(온실)에서 떠올린 장면이라 소재에 없는 내부 모습이 그려질 수 있어요. 창가 자리와 밝은 자연광만 남기는 게 안전해요.
- 3번째 재작성 · style · cards.4: 자리(12석·창가 4석)와 포장 팁이 한 장에 같이 있어요. '자리가 없으면'으로 이어 두어 한 가지 말로 읽히지만, 포장 문장을 더 짧게 줄이면 요점이 더 또렷해져요.
재작성 사유: 자기 평가 2

### dessert-visit × seoyeon (시안 B) · 2회

표지 후보 6개 (호출 2·재작성 0): 「온실 베이커리 줄 서도 아깝지 않다」 · 「온실 베이커리 40분 기다릴 만해?」 · 「주말에 갈 거면 11시에 가세요」 · 「타르트는 합격 커피는 평범」 · 「온실 베이커리 갈 때 알아 둘 4가지」 · 「피스타치오 크루아상 주말 2시엔 품절」

뺀 후보:
- 「평일 0분 주말 **40분**」 / 부제 「온실 베이커리, 같은 집인데 웨이팅이 이렇게 달라요」 — [number_not_in_source] 소재·프로필·메모에 없는 숫자 "0" 을(를) 썼습니다.

본문: saved (호출 3·재작성 1) · PNG `tests/results/2026-10-15-cards-body-v1/dessert-visit-seoyeon-2`

- 1. [cover] 온실 베이커리 ⏎ 줄 서도 **아깝지 않다** ⏎ 평일·주말 두 번 가 보고 내린 판정, 딸기 타르트 때문이라면 가도 돼요
- 2. [body] 딸기 타르트 때문이라면 ⏎ 가도 돼요 ⏎ 결론부터 말할게요. ⏎  ⏎ 온실 베이커리에 평일 한 번, 주말 한 번 가 봤어요. **딸기 타르트 때문이라면 줄 서도 아깝지 않아요.** ⏎  ⏎ 다만 아쉬운 점도 있어서 뒤에 솔직하게 적었어요. 웨이팅·자리 팁까지 넘겨 보고 판단하세요.  ← 근거: "결론: 딸기 타르트 때문이라면 줄 서도 아깝지 않다."
- 3. [body] 주말엔 11시 오픈에 ⏎ 맞춰 가세요 ⏎ 평일 오후 3시에는 웨이팅이 없었어요. ⏎  ⏎ 주말 오후 1시에는 40분을 기다렸어요. ⏎  ⏎ **주말에 갈 거면 문 여는 11시에 맞춰 가는 게 나아요.** 시간 여유가 있으면 평일 오후도 좋아요.  ← 근거: "평일 오후 3시에는 웨이팅이 없었다. 주말 오후 1시에는 40분을 기다렸다. 주말에 갈 거면 문 여는 11시에 맞춰 가는 게 낫다."  🖼 Flat illustration of a cozy greenhouse-style bakery storefront with a wall clock showing 11 o'clock and an open sign shape without letters, warm morning light, soft pastel colors, no people, no text, 4:5 vertical composition, 1080x1350
- 4. [body] 딸기 타르트 7,500원 ⏎ 두 번 다 만족 ⏎ 대표 메뉴인 딸기 타르트는 7,500원이에요. ⏎  ⏎ 딸기가 크고 크림이 덜 달아서 평일에도 주말에도 **두 번 다 만족했어요.** ⏎  ⏎ 이 집에 간다면 이건 꼭 먹어 보세요.  ← 근거: "대표 메뉴인 딸기 타르트는 7,500원이다. 딸기가 크고 크림이 덜 달아서 두 번 다 만족했다."  🖼 Close-up food photo of a strawberry tart topped with large fresh strawberries over light cream, on a ceramic plate on a wooden table, soft natural window light, greenhouse cafe mood, no people, no hands, no text, 4:5 vertical, 1080x1350
- 5. [body] 피스타치오 크루아상은 ⏎ 일찍 가야 있어요 ⏎ 피스타치오 크루아상은 6,800원이에요. ⏎  ⏎ 그런데 주말에 갔을 때는 오후 2시에 이미 다 팔렸어요. ⏎  ⏎ **이것까지 먹고 싶다면 주말엔 오픈 시간에 맞춰 가는 게 안전해요.**  ← 근거: "피스타치오 크루아상은 6,800원인데, 주말에 갔을 때는 오후 2시에 이미 다 팔렸다."
- 6. [body] 자리는 12석뿐, ⏎ 사진은 창가 4석 ⏎ 자리는 12석뿐이라 넉넉하진 않아요. ⏎  ⏎ 창가 자리 4석이 제일 밝아서 사진 찍기 좋아요. 사진이 목적이면 창가부터 노려 보세요. ⏎  ⏎ **자리가 없으면 포장도 방법이에요.** 포장은 기다리지 않고 바로 돼요.  ← 근거: "자리는 12석뿐이다. 창가 자리 4석이 제일 밝아서 사진 찍기 좋다. 포장은 기다리지 않고 바로 된다."  🖼 Bright window-side seats in a small greenhouse-style bakery cafe, four seats along a large glass window with plants, sunlight pouring in, empty chairs, a tart on the table, no people, no text, 4:5 vertical, 1080x1350
- 7. [body] 아쉬운 건 ⏎ 아메리카노 ⏎ 솔직하게 말하면 아쉬웠던 건 아메리카노예요. ⏎  ⏎ 디저트에 비해 **커피 맛이 평범했어요.** ⏎  ⏎ 커피 맛집을 기대하고 가면 실망할 수 있어요. 여기선 디저트에 집중하세요.  ← 근거: "아쉬웠던 건 아메리카노다. 디저트에 비해 커피 맛이 평범했다."
- 8. [closing] 주말에 가기 전 ⏎ 저장해 두세요 ⏎ 가 본 분들은 댓글로 웨이팅 상황 알려 주세요

본문 자기 평가 지적:
- 2번째 재작성 · style · cards.2.text: 원문에는 '평일 오후 3시에 웨이팅이 없었다'고만 나오므로, '평일 오후도 좋아요'처럼 평일 오후 전체로 넓히기보다 '평일 오후 3시쯤'이라고 시간을 그대로 두면 더 정확해요.
- 2번째 재작성 · style · cards.4.title: 원문은 '주말 오후 2시에 다 팔렸다'까지만 말하므로, '일찍 가야 있어요'라고 단정하기보다 '주말 오후엔 품절돼요'처럼 겪은 사실 쪽으로 쓰면 더 솔직하게 읽혀요.
재작성 사유: 근거 규칙 1
