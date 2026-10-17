# 템플릿 넘침 측정 · 2026-10-18 · templates-F

- 판정 브라우저: playwright-chromium 156.0.8078.4 (기준 브라우저) · 변형 F·F·light·F·dark·F·busy × 브랜드 3 × 테스트 세트(그림 변형은 표지·릴스 표지만) = 198장
- 그림 바탕 변형(F·light 등)은 테스트 그림 `tests/fixtures/generated/images/` 위에 그린 것 — 「명암 부족」은 띠를 가장 진하게 해도 4.5:1 미만
- 테스트 세트: `tests/fixtures/generated/overflow/cases.json` (AI 생성 원고) · 브랜드: me = 실제·공개(운영자 키트), doyun·seoyeon = AI 생성
- PNG: `tests/results/2026-10-18-templates-F/<시안>-<브랜드>/<case>.png`, 한눈에 보기 `_sheet.png` (빨간 테두리 = 원고 줄이기 판정, 마지막 단계 82% 크기로 찍은 것)
- 「눈 확인」은 사람이 PNG 를 열어 본 결과 — devlog 에 적는다

| 변형 | 브랜드 | 통과 | 줄여서 통과 | 원고 줄이기 | 대체 글꼴 | 명암 부족 | 띠 진하기 |
|---|---|---|---|---|---|---|---|
| F | me | 20 | 1 | 3 | 0 | 0 | - |
| F | doyun | 20 | 0 | 4 | 0 | 0 | - |
| F | seoyeon | 20 | 1 | 3 | 0 | 0 | - |
| F·light | me | 11 | 0 | 3 | 0 | 0 | 0.7·0.3 |
| F·light | doyun | 11 | 0 | 3 | 0 | 0 | 0.7·0.3 |
| F·light | seoyeon | 11 | 0 | 3 | 0 | 0 | 0.7·0.3 |
| F·dark | me | 11 | 0 | 3 | 0 | 0 | 0.3 |
| F·dark | doyun | 11 | 0 | 3 | 0 | 0 | 0.3 |
| F·dark | seoyeon | 11 | 0 | 3 | 0 | 0 | 0.3 |
| F·busy | me | 11 | 0 | 3 | 0 | 0 | 0.7·0.3·0.5 |
| F·busy | doyun | 11 | 0 | 3 | 0 | 0 | 0.7·0.3·0.5 |
| F·busy | seoyeon | 11 | 0 | 3 | 0 | 0 | 0.7·0.3·0.5 |

## 테스트 세트별 (기대 → 조합의 결과)

| case | 모양 | 기대 | 결과 (F · F·light · F·dark · F·busy 순서로 me·doyun·seoyeon) |
|---|---|---|---|
| c01-normal | 보통 | 통과 | 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 |
| c02-long-ko-word | 긴 한글 낱말 | 원고 줄이기 | 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 |
| c03-long-en-name | 긴 영문 이름 | 원고 줄이기 | 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 |
| c04-url-sub | 긴 영문 URL | 통과 | 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 |
| c05-emoji | 이모지 | 통과 | 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 |
| c06-numbers | 숫자 많은 줄 | 통과 | 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 |
| c07-short | 아주 짧은 글 | 통과 | 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 |
| c08-near-limit | 한도 근처 | 줄여서 통과 | 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 |
| c09-too-long | 한도 넘음 | 원고 줄이기 | 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 · 원고 줄이기 |
| b01-normal | 보통 | 통과 | 통과 · 통과 · 통과 |
| b02-long-text | 한도 넘음 | 원고 줄이기 | 통과 · 통과 · 통과 |
| b03-long-ko-word | 긴 한글 낱말 | 원고 줄이기 | 통과 · 통과 · 통과 |
| b04-url | 긴 영문 URL | 통과 | 통과 · 통과 · 통과 |
| b05-numbers | 숫자 많은 줄 | 통과 | 통과 · 통과 · 통과 |
| b06-emoji | 이모지 | 통과 | 통과 · 통과 · 통과 |
| b07-short | 아주 짧은 글 | 통과 | 통과 · 통과 · 통과 |
| e01-normal | 보통 | 통과 | 통과 · 통과 · 통과 |
| e02-long | 한도 넘음 | 원고 줄이기 | 줄여서 82% · 원고 줄이기 · 줄여서 82% |
| e03-short | 아주 짧은 글 | 통과 | 통과 · 통과 · 통과 |
| r01-normal | 보통 | 통과 | 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 |
| r02-long-ko-word | 긴 한글 낱말 | 원고 줄이기 | 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 |
| r03-emoji | 이모지 | 통과 | 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 |
| r04-numbers | 숫자 많은 줄 | 통과 | 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 |
| r05-short | 아주 짧은 글 | 통과 | 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 · 통과 |

## 판정 실패의 이유 (DOM 측정) — 원고를 줄이라는 안내

- F-me c02-long-ko-word: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (207px). / 칸 "headline" 의 글이 카드 밖으로 207px 나갑니다.
- F-me c03-long-en-name: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (504px). / 칸 "headline" 의 글이 카드 밖으로 504px 나갑니다.
- F-me c09-too-long: "headline" 이 글자 크기를 82% 까지 줄여도 넘칩니다 (4줄 / 최대 3줄). 약 10자 줄이세요(지금 38자). / 칸 "headline" 이 4줄입니다 (최대 3줄).
- F-doyun c02-long-ko-word: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (249px). / 칸 "headline" 의 글이 카드 밖으로 249px 나갑니다.
- F-doyun c03-long-en-name: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (253px). / 칸 "headline" 의 글이 카드 밖으로 253px 나갑니다.
- F-doyun c09-too-long: "headline" 이 글자 크기를 82% 까지 줄여도 넘칩니다 (4줄 / 최대 3줄). 약 10자 줄이세요(지금 38자). / 칸 "headline" 이 4줄입니다 (최대 3줄).
- F-doyun e02-long: "headline" 이 글자 크기를 82% 까지 줄여도 넘칩니다 (4줄 / 최대 3줄). 약 12자 줄이세요(지금 46자). / 칸 "headline" 이 4줄입니다 (최대 3줄).
- F-seoyeon c02-long-ko-word: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (199px). / 칸 "headline" 의 글이 카드 밖으로 199px 나갑니다.
- F-seoyeon c03-long-en-name: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (276px). / 칸 "headline" 의 글이 카드 밖으로 276px 나갑니다.
- F-seoyeon c09-too-long: "headline" 이 글자 크기를 82% 까지 줄여도 넘칩니다 (4줄 / 최대 3줄). 약 10자 줄이세요(지금 38자). / 칸 "headline" 이 4줄입니다 (최대 3줄).
- F·light-me c02-long-ko-word: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (207px). / 칸 "headline" 의 글이 카드 밖으로 207px 나갑니다.
- F·light-me c03-long-en-name: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (504px). / 칸 "headline" 의 글이 카드 밖으로 504px 나갑니다.
- F·light-me c09-too-long: "headline" 이 글자 크기를 82% 까지 줄여도 넘칩니다 (4줄 / 최대 3줄). 약 10자 줄이세요(지금 38자). / 칸 "headline" 이 4줄입니다 (최대 3줄).
- F·light-doyun c02-long-ko-word: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (249px). / 칸 "headline" 의 글이 카드 밖으로 249px 나갑니다.
- F·light-doyun c03-long-en-name: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (253px). / 칸 "headline" 의 글이 카드 밖으로 253px 나갑니다.
- F·light-doyun c09-too-long: "headline" 이 글자 크기를 82% 까지 줄여도 넘칩니다 (4줄 / 최대 3줄). 약 10자 줄이세요(지금 38자). / 칸 "headline" 이 4줄입니다 (최대 3줄).
- F·light-seoyeon c02-long-ko-word: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (199px). / 칸 "headline" 의 글이 카드 밖으로 199px 나갑니다.
- F·light-seoyeon c03-long-en-name: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (276px). / 칸 "headline" 의 글이 카드 밖으로 276px 나갑니다.
- F·light-seoyeon c09-too-long: "headline" 이 글자 크기를 82% 까지 줄여도 넘칩니다 (4줄 / 최대 3줄). 약 10자 줄이세요(지금 38자). / 칸 "headline" 이 4줄입니다 (최대 3줄).
- F·dark-me c02-long-ko-word: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (207px). / 칸 "headline" 의 글이 카드 밖으로 207px 나갑니다.
- F·dark-me c03-long-en-name: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (504px). / 칸 "headline" 의 글이 카드 밖으로 504px 나갑니다.
- F·dark-me c09-too-long: "headline" 이 글자 크기를 82% 까지 줄여도 넘칩니다 (4줄 / 최대 3줄). 약 10자 줄이세요(지금 38자). / 칸 "headline" 이 4줄입니다 (최대 3줄).
- F·dark-doyun c02-long-ko-word: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (249px). / 칸 "headline" 의 글이 카드 밖으로 249px 나갑니다.
- F·dark-doyun c03-long-en-name: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (253px). / 칸 "headline" 의 글이 카드 밖으로 253px 나갑니다.
- F·dark-doyun c09-too-long: "headline" 이 글자 크기를 82% 까지 줄여도 넘칩니다 (4줄 / 최대 3줄). 약 10자 줄이세요(지금 38자). / 칸 "headline" 이 4줄입니다 (최대 3줄).
- F·dark-seoyeon c02-long-ko-word: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (199px). / 칸 "headline" 의 글이 카드 밖으로 199px 나갑니다.
- F·dark-seoyeon c03-long-en-name: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (276px). / 칸 "headline" 의 글이 카드 밖으로 276px 나갑니다.
- F·dark-seoyeon c09-too-long: "headline" 이 글자 크기를 82% 까지 줄여도 넘칩니다 (4줄 / 최대 3줄). 약 10자 줄이세요(지금 38자). / 칸 "headline" 이 4줄입니다 (최대 3줄).
- F·busy-me c02-long-ko-word: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (207px). / 칸 "headline" 의 글이 카드 밖으로 207px 나갑니다.
- F·busy-me c03-long-en-name: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (504px). / 칸 "headline" 의 글이 카드 밖으로 504px 나갑니다.
- F·busy-me c09-too-long: "headline" 이 글자 크기를 82% 까지 줄여도 넘칩니다 (4줄 / 최대 3줄). 약 10자 줄이세요(지금 38자). / 칸 "headline" 이 4줄입니다 (최대 3줄).
- F·busy-doyun c02-long-ko-word: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (249px). / 칸 "headline" 의 글이 카드 밖으로 249px 나갑니다.
- F·busy-doyun c03-long-en-name: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (253px). / 칸 "headline" 의 글이 카드 밖으로 253px 나갑니다.
- F·busy-doyun c09-too-long: "headline" 이 글자 크기를 82% 까지 줄여도 넘칩니다 (4줄 / 최대 3줄). 약 10자 줄이세요(지금 38자). / 칸 "headline" 이 4줄입니다 (최대 3줄).
- F·busy-seoyeon c02-long-ko-word: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (199px). / 칸 "headline" 의 글이 카드 밖으로 199px 나갑니다.
- F·busy-seoyeon c03-long-en-name: "headline" 에 띄어쓰기 없이 긴 낱말이 있어 가로로 넘칩니다. 긴 낱말을 나누거나 짧은 말로 바꾸세요. / 칸 "headline" 의 글이 칸을 넘칩니다 (276px). / 칸 "headline" 의 글이 카드 밖으로 276px 나갑니다.
- F·busy-seoyeon c09-too-long: "headline" 이 글자 크기를 82% 까지 줄여도 넘칩니다 (4줄 / 최대 3줄). 약 10자 줄이세요(지금 38자). / 칸 "headline" 이 4줄입니다 (최대 3줄).
