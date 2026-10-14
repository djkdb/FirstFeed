# 브랜딩 키트 측정 · 2026-10-14 · brand-visualv1-reviewv1

- 프롬프트: brand_words@v1, brand_visual@v1, brand_words_review@v1, self_review@v2, identity_profile@v2, identity_followup@v2, 모델 brand_words opus · brand_visual opus, 사람당 2회
- 입력 프로필: tests/fixtures/<세트>/profiles/<id>.json 스냅숏 (매번 같은 프로필)
- 「빠진 후보」는 규칙에 걸려 빼고 남은 후보만 보인 것 — 실패가 아니라 넉넉히 받아 거른 수

## 실제 · 공개 (1명 × 2회)

| 지표 | 글 (brand_words) | 시각 (brand_visual) |
|---|---|---|
| 끝까지 완료 | 2/2 | 2/2 |
| 1회 통과 (재작성 0) | 2/2 | 2/2 |
| 평균 호출 · 재작성 | 2.0 · 0.0 | 1.0 · 0.0 |
| 평균 시간 | 81.4초 | 50.4초 |
| 목록마다 다 채움 (5개 / 3개) | 2/2 | 2/2 |
| 빠진 후보 — 바이오 길이 초과 | 0 | — |
| 빠진 후보 — 주소·없는 @아이디 | 0 | — |
| 빠진 후보 — 원문 밖 숫자·영문 | 0 | — |
| 빠진 후보 — 아이디 규칙·중복 | 0 | 0 |
| 빠진 후보 — 명암비 미달 | — | 0 |
| 빠진 후보 — 목록 밖 폰트·쓰임 | — | 0 |
| 빠진 후보 — 그림 프롬프트 위반 | — | 0 |
| 실사 인물·나이 프로필 프롬프트 (재작성 전 포함) | — | 0 |
| 폰트 3안 — 제목 느낌 수 평균 (최대 3) | — | 2.0 |
| 폰트 3안 — 서로 다른 폰트 수 평균 (최대 6) | — | 4.5 |
| 폰트 3안 — 같은 폰트 짝 (전체) | — | 1 |
| 자기 평가가 잡은 「하지 않은 약속」 fact | 0 | — |
| 자기 평가 fact·broken 전체 | 0 | — |
| 잠자기가 낀 회차 | 0/2 | |

### me

프로필 — AI 입문자에게 직접 써 본 도구를 바로 쓰게 정리 · 축: 직접 써 본 새 도구 / AI로 만든 것 / 대외활동 기록 · 말투: 원문·공식 문서로 확인하고 직접 써 본 것만 말한다 / 전공자가 아니어도 따라 할 수 있게, 궁금한 것만 쉽게 쓴다 / 소개로 끝내지 않고 본 그날 바로 다르게 해 볼 수 있는 것 하나로 마무리한다 · 보여 주는 방식: 안 한다 — 직접 만든 캐릭터(ZUN)로 대신한다

#### 1회

- 아이디: `zun.ai` · `zun.ai.tools` · `ai.with.zun` · `zun.tried.it` · `zun_vibecoding`
- 표시 이름: ZUN | 써 보고 정리하는 AI 도구 · AI 입문 도구 노트 · ZUN · ZUN | 바이브코딩 하는 대학생 · 오늘 써 볼 AI 도구 | ZUN · ZUN · 비전공자도 따라 하는 AI
- 바이오:
  - AI 막 시작한 대학생·주니어 개발자용 ⏎ 공식 문서로 확인하고 직접 써 본 AI 도구만 ⏎ 🔧 새 도구 사용기 · 🤖 바이브코딩 결과물 · 📝 대외활동 기록 ⏎ 오늘 바로 해 볼 것 하나씩 (103자)
  - 소프트웨어학부 대학생이 직접 써 본 AI·개발 도구 ⏎ 좋아진 점, 잘 쓰는 법, 다들 하는 실수까지 ⏎ 바이브코딩 결과물 · 대외활동 기록도 ⏎ 얼굴 대신 직접 만든 캐릭터 ZUN (95자)
  - 네이버 AI 디깅클럽 · 청년 공공 AX 서포터즈 선정 ⏎ 새 AI 도구를 직접 써 보고 바로 쓰게 정리합니다 ⏎ 바이브코딩 결과물 · 대외활동 기록 ⏎ 협업 문의는 DM (89자)
  - 소문 말고 공식 문서, 소개 말고 직접 써 본 것 ⏎ AI 입문자를 위한 새 도구 정리 ⏎ ✅ 오늘 바로 다르게 해 볼 것 하나 ⏎ 🔧 바이브코딩으로 만든 것 · 대외활동 기록 (93자)
  - 전공 안 해도 따라 할 수 있는 AI 도구 사용법 ⏎ 궁금한 것만 쉽게, 써 본 것만 정직하게 ⏎ 새 도구 · 바이브코딩 결과물 · 대외활동 ⏎ 얼굴 대신 캐릭터 ZUN · 소프트웨어학부 재학 (101자)
- 팔레트:
  - Terminal Mint: primary #0F766E, secondary #99F6E4, accent #F59E0B, background #F7FAF9, text #1F2937 · 글자/배경 13.98 · 주색 위 5.21
  - Night Studio: primary #A78BFA, secondary #1F2937, accent #34D399, background #111827, text #F3F4F6 · 글자/배경 16.12 · 주색 위 6.52
  - Sunny Notebook: primary #C2410C, secondary #FDE2B8, accent #2563EB, background #FFF8EC, text #2B2118 · 글자/배경 14.92 · 주색 위 4.90
- 폰트 짝: paperlogy+pretendard · suit+gowun-dodum · ibm-plex-sans-kr+pretendard
- 그림 프롬프트:
  - [profile · ZUN 프로필] Profile picture of ZUN, the creator's own original mascot character. Draw ZUN strictly from the attached ZUN reference image; do not invent or change its shape, colors or features. ZUN centered, friendly pose, shown from the chest up, filling about 70% of a circular crop area. Plain soft mint background (#F7FAF9) with a subtle teal (#0F766E) ring. Flat vector illustration, thick rounded outlines, clean and simple, readable at small size. No human faces, no real people. 1:1 square, 1080x1080, no text, no letters, no logos.
  - [highlight · 직접 써 본 새 도구] Instagram highlight cover. A simple icon of a laptop with a small wrench and a checkmark, meaning 'a new tool, tested by hand'. The icon is centered within a circle in the middle of the frame, with generous empty space around it so it survives a circular crop. Flat vector illustration, thick rounded outlines, teal (#0F766E) and amber (#F59E0B) on a soft mint background (#F7FAF9), same style as the other covers. No people, no faces, no hands. 9:16 vertical, 1080x1920, no text, no letters, no logos.
  - [highlight · AI로 만든 것] Instagram highlight cover. A simple icon of a code window with a small sparkle and a building block popping out, meaning 'something made with AI through vibe coding'. The icon is centered within a circle in the middle of the frame, with generous empty space around it so it survives a circular crop. Flat vector illustration, thick rounded outlines, teal (#0F766E) and amber (#F59E0B) on a soft mint background (#F7FAF9), same style as the other covers. No people, no faces, no hands. 9:16 vertical, 1080x1920, no text, no letters, no logos.
  - [highlight · 대외활동 기록] Instagram highlight cover. A simple icon of an open notebook with a small bookmark and two linked chat bubbles, meaning 'a record of activities and collaborations'. The icon is centered within a circle in the middle of the frame, with generous empty space around it so it survives a circular crop. Flat vector illustration, thick rounded outlines, teal (#0F766E) and amber (#F59E0B) on a soft mint background (#F7FAF9), same style as the other covers. No people, no faces, no hands. 9:16 vertical, 1080x1920, no text, no letters, no logos.

#### 2회

- 아이디: `zun.ai` · `zun_tried_ai` · `ai.today.zun` · `vibecoding.zun` · `ai.starter.zun`
- 표시 이름: ZUN | 써 본 AI 도구 정리 · ZUN · 오늘 써먹는 AI · ZUN · 비전공자도 따라 하는 AI · 직접 써 본 AI | ZUN · ZUN | 바이브코딩 하는 학생
- 바이오:
  - 새로 나온 AI 도구, 직접 써 보고 바로 쓰게 정리해요 ⏎ 🔍 써 본 새 도구 · 🧩 AI로 만든 것 · 📝 대외활동 기록 ⏎ 공식 문서로 확인한 것만 씁니다 (88자)
  - AI 입문자를 위한 '오늘 바로 해 볼 것 하나' ⏎ 직접 써 본 새 도구 정리 | 바이브코딩으로 만든 것 | 대외활동 기록 (67자)
  - 남이 정리한 거 말고, 공식 문서 보고 직접 써 본 AI 도구만 ⏎ 좋아진 점 · 더 잘 쓰는 법 · 다들 하는 실수 ⏎ + 바이브코딩 결과물 · 대외활동 기록 (85자)
  - 소프트웨어학부 학생이 AI로 직접 써 보고 만든 기록 ⏎ 🔍 새 AI·개발 도구 써 보기 ⏎ 🧩 바이브코딩 결과물과 과정 ⏎ 🤝 대외활동·협업 이야기 (80자)
  - 전공 안 해도 따라 할 수 있는 AI 도구 사용법 ⏎ 궁금한 것만 쉽게, 본 날 바로 해 볼 것 하나로 끝내요 ⏎ 새 도구 · AI로 만든 것 · 대외활동 (82자)
- 팔레트:
  - Terminal Mint: primary #0F6E5A, secondary #CDEBE1, accent #FFB547, background #F7FAF8, text #14201B · 글자/배경 15.96 · 주색 위 5.88
  - Night Coder: primary #8B7CF6, secondary #2A2D3D, accent #5EEAD4, background #12131A, text #EDEEF5 · 글자/배경 16.01 · 주색 위 5.57
  - Sticky Note: primary #C2410C, secondary #FFE3B3, accent #2F6FEB, background #FFF8EC, text #2B2118 · 글자/배경 14.92 · 주색 위 4.90
- 폰트 짝: paperlogy+pretendard · suit+suit · ibm-plex-sans-kr+pretendard
- 그림 프롬프트:
  - [profile · 프로필] 1:1 square, 1080x1080, flat vector illustration for an Instagram profile picture of an AI-tools guide account. Centered composition: a rounded chat bubble merged with a blinking code cursor and a small sparkle, symbolizing trying new AI tools hands-on. Simple bold shapes, soft rounded corners, minimal flat colors (deep mint green, warm yellow accent, off-white background), generous padding so it reads well when cropped to a circle. No people, no faces, no human figures, no text, no letters, no logos, no watermark.
  - [highlight · 직접 써 본 새 도구] 9:16 vertical, 1080x1920, flat vector illustration for an Instagram highlight cover. The key subject is centered within a circle in the middle of the frame: an open laptop showing a simple app window with a checkmark and a small wrench, representing testing a new AI tool hands-on. Plain solid off-white background, deep mint green and warm yellow accent, simple rounded shapes, large empty margins above and below the circle. No people, no faces, no text, no letters, no logos, no watermark.
  - [highlight · AI로 만든 것] 9:16 vertical, 1080x1920, flat vector illustration for an Instagram highlight cover. The key subject is centered within a circle in the middle of the frame: a code editor window with angle brackets turning into small building blocks and a sparkle, representing building things with AI through vibe coding. Plain solid off-white background, deep mint green and warm yellow accent, simple rounded shapes, large empty margins above and below the circle. No people, no faces, no text, no letters, no logos, no watermark.
  - [highlight · 대외활동 기록] 9:16 vertical, 1080x1920, flat vector illustration for an Instagram highlight cover. The key subject is centered within a circle in the middle of the frame: an open notebook with a bookmark ribbon, a small calendar page and two connected speech bubbles, representing recording collaborations and external activities. Plain solid off-white background, deep mint green and warm yellow accent, simple rounded shapes, large empty margins above and below the circle. No people, no faces, no text, no letters, no logos, no watermark.

## 실제 · 비공개 (0명 × 2회)

(아직 자료 없음)

## AI 생성 (2명 × 2회)

| 지표 | 글 (brand_words) | 시각 (brand_visual) |
|---|---|---|
| 끝까지 완료 | 4/4 | 4/4 |
| 1회 통과 (재작성 0) | 4/4 | 4/4 |
| 평균 호출 · 재작성 | 2.0 · 0.0 | 1.0 · 0.0 |
| 평균 시간 | 66.3초 | 36.9초 |
| 목록마다 다 채움 (5개 / 3개) | 4/4 | 4/4 |
| 빠진 후보 — 바이오 길이 초과 | 0 | — |
| 빠진 후보 — 주소·없는 @아이디 | 0 | — |
| 빠진 후보 — 원문 밖 숫자·영문 | 0 | — |
| 빠진 후보 — 아이디 규칙·중복 | 0 | 0 |
| 빠진 후보 — 명암비 미달 | — | 0 |
| 빠진 후보 — 목록 밖 폰트·쓰임 | — | 0 |
| 빠진 후보 — 그림 프롬프트 위반 | — | 0 |
| 실사 인물·나이 프로필 프롬프트 (재작성 전 포함) | — | 0 |
| 폰트 3안 — 제목 느낌 수 평균 (최대 3) | — | 3.0 |
| 폰트 3안 — 서로 다른 폰트 수 평균 (최대 6) | — | 5.3 |
| 폰트 3안 — 같은 폰트 짝 (전체) | — | 0 |
| 자기 평가가 잡은 「하지 않은 약속」 fact | 0 | — |
| 자기 평가 fact·broken 전체 | 0 | — |
| 잠자기가 낀 회차 | 0/4 | |

### doyun

프로필 — 돈 관리가 귀찮은 직장인을 위한 가계부 앱 제작 일지 · 축: 기능 제작기 / 지운 기능 노트 / 혼자 만드는 근황 · 말투: 개발 용어 대신 앱을 쓰는 사람이 바로 알아듣는 말로 씁니다 / 앱 자랑보다 만들고 지우며 겪은 일을 솔직하게 털어놓습니다 / 친구에게 먼저 써 보라고 권하듯 가볍고 편하게 말합니다 · 보여 주는 방식: 안 한다

#### 1회

- 아이디: `gagyebu.diary` · `afterwork.gagyebu` · `lazy.money.log` · `solo.gagyebu.maker` · `gagyebu.build.log`
- 표시 이름: 가계부 앱 만드는 일지 · 퇴근 후 가계부 앱 만들기 · 혼자 만드는 가계부 앱 · 지운 기능이 더 많은 가계부 · 돈 관리 귀찮은 직장인 가계부
- 바이오:
  - 돈 관리 귀찮은 직장인을 위한 가계부 앱, 퇴근 후 혼자 만드는 중 ⏎ 🔨 새로 만든 기능 제작기 ⏎ ❌ 친구들이 안 써서 지운 기능 노트 ⏎ 🌙 광고비 없이 키우는 근황 (91자)
  - 쓰는 사람은 아직 친구 몇 명뿐인 가계부 앱을 혼자 만들어요. 기능 하나 만든 이야기, 안 써서 지운 기능, 퇴근 후 근황을 솔직하게 적어요. (79자)
  - 지운 기능이 만든 기능보다 많은 가계부 앱 일지. 친구들이 먼저 써 보고 안 쓰면 지워요. 만든 것도, 지운 것도, 혼자 만드는 근황도 다 적어요. (82자)
  - 돈 관리, 귀찮죠? 그 귀찮음을 하나씩 덜어 주는 가계부 앱을 만들어요. 영수증을 찍으면 항목이 알아서 나뉘는 기능처럼, 만든 과정과 지운 기능 이야기를 올려요. (90자)
  - 퇴근하고 혼자 가계부 앱 만드는 중. 새로 만든 기능, 써 보니 별로라 지운 기능, 광고비 없이 버티는 근황까지 다 털어놓는 일지 (72자)
- 팔레트:
  - 퇴근 후 노트: primary #1F3A5F, secondary #8FA9C7, accent #F2B544, background #F7F4EE, text #1E1E24 · 글자/배경 15.11 · 주색 위 10.46
  - 영수증 종이: primary #A8432A, secondary #E9C9A8, accent #3E7C59, background #FFF8F0, text #2B2118 · 글자/배경 14.95 · 주색 위 5.69
  - 민트 동전: primary #276B5D, secondary #A8D5C2, accent #FF8A5B, background #F3F8F5, text #14261F · 글자/배경 14.74 · 주색 위 5.84
- 폰트 짝: paperlogy+pretendard · suit+gowun-dodum · gowun-batang+gowun-dodum
- 그림 프롬프트:
  - [profile · 프로필] Flat minimal illustration, 1:1 square, 1080x1080. A small open notebook with a single coin resting on it and a pencil beside it, lit by the warm glow of a desk lamp, centered composition on a plain soft background. Limited palette of deep navy, warm yellow and off-white, simple shapes, subtle paper texture, calm late-evening mood. No people, no faces, no hands, no logos, no text, no letters, no numbers.
  - [highlight · 기능 제작기] Flat minimal illustration, vertical 9:16, 1080x1920. Main subject centered within a circle in the middle of the frame: a tiny toolbox with a small wrench and pencil fitting a coin-shaped puzzle piece into place, suggesting building something that makes money chores easier. Plain soft background with lots of empty space around the circle. Same limited palette of deep navy, warm yellow and off-white, simple shapes, subtle paper texture. No people, no faces, no hands, no app screens, no logos, no text, no letters, no numbers.
  - [highlight · 지운 기능 노트] Flat minimal illustration, vertical 9:16, 1080x1920. Main subject centered within a circle in the middle of the frame: a pink eraser halfway through rubbing out a simple sketched rounded-rectangle button shape on notebook paper, with a few eraser crumbs scattered, honest and slightly humorous feeling. Plain soft background with lots of empty space around the circle. Same limited palette of deep navy, warm yellow and off-white, simple shapes, subtle paper texture. No people, no faces, no hands, no app screens, no logos, no text, no letters, no numbers.
  - [highlight · 혼자 만드는 근황] Flat minimal illustration, vertical 9:16, 1080x1920. Main subject centered within a circle in the middle of the frame: a quiet desk at night with a half-open laptop glowing softly, a desk lamp, a mug of tea and a crescent moon visible through a small window, cozy solo after-work mood. Plain soft background with lots of empty space around the circle. Same limited palette of deep navy, warm yellow and off-white, simple shapes, subtle paper texture. No people, no faces, no hands, no readable screen content, no logos, no text, no letters, no numbers.

#### 2회

- 아이디: `gagyebu.making` · `budget.app.diary` · `lazy.money.app` · `deleted.features.log` · `afterwork.budget.app`
- 표시 이름: 혼자 만드는 가계부 앱 일지 · 퇴근 후 가계부 앱 만드는 중 · 돈 관리 귀찮은 사람의 가계부 · 지운 기능이 더 많은 가계부 앱 · 가계부 앱 제작 일지 · 혼자 만드는 중
- 바이오:
  - 돈 관리 귀찮은 직장인을 위한 가계부 앱, 퇴근 후 혼자 만드는 중 ⏎ 새로 만든 기능 · 친구들이 안 써서 지운 기능 · 혼자 키우는 근황 (76자)
  - 영수증 찍으면 항목이 알아서 나뉘게, 주말 세 번을 통째로 썼어요 ⏎ 귀찮음 덜어 주는 가계부 앱 제작 일지 ⏎ 만든 기능보다 지운 기능이 더 많아요 (79자)
  - 📒 친구들이 안 쓰면 과감하게 지워요 ⏎ 지운 기능 목록이 만든 기능보다 긴 가계부 앱 일지 ⏎ 기능 제작기 · 지운 기능 노트 · 퇴근 후 근황 (78자)
  - 광고비 없이, 퇴근 후 혼자 6개월째 만드는 가계부 앱 ⏎ 뭘 만들고 뭘 지웠는지, 혼자 키우는 근황까지 솔직하게 적어요 (65자)
  - 가계부 쓰기 귀찮은 20대 직장인이라면 같이 봐요 ⏎ 귀찮음을 덜어 줄 기능은 만들고, 안 쓰는 기능은 지우는 과정을 기록해요 (68자)
- 팔레트:
  - 퇴근길 민트: primary #276B5C, secondary #A8D5C4, accent #F2B84B, background #F7F5EF, text #1F2A28 · 글자/배경 13.56 · 주색 위 5.76
  - 영수증 종이: primary #222222, secondary #8A8378, accent #D9482B, background #FAF7F0, text #222222 · 글자/배경 14.87 · 주색 위 14.87
  - 새벽 남색: primary #F4C95D, secondary #3A4A6B, accent #7FD1B9, background #141B2D, text #EDEFF4 · 글자/배경 14.91 · 주색 위 10.91
- 폰트 짝: suit+pretendard · paperlogy+pretendard · gowun-batang+gowun-dodum
- 그림 프롬프트:
  - [profile · 프로필] Square 1:1 profile image, 1080x1080. Flat vector illustration with soft paper grain: a small open notebook-style budget ledger with a few coins and a crumpled receipt on a desk, lit by a warm desk lamp at night, cozy after-work mood. Simple bold shapes, centered composition that reads well at tiny size, muted teal green and warm yellow on off-white background. No people, no faces, no hands, no text, no letters, no numbers, no logos.
  - [highlight · 기능 제작기] Vertical 9:16 highlight cover, 1080x1920. Flat vector illustration with soft paper grain, main subject centered within a circle in the middle of the frame: a simple smartphone outline with a small sparkle and a tiny wrench, suggesting a new helpful feature that removes hassle. Plenty of empty space around the circle, muted teal green and warm yellow on off-white background, same style as a cozy budget-app diary. No people, no faces, no hands, no text, no letters, no numbers, no logos.
  - [highlight · 지운 기능 노트] Vertical 9:16 highlight cover, 1080x1920. Flat vector illustration with soft paper grain, main subject centered within a circle in the middle of the frame: a small sticky note being gently erased by a pencil eraser, with a few eraser crumbs, suggesting a removed feature recorded honestly. Plenty of empty space around the circle, muted teal green and warm yellow on off-white background, same style as a cozy budget-app diary. No people, no faces, no hands, no text, no letters, no numbers, no logos.
  - [highlight · 혼자 만드는 근황] Vertical 9:16 highlight cover, 1080x1920. Flat vector illustration with soft paper grain, main subject centered within a circle in the middle of the frame: a laptop on a small desk with a mug of tea and a desk lamp, a crescent moon visible through a window, suggesting building an app alone after work at night. Plenty of empty space around the circle, muted teal green and warm yellow on off-white background, same style as a cozy budget-app diary. No people, no faces, no hands, no text, no letters, no numbers, no logos.

### seoyeon

프로필 — 줄 서도 아깝지 않은 디저트만 솔직하게 골라요 · 축: 두 번 가 본 판정 리뷰 / 동네 디저트 지도 / 디저트 일상 기록 · 말투: 맛없으면 맛없다고, 실망했으면 실망했다고 솔직하게 써요 / 가도 될지 말지 결론부터 말해서 30초 안에 판단할 수 있게 해요 / 친구가 물어볼 때 알려 주듯 편하게, 웨이팅·자리 팁까지 구체적으로 써요 · 보여 주는 방식: 괜찮다

#### 1회

- 아이디: `dessert.judge` · `julseo.dessert` · `dessert.twice` · `worth.the.wait` · `honest_dessert`
- 표시 이름: 줄 서도 될까? | 디저트 판정 · 두 번 가 본 디저트 리뷰 · 솔직한 디저트 판정 · 갈까 말까 디저트 리뷰 · 웨이팅 아깝지 않은 디저트
- 바이오:
  - 줄 서도 아깝지 않은 디저트만 솔직하게 골라요 ⏎ ✔ 평일·주말 두 번 가 보고 판정 ⏎ ✔ 저장해 두고 쓰는 동네 디저트 지도 ⏎ ✔ 카페 다니는 날의 기록 ⏎ 협찬은 꼭 밝혀요 (92자)
  - 맛없으면 맛없다고 써요 🍰 ⏎ 갈지 말지 30초 안에 결론부터 ⏎ 웨이팅·자리 잡기 팁까지 친구처럼 알려 줄게요 ⏎ 동네 디저트 지도 · 디저트 일상 (78자)
  - 주말에 갈 카페 고민될 때 🧁 ⏎ 같은 가게 평일·주말 두 번 가 보고 가도 될지 말지 판정해요 ⏎ 저장해 두고 쓰는 동네 디저트 지도도 그려요 (77자)
  - 📍 직접 그린 동네 디저트 지도, 저장해 두고 쓰세요 ⏎ 두 번 가 본 솔직 판정 리뷰 ⏎ 디저트 먹는 날의 기록 (60자)
  - 줄 서서 먹고 실망한 적이 너무 많아서 시작했어요 ⏎ 이제 가도 될지 말지 먼저 판정해 줄게요 ⏎ 웨이팅·자리 팁 / 동네 디저트 지도 / 디저트 일상 (80자)
- 팔레트:
  - 딸기 크림: primary #B0274A, secondary #F6C9C9, accent #6B8F5E, background #FFF8F3, text #3A2A2A · 글자/배경 12.93 · 주색 위 6.17
  - 말차 노트: primary #2F5D3A, secondary #C9D8B6, accent #D98E3F, background #F4F1E6, text #1F2A22 · 글자/배경 13.15 · 주색 위 6.76
  - 웨이팅 판정: primary #FFC83D, secondary #E85D3A, accent #7FC8A9, background #1C1A1A, text #FFF4E0 · 글자/배경 15.90 · 주색 위 11.21
- 폰트 짝: paperlogy+pretendard · suit+gowun-dodum · gowun-batang+pretendard
- 그림 프롬프트:
  - [profile · 프로필] Square profile image, 1:1, 1080x1080. Warm hand-drawn gouache illustration of two hands holding a small plate with a strawberry cream shortcake and a fork, seen from slightly above, on a soft cream background (#FFF8F3). Palette of strawberry pink (#B0274A), pale pink, pistachio green and cocoa brown. Simple, friendly, cozy cafe mood, subject centered with generous margin so it reads clearly when cropped to a circle. No faces, no people beyond hands, no logos, no text.
  - [highlight · 두 번 가 본 판정 리뷰] Instagram story highlight cover, 9:16, 1080x1920. Warm hand-drawn gouache illustration on a plain cream background (#FFF8F3): a single slice of cake on a plate next to a small cafe chair and a tiny row of queue stanchions, suggesting waiting in line and judging a dessert. Main subject centered within a circle in the middle of the frame, with empty calm space above and below. Palette of strawberry pink (#B0274A), pale pink, pistachio green and cocoa brown, same style as the profile image. No faces, no text, no letters, no numbers.
  - [highlight · 동네 디저트 지도] Instagram story highlight cover, 9:16, 1080x1920. Warm hand-drawn gouache illustration on a plain cream background (#FFF8F3): a small folded paper street map with hand-drawn roads and three tiny dessert icons (a croissant, a macaron, a cake slice) pinned like map markers, plus a little location pin. Main subject centered within a circle in the middle of the frame, with empty calm space above and below. Palette of strawberry pink (#B0274A), pale pink, pistachio green and cocoa brown, same style as the profile image. No faces, no text, no street names, no letters, no numbers.
  - [highlight · 디저트 일상 기록] Instagram story highlight cover, 9:16, 1080x1920. Warm hand-drawn gouache illustration on a plain cream background (#FFF8F3): a top-down cafe table moment with a latte cup, a small dessert plate with a madeleine, and an open notebook with a pen, cozy everyday diary mood. Main subject centered within a circle in the middle of the frame, with empty calm space above and below. Palette of strawberry pink (#B0274A), pale pink, pistachio green and cocoa brown, same style as the profile image. No faces, no text, no handwriting, no letters, no numbers.

#### 2회

- 아이디: `julseodo.dessert` · `galkka.malkka.dessert` · `twice.dessert` · `dessert.verdict` · `honest_dessert_pick`
- 표시 이름: 줄 서도 되는 디저트 · 갈까 말까 디저트 · 두 번 가 보는 디저트 리뷰 · 솔직 디저트 판정 · 디저트 지도 그리는 사람
- 바이오:
  - 줄 서도 아깝지 않은 디저트만 솔직하게 골라요 ⏎ 평일·주말 두 번 가 보고 판정 ⏎ 직접 그린 동네 디저트 지도 ⏎ 협찬은 꼭 밝혀요 (69자)
  - 갈까 말까, 결론부터 말해요 ⏎ 맛없으면 맛없다고 써요 ⏎ 웨이팅·자리 잡기 팁까지 ⏎ 주말 카페 고르는 서울·경기 20~30대를 위해 (69자)
  - 같은 가게 평일 한 번, 주말 한 번 ⏎ 웨이팅 시간·자리 팁 + 갈지 말지 판정 ⏎ 저장해 두고 쓰는 동네 디저트 지도도 그려요 (68자)
  - 친구들이 먼저 물어보던 디저트 솔직 후기 ⏎ 실망한 곳은 실망했다고 써요 ⏎ 두 번 가 본 판정 리뷰 · 동네 디저트 지도 · 카페 다니는 일상 (76자)
  - 직접 그린 동네 디저트 지도 🗺️ ⏎ 저장해 두고 주말 카페 갈 때 꺼내 보세요 ⏎ 두 번 가 본 판정 리뷰 · 디저트 일상 기록 (69자)
- 팔레트:
  - 버터 크림: primary #8A4B2A, secondary #F2C48D, accent #E2574C, background #FFF8EE, text #2B1D14 · 글자/배경 15.45 · 주색 위 6.38
  - 말차 라떼: primary #4F6B3A, secondary #C9D6A3, accent #D98A3D, background #F3F5EC, text #1F2A1C · 글자/배경 13.57 · 주색 위 5.46
  - 딸기 판정: primary #C2304A, secondary #F7B7C0, accent #2E7D6B, background #FFF1F2, text #3A1220 · 글자/배경 14.85 · 주색 위 5.01
- 폰트 짝: paperlogy+pretendard · gowun-batang+gowun-dodum · suit+noto-sans-kr
- 그림 프롬프트:
  - [profile · 프로필] Square profile photo, 1:1, 1080x1080, no text. Close-up of two hands holding a small ceramic plate with a glossy strawberry tart and a fork, shot from slightly above on a warm cream linen tablecloth in a sunlit cafe. Soft natural window light, gentle film grain, warm butter-cream and caramel tones, shallow depth of field. Subject centered with generous margin so it reads clearly when cropped to a circle. No face visible, no logos, no watermark.
  - [highlight · 두 번 가 본 판정 리뷰] Instagram story highlight cover, 9:16, 1080x1920, no text. A single slice of layered cake on a small plate beside a tiny hourglass and a cafe number-tag stand, suggesting waiting time and a verdict. Main subject centered within a circle in the middle of the frame, plain warm cream background around it, soft natural light, gentle film grain, caramel and butter tones matching a cohesive dessert-review feed. Minimal, clean, no letters, no numbers, no logos.
  - [highlight · 동네 디저트 지도] Instagram story highlight cover, 9:16, 1080x1920, no text. Top-down view of a hand-drawn illustrated neighborhood map on cream paper with tiny doodled cafes, winding streets, and small dessert icons like a croissant and a cupcake marked with pins, a colored pencil resting beside it. Key map area centered within a circle in the middle of the frame, plain warm cream background around it, soft natural light, gentle film grain, warm caramel and butter tones. No readable letters, street names, or numbers, no logos.
  - [highlight · 디저트 일상 기록] Instagram story highlight cover, 9:16, 1080x1920, no text. A cozy cafe table moment: a latte with latte art, a half-eaten madeleine, an open blank notebook, and a small film camera, seen from above. Main arrangement centered within a circle in the middle of the frame, plain warm cream background around it, soft afternoon window light, gentle film grain, warm caramel and butter tones consistent with a single personal dessert diary feed. No people's faces, no writing on the notebook, no logos.
