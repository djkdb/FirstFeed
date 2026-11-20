# 개성 캐릭터 추천 측정 — v1 (2026-11-08)

- 프롬프트: character_suggest v1 · 모델 설정 opus · 실제 모델 claude-opus-5-5
- 입력: 프로필 스냅숏(tests/fixtures/*/profiles) + 브랜드 키트(tests/fixtures/*/brands) — me 실제·공개, doyun · seoyeon AI 생성. 실제·비공개 자료 없음

| 회 | 사람 | 결과 | 재작성 | 걸린 규칙 | 시간 | 입력 · 캐시 쓰기 · 캐시 읽기 · 출력 토큰 |
|---|---|---|---|---|---|---|
| 1 | me(실제·공개) | 통과 | 0 | 없음 | 13초 | 2 · 5998 · 0 · 1110 |
| 1 | doyun(AI 생성) | 통과 | 0 | 없음 | 15초 | 2 · 4111 · 1759 · 1176 |
| 1 | seoyeon(AI 생성) | 통과 | 0 | 없음 | 9초 | 2 · 4124 · 1759 · 735 |

## 1회 · me(실제·공개) — 통과 · 재작성 0 · 13초

- **Zun** — 새 AI 도구를 먼저 켜 보고 쓰는 법을 들어 보이는 작은 초록 로봇 / '직접 써 본 새 도구' 축과 얼굴 대신 캐릭터로 보여 주는 방식을 따른 무난한 안  
  `object/robot/flat/clean/cel` · 소품 laptop, badge · 성격 curious, cheerful · 색 primary/accent
- **Byte** — 후드티에 비니 차림으로 노트북 화면을 가리키며 따라 해 보자는 동글이 선배 / 대학생·주니어 개발자 눈높이에서 쉽게 따라 하게 돕는 말투를 따름  
  `human/round/chibi/bold/flat` · 소품 laptop, coffee · 성격 nerdy, calm · 색 text/primary
- **Blip** — 바이브코딩으로 뭔가 만들 때마다 폴짝 튀어 오르는 노란 픽셀 슬라임 / 'AI로 만든 것' 축의 만드는 재미와 그날 바로 해 보는 마무리를 살린 과감한 안  
  `creature/slime/pixel/none/flat` · 소품 headphones, pencil · 성격 playful, curious · 색 accent/primary

첫 안의 조립된 프롬프트(캐릭터 한 장):

```
an original object mascot character, shaped like a small robot, big round shiny eyes, rosy cheek blush, main color #10B981, holding a tiny laptop and a blank round badge, accent color #FDE047. flat vector illustration, clean even outlines, two-tone cel shading. It has a curious, cheerful personality, showing a gentle smile, holding up its item proudly. Set on a plain solid #0B1220 background, square 1:1 composition. Illustrated character, not photorealistic. Clean silhouette, centered, full body visible, no text, no letters, no watermark, no logo. Avoid photorealistic rendering or real photos or extra limbs or a cropped head or a busy background.
```

## 1회 · doyun(AI 생성) — 통과 · 재작성 0 · 15초

- **Nibble** — 볼에 동전을 모아 두는, 귀찮음 많지만 알뜰한 햄스터 메이트 / 돈 관리를 귀찮아하는 20대 직장인이 편하게 느끼도록 친구처럼 가볍고 친근한 말투를 따름  
  `animal/hamster/flat/clean/cel` · 소품 laptop, coffee · 성격 cheerful, curious · 색 secondary/accent
- **Dusk** — 퇴근 후 후드티 차림으로 혼자 앱을 만드는 졸린 눈의 메이커 / 광고비 없이 퇴근 후 혼자 앱을 키우는 근황 축과 솔직하게 털어놓는 말투를 담음  
  `human/round/chibi/bold/flat` · 소품 laptop, coffee · 성격 calm, grumpy · 색 primary/secondary
- **Scribble** — 기능을 적었다 지웠다 하는, 연필 든 꼬깃한 메모지 캐릭터 / 기능 제작기와 지운 기능 노트 축처럼 만들고 지우며 겪은 일을 기록하는 느낌을 살림  
  `object/note/crayon/sketchy/grain` · 소품 pencil, badge · 성격 playful, nerdy · 색 accent/primary

첫 안의 조립된 프롬프트(캐릭터 한 장):

```
an original animal mascot character, shaped like a hamster, big round shiny eyes, rosy cheek blush, main color #F2B84B, holding a tiny laptop and holding a coffee cup, accent color #E86A4F. flat vector illustration, clean even outlines, two-tone cel shading. It has a cheerful, curious personality, showing a gentle smile, waving hello. Set on a plain solid #FAF7F0 background, square 1:1 composition. Illustrated character, not photorealistic. Clean silhouette, centered, full body visible, no text, no letters, no watermark, no logo. Avoid photorealistic rendering or real photos or extra limbs or a cropped head or a busy background.
```

## 1회 · seoyeon(AI 생성) — 통과 · 재작성 0 · 9초

- **Mochi** — 줄 끝에서 빼꼼 고개 내밀고 맛을 솔직하게 판정해 주는 햄스터 / 두 번 가 본 판정 리뷰 축과, 친구처럼 편하게 결론부터 말하는 말투를 따랐어요  
  `animal/hamster/sticker/bold/cel` · 소품 badge, coffee · 성격 cheerful, confident · 색 secondary/primary
- **Plum** — 맛없으면 시큰둥한 얼굴로 솔직하게 말하는 디저트 머그컵 / 맛없으면 맛없다고 쓰는 솔직한 말투와, 주말 카페를 찾는 사람의 시선을 담았어요  
  `object/mug/flat/clean/flat` · 소품 pencil, badge · 성격 grumpy, calm · 색 primary/accent
- **Juno** — 직접 그린 동네 디저트 지도를 들고 카페를 다니는 그림책 속 친구 / 동네 디저트 지도와 디저트 일상 기록 축을 따라 손그림 느낌으로 담았어요  
  `human/round/storybook/sketchy/grain` · 소품 backpack, pencil · 성격 curious, playful · 색 accent/secondary

첫 안의 조립된 프롬프트(캐릭터 한 장):

```
an original animal mascot character, shaped like a hamster, big round shiny eyes, rosy cheek blush, main color #F2B8C0, wearing an apron in #B0304A, a blank round badge and holding a coffee cup, accent color #B0304A. die-cut sticker illustration with a white outline, thick bold outlines, two-tone cel shading. It has a cheerful, confident personality, showing a big grin, giving a thumbs up. Set on a plain solid #FFF8F0 background, square 1:1 composition. Illustrated character, not photorealistic. Clean silhouette, centered, full body visible, no text, no letters, no watermark, no logo. Avoid photorealistic rendering or real photos or extra limbs or a cropped head or a busy background.
```

사람이 읽은 판정은 devlog 에 적는다.
