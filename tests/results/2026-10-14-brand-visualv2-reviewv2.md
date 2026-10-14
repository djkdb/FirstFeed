# 브랜딩 키트 측정 · 2026-10-14 · brand-visualv2-reviewv2

- 프롬프트: brand_words@v1, brand_visual@v2, brand_words_review@v2, self_review@v2, identity_profile@v2, identity_followup@v2, 모델 brand_words opus · brand_visual opus, 사람당 2회
- 입력 프로필: tests/fixtures/<세트>/profiles/<id>.json 스냅숏 (매번 같은 프로필)
- 「빠진 후보」는 규칙에 걸려 빼고 남은 후보만 보인 것 — 실패가 아니라 넉넉히 받아 거른 수

## 실제 · 공개 (1명 × 2회)

| 지표 | 글 (brand_words) | 시각 (brand_visual) |
|---|---|---|
| 끝까지 완료 | 2/2 | 2/2 |
| 1회 통과 (재작성 0) | 2/2 | 2/2 |
| 평균 호출 · 재작성 | 2.0 · 0.0 | 1.0 · 0.0 |
| 평균 시간 | 59.3초 | 33.4초 |
| 목록마다 다 채움 (5개 / 3개) | 2/2 | 2/2 |
| 빠진 후보 — 바이오 길이 초과 | 0 | — |
| 빠진 후보 — 주소·없는 @아이디 | 0 | — |
| 빠진 후보 — 원문 밖 숫자·영문 | 0 | — |
| 빠진 후보 — 아이디 규칙·중복 | 0 | 0 |
| 빠진 후보 — 명암비 미달 | — | 0 |
| 빠진 후보 — 목록 밖 폰트·쓰임 | — | 0 |
| 빠진 후보 — 그림 프롬프트 위반 | — | 0 |
| 실사 인물·나이 프로필 프롬프트 (재작성 전 포함) | — | 0 |
| 폰트 3안 — 제목 느낌 수 평균 (최대 3) | — | 3.0 |
| 폰트 3안 — 서로 다른 폰트 수 평균 (최대 6) | — | 5.5 |
| 폰트 3안 — 같은 폰트 짝 (전체) | — | 0 |
| 자기 평가가 잡은 「하지 않은 약속」 fact | 1 | — |
| 자기 평가 fact·broken 전체 | 1 | — |
| 잠자기가 낀 회차 | 0/2 | |

### me

프로필 — AI 입문자에게 직접 써 본 도구를 바로 쓰게 정리 · 축: 직접 써 본 새 도구 / AI로 만든 것 / 대외활동 기록 · 말투: 원문·공식 문서로 확인하고 직접 써 본 것만 말한다 / 전공자가 아니어도 따라 할 수 있게, 궁금한 것만 쉽게 쓴다 / 소개로 끝내지 않고 본 그날 바로 다르게 해 볼 수 있는 것 하나로 마무리한다 · 보여 주는 방식: 안 한다 — 직접 만든 캐릭터(ZUN)로 대신한다

#### 1회

- 아이디: `zun.ai.tools` · `zun_tried_ai` · `ai.today.zun` · `vibecoding.zun` · `zun.tryit`
- 표시 이름: ZUN | 써 본 AI 도구 정리 · ZUN · AI 입문 가이드 · 직접 써 본 AI 도구 | ZUN · ZUN | 바이브코딩 하는 대학생 · AI 오늘 바로 써보기 · ZUN
- 바이오:
  - 새로 나온 AI·개발 도구, 직접 써 보고 바로 쓰게 정리해요 ⏎ 🔧 써 본 새 도구 · 좋아진 점과 흔한 실수 ⏎ 💻 바이브코딩으로 만든 것 ⏎ 📝 대외활동 기록 (88자)
  - 공식 문서로 확인하고 직접 써 본 AI 도구만 다뤄요 ⏎ 읽고 나면 오늘 바로 해 볼 것 하나씩 🔧 ⏎ 새 도구 써 보기 · 바이브코딩 결과물 · 대외활동 기록 (86자)
  - AI 막 시작한 대학생·주니어 개발자를 위해 ⏎ 비전공자도 따라 할 수 있게 쉽게 정리해요 ⏎ 써 본 도구 | 만든 것 | 대외활동 (69자)
  - 소프트웨어학부 재학생이 직접 써 보고 만들어 본 AI 기록 ⏎ 📌 새 도구 쓰는 법·흔한 실수 ⏎ 📌 바이브코딩 과정과 비하인드 ⏎ 📌 대외활동·협업 이야기 (84자)
  - 네이버 AI 디깅클럽·청년 공공 AX 서포터즈 선정 ⏎ 새 AI 도구를 직접 써 보고 바로 쓰게 정리해요 ⏎ + 바이브코딩으로 만든 것 · 대외활동 기록 (81자)
- 팔레트:
  - Clear Blue Guide: primary #1D4ED8, secondary #93C5FD, accent #F59E0B, background #F8FAFC, text #0F172A · 글자/배경 17.06 · 주색 위 6.41
  - Terminal Mint: primary #10B981, secondary #1E293B, accent #FDE047, background #0B1220, text #E2E8F0 · 글자/배경 15.19 · 주색 위 7.38
  - Warm Notebook: primary #C2410C, secondary #FFD8A8, accent #2F9E44, background #FFF8EE, text #2B2118 · 글자/배경 14.93 · 주색 위 4.91
- 폰트 짝: paperlogy+pretendard · ibm-plex-sans-kr+pretendard · gowun-batang+gowun-dodum
- 그림 프롬프트:
  - [profile · 프로필] Profile icon for an Instagram account that explains AI tools to beginners. Draw the mascot character ZUN exactly following the user's own existing ZUN character artwork (do not invent or change its design, proportions, or colors), shown from the chest up and centered, sitting in front of a small glowing laptop with a tiny sparkle icon. Flat, clean vector illustration, soft blue (#1D4ED8) and light blue (#93C5FD) background circle with a small amber (#F59E0B) accent. Simple, friendly, readable at small size. 1:1 square, 1080x1080, no text, no letters, no logos, no people.
  - [highlight · 직접 써 본 새 도구] Instagram story highlight cover, 9:16 vertical, 1080x1920. Centered within a circle in the middle of the frame: a friendly flat illustration of a new app window with a checkmark badge, a small wrench and a magnifying glass resting on an open documentation page, suggesting 'tested and verified tool'. Clean flat vector style, solid soft background #F8FAFC, circle filled with #1D4ED8, icon details in white and amber #F59E0B. Generous empty space around the circle, minimal, consistent icon set style. no text, no letters, no people.
  - [highlight · AI로 만든 것] Instagram story highlight cover, 9:16 vertical, 1080x1920. Centered within a circle in the middle of the frame: a flat illustration of a code editor window with abstract colored code lines turning into a small finished app card with a sparkle, representing building something with vibe coding. Clean flat vector style, solid soft background #F8FAFC, circle filled with #1D4ED8, icon details in white and amber #F59E0B. Generous empty space around the circle, minimal, consistent icon set style. no text, no letters, no people.
  - [highlight · 대외활동 기록] Instagram story highlight cover, 9:16 vertical, 1080x1920. Centered within a circle in the middle of the frame: a flat illustration of an event name badge on a lanyard next to a small calendar page with a star and a speech bubble, representing collaborations and activities. Clean flat vector style, solid soft background #F8FAFC, circle filled with #1D4ED8, icon details in white and amber #F59E0B. Generous empty space around the circle, minimal, consistent icon set style. no text, no letters, no people, no hands.

#### 2회

- 자기 평가 fact·broken:
  - [review_fact] bios.4 '소문·스펙 나열·낚시 제목 없이'는 사용자가 피할 것으로 꼽은 항목을 계정 주인의 약속으로 바꿔 쓴 것이고, 원문에는 이런 다짐이 없습니다.
- 아이디: `zun.ai.tools` · `try.ai.with.zun` · `zun_tried_ai` · `vibecoding.zun` · `zun.ai.today`
- 표시 이름: ZUN | 직접 써 본 AI 도구 · ZUN · 바로 쓰는 AI · AI 입문 가이드 ZUN · ZUN | 바이브코딩 하는 학생 · 써 보고 말하는 ZUN
- 바이오:
  - 새로 나온 AI·개발 도구, 직접 써 보고 바로 쓰게 정리해요 ⏎ ✔ 직접 써 본 새 도구 ⏎ ✔ AI로 만든 것 ⏎ ✔ 대외활동 기록 ⏎ 공식 문서로 확인한 것만 (83자)
  - AI 처음 쓰는 대학생·주니어 개발자를 위해 ⏎ 직접 써 본 도구의 좋아진 점·잘 쓰는 법·흔한 실수 ⏎ 바이브코딩으로 만든 것과 과정도 보여 줘요 (78자)
  - 소프트웨어학부 학생이 직접 써 본 AI 도구 ⏎ 소개로 끝내지 않고, 오늘 바로 해 볼 것 하나까지 ⏎ 전공 안 해도 따라 할 수 있게 써요 (74자)
  - 바이브코딩으로 만드는 학생 ⏎ 🛠 AI로 만든 것과 만드는 과정 ⏎ 🔍 써 본 새 도구, 잘 쓰는 법 ⏎ 🤝 대외활동·협업 기록 ⏎ 협업 문의는 DM (78자)
  - 네이버 AI 디깅클럽·청년 공공 AX 서포터즈 선정 ⏎ 직접 써 본 AI 도구를 입문자도 바로 쓰게 정리 ⏎ 만든 것·과정·대외활동 기록도 남겨요 (77자)
- 빠진 글 후보:
  - bios "공식 문서로 확인하고 직접 써 본 것만 말해요
소문·스펙 나열·낚시 제목 없이
AI 도구, 궁금한 것만 쉽게" — [review_fact] '소문·스펙 나열·낚시 제목 없이'는 사용자가 피할 것으로 꼽은 항목을 계정 주인의 약속으로 바꿔 쓴 것이고, 원문에는 이런 다짐이 없습니다.
- 팔레트:
  - Clean Docs Navy: primary #1E2A44, secondary #4DA3FF, accent #FFB547, background #F7F9FC, text #1A1F2B · 글자/배경 15.62 · 주색 위 13.55
  - Warm Notebook: primary #E85D3A, secondary #F4C95D, accent #2E7D6B, background #FFF8F0, text #1F1812 · 글자/배경 16.65 · 주색 위 5.06
  - Electric Lilac: primary #5B4BDB, secondary #C9C2FF, accent #FF6FA8, background #FFFFFF, text #16142B · 글자/배경 17.96 · 주색 위 6.04
- 폰트 짝: paperlogy+pretendard · ibm-plex-sans-kr+noto-sans-kr · gowun-batang+gowun-dodum
- 그림 프롬프트:
  - [profile · ZUN 프로필] Square 1:1 profile image, 1080x1080. Draw the character ZUN exactly following the user's own provided character artwork as the reference — do not invent or change its design, colors, or proportions. ZUN is centered, upper body framed, sitting slightly in front of a small laptop with a soft glowing screen. Flat, clean vector illustration style with soft shadows, plain solid background in a single calm color, generous margin so it stays readable inside a circular crop. Friendly, approachable mood. no text, no letters, no logos, no people.
  - [highlight · 직접 써 본 새 도구] Vertical 9:16 highlight cover, 1080x1920. The key subject is centered within a circle in the middle of the frame: the character ZUN, drawn exactly following the user's own provided character artwork (do not invent its design), holding a magnifying glass over a floating app window with a small checkmark, suggesting a new tool being tested and verified. Flat clean vector illustration, solid plain background, lots of empty space outside the circle. no text, no letters, no logos, no people.
  - [highlight · AI로 만든 것] Vertical 9:16 highlight cover, 1080x1920. The key subject is centered within a circle in the middle of the frame: the character ZUN, drawn exactly following the user's own provided character artwork (do not invent its design), stacking colorful building blocks shaped like small app screens and code brackets, with a tiny sparkle to suggest building something with AI. Flat clean vector illustration, solid plain background, lots of empty space outside the circle. no text, no letters, no logos, no people.
  - [highlight · 대외활동 기록] Vertical 9:16 highlight cover, 1080x1920. The key subject is centered within a circle in the middle of the frame: the character ZUN, drawn exactly following the user's own provided character artwork (do not invent its design), holding an open notebook with a lanyard badge and a small map pin beside it, suggesting recorded activities and collaborations. Flat clean vector illustration, solid plain background, lots of empty space outside the circle. no text, no letters, no logos, no people.

## 실제 · 비공개 (0명 × 2회)

(아직 자료 없음)

## AI 생성 (2명 × 2회)

| 지표 | 글 (brand_words) | 시각 (brand_visual) |
|---|---|---|
| 끝까지 완료 | 4/4 | 4/4 |
| 1회 통과 (재작성 0) | 4/4 | 4/4 |
| 평균 호출 · 재작성 | 2.0 · 0.0 | 1.0 · 0.0 |
| 평균 시간 | 62.7초 | 39.6초 |
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
| 자기 평가가 잡은 「하지 않은 약속」 fact | 3 | — |
| 자기 평가 fact·broken 전체 | 4 | — |
| 잠자기가 낀 회차 | 0/4 | |

### doyun

프로필 — 돈 관리가 귀찮은 직장인을 위한 가계부 앱 제작 일지 · 축: 기능 제작기 / 지운 기능 노트 / 혼자 만드는 근황 · 말투: 개발 용어 대신 앱을 쓰는 사람이 바로 알아듣는 말로 씁니다 / 앱 자랑보다 만들고 지우며 겪은 일을 솔직하게 털어놓습니다 / 친구에게 먼저 써 보라고 권하듯 가볍고 편하게 말합니다 · 보여 주는 방식: 안 한다

#### 1회

- 아이디: `gagyebu.diary` · `afterwork.gagyebu` · `solo.gagyebu.log` · `lazy.money.diary` · `deleted.more.than.built`
- 표시 이름: 혼자 만드는 가계부 앱 일지 · 퇴근 후 가계부 앱 만드는 중 · 지운 기능이 더 많은 가계부 앱 · 돈 관리 귀찮은 직장인 가계부 · 덜 귀찮은 가계부 만들기
- 바이오:
  - 돈 관리 귀찮은 직장인을 위한 가계부 앱 제작 일지 ⏎ · 새 기능은 어떤 귀찮음을 덜어 주나 ⏎ · 친구들이 안 써서 지운 기능 노트 ⏎ · 퇴근 후 혼자 키우는 근황 (88자)
  - 영수증 찍으면 항목이 알아서 나뉘는 기능, 주말 세 번 걸려 만든 이야기부터. ⏎ 만든 기능·지운 기능·혼자 만드는 근황을 남기는 가계부 앱 일지 (79자)
  - 지운 기능 목록이 만든 기능보다 긴 가계부 앱 ⏎ 친구들이 먼저 써 보고, 안 쓰면 지움 ⏎ 만든 이유·지운 이유·퇴근 후 혼자 키우는 근황 기록 (77자)
  - 광고비 없이, 퇴근 후 혼자 만드는 가계부 앱 ⏎ 귀찮은 돈 관리를 덜어 줄 기능 제작기와 지운 기능 노트, 솔직한 근황을 나눔 (69자)
  - 백엔드 개발 4년 차가 퇴근 후 만드는 가계부 앱 이야기 ⏎ 어려운 말 없이, 돈 관리 귀찮은 직장인 눈높이로 만든 기능·지운 기능·근황을 씀 (77자)
- 팔레트:
  - 퇴근 후 남색: primary #1F2A44, secondary #F2B84B, accent #E86A4F, background #FAF7F0, text #1F2433 · 글자/배경 14.45 · 주색 위 13.33
  - 영수증 초록: primary #276B4E, secondary #CDE8D6, accent #F25C3B, background #FFFFFF, text #1C1C1C · 글자/배경 17.04 · 주색 위 6.36
  - 새벽 형광펜: primary #C6F062, secondary #3A3F4B, accent #FF7A59, background #16181D, text #F1F1EC · 글자/배경 15.67 · 주색 위 13.57
- 폰트 짝: paperlogy+pretendard · gowun-batang+gowun-dodum · suit+pretendard
- 그림 프롬프트:
  - [profile · 프로필] Flat minimal illustration for an Instagram profile picture, 1:1, 1080x1080. A small open pocket notebook used as a household budget ledger, a few coins and a crumpled receipt beside it, a warm desk lamp glow on a navy background, cozy after-work night mood, simple shapes, soft warm yellow and coral accents, centered composition that reads well as a small circle. No people, no hands, no text, no letters, no numbers, no logos.
  - [highlight · 기능 제작기] Flat minimal illustration for an Instagram highlight cover, 9:16, 1080x1920. Centered within a circle in the middle of the frame: a single puzzle piece clicking into a small coin wallet, suggesting one new feature that removes a money hassle, tiny sparkle marks around it. Plain soft cream background with generous empty space above and below, navy and warm yellow palette, same simple style as the profile. No people, no hands, no text, no letters, no numbers.
  - [highlight · 지운 기능 노트] Flat minimal illustration for an Instagram highlight cover, 9:16, 1080x1920. Centered within a circle in the middle of the frame: a pink eraser wiping away a blank sticky note, small eraser crumbs scattered, a light honest and slightly humorous mood about removing an unused feature. Plain soft cream background with generous empty space above and below, navy and coral palette, same simple style as the profile. No people, no hands, no text, no letters, no numbers.
  - [highlight · 혼자 만드는 근황] Flat minimal illustration for an Instagram highlight cover, 9:16, 1080x1920. Centered within a circle in the middle of the frame: a closed laptop beside a steaming mug under a desk lamp, a window with a crescent moon and quiet city lights behind, conveying building something alone after work at night. Plain navy background with generous empty space above and below, warm yellow lamp glow, same simple style as the profile. No people, no hands, no text, no letters, no numbers, no screens showing content.

#### 2회

- 자기 평가 fact·broken:
  - [review_fact] bios.6 '만드는 사람도 돈 관리가 귀찮아서 시작한 가계부 앱'이라는 앱을 만든 동기는 프로필에 없으므로 지어낸 사실입니다. 프로필에는 귀찮아하는 사람이 보는 사람으로만 나옵니다.
- 아이디: `gagyebu.diary` · `gwichanha.gagyebu` · `afterwork.gagyebu` · `solo.gagyebu.maker` · `make.and.delete.gagyebu`
- 표시 이름: 혼자 만드는 가계부 앱 일지 · 퇴근 후 가계부 만드는 중 · 돈 관리 귀찮은 직장인 가계부 · 지운 기능이 더 많은 가계부 · 가계부 앱 만들고 지우는 사람
- 바이오:
  - 돈 관리 귀찮은 직장인을 위한 가계부 앱 제작 일지 ⏎ 📝 새로 만든 기능 제작기 ⏎ 🧹 친구들이 안 써서 지운 기능 노트 ⏎ 🌙 퇴근 후 혼자 키우는 근황 (84자)
  - 6개월째 퇴근 후 혼자 가계부 앱 만드는 직장인 개발자 ⏎ 만든 기능 · 지운 기능 · 혼자 만드는 근황 ⏎ 자랑 말고 솔직하게 기록 중 (72자)
  - 지운 기능이 만든 기능보다 많은 가계부 앱 제작 일지 ⏎ 친구들이 먼저 써 보고 안 쓰면 과감히 삭제 ⏎ 새 기능 제작기 · 지운 기능 노트 · 혼자 만드는 근황 (86자)
  - 영수증 찍으면 항목이 알아서 나뉘게, 주말 세 번을 통째로 쓴 사람 ⏎ 귀찮은 돈 관리를 덜어 주는 가계부 앱 제작 일지 ⏎ 만든 기능 · 지운 기능 · 혼자 만드는 근황 (91자)
  - 광고비 없이 퇴근 후 혼자 키우는 가계부 앱 ⏎ 앱 자랑 말고 만들고 지우며 겪은 일 솔직하게 ⏎ 📝 기능 제작기 🧹 지운 기능 노트 🌙 혼자 만드는 근황 (85자)
- 빠진 글 후보:
  - bios "만드는 사람도 돈 관리가 귀찮아서 시작한 가계부 앱
귀찮음 덜어 주는 기능 제작기 / 안 써서 지운 기능 노트 / 퇴근 후 근황" — [review_fact] '만드는 사람도 돈 관리가 귀찮아서 시작한 가계부 앱'이라는 앱을 만든 동기는 프로필에 없으므로 지어낸 사실입니다. 프로필에는 귀찮아하는 사람이 보는 사람으로만 나옵니다.
- 팔레트:
  - 퇴근길 네이비: primary #1F3A5F, secondary #8FB3D9, accent #F2A541, background #F7F4EE, text #1C1C1E · 글자/배경 15.50 · 주색 위 10.46
  - 영수증 민트: primary #256B5C, secondary #A8DCC9, accent #FF7A59, background #F3FAF7, text #13302A · 글자/배경 13.36 · 주색 위 5.94
  - 새벽 작업실: primary #FFD166, secondary #3A3F4B, accent #6EC1E4, background #16181D, text #EDEDED · 글자/배경 15.17 · 주색 위 12.32
- 폰트 짝: paperlogy+pretendard · gowun-batang+gowun-dodum · suit+gowun-dodum
- 그림 프롬프트:
  - [profile · 프로필] Square profile image, 1:1, 1080x1080. Flat minimal illustration of a small open pocket notebook lying beside a smartphone with a blank glowing screen, a few coins stacked neatly next to them, and a warm desk lamp casting a soft circle of light, evoking an after-work side project about managing money without hassle. Simple rounded shapes, soft shadows, calm navy #1F3A5F and warm cream #F7F4EE with a single mustard yellow #F2A541 accent. Subject centered with generous margin so it reads clearly in a small circular crop. No people, no hands, no text, no letters, no numbers, no logos.
  - [highlight · 기능 제작기] Instagram highlight cover, vertical 9:16, 1080x1920. Flat minimal illustration centered within a circle in the middle of the frame: a small wrench and a coin fitting together like puzzle pieces, with tiny sparkle marks suggesting a chore made easier. Solid warm cream #F7F4EE background, circle filled with calm navy #1F3A5F, icon in cream and mustard yellow #F2A541. Simple rounded shapes, consistent line weight, plenty of empty space around the circle. No people, no text, no letters, no numbers, no logos.
  - [highlight · 지운 기능 노트] Instagram highlight cover, vertical 9:16, 1080x1920. Flat minimal illustration centered within a circle in the middle of the frame: a pink eraser gently rubbing out one small rounded puzzle block, leaving soft eraser crumbs, conveying an honest note about removing an unused feature. Solid warm cream #F7F4EE background, circle filled with calm navy #1F3A5F, icon in cream and mustard yellow #F2A541. Simple rounded shapes, consistent line weight, plenty of empty space around the circle. No people, no text, no letters, no numbers, no logos.
  - [highlight · 혼자 만드는 근황] Instagram highlight cover, vertical 9:16, 1080x1920. Flat minimal illustration centered within a circle in the middle of the frame: a small sprout growing out of a single coin under a glowing desk lamp, with a crescent moon nearby to suggest working alone after office hours. Solid warm cream #F7F4EE background, circle filled with calm navy #1F3A5F, icon in cream and mustard yellow #F2A541. Simple rounded shapes, consistent line weight, plenty of empty space around the circle. No people, no text, no letters, no numbers, no logos.

### seoyeon

프로필 — 줄 서도 아깝지 않은 디저트만 솔직하게 골라요 · 축: 두 번 가 본 판정 리뷰 / 동네 디저트 지도 / 디저트 일상 기록 · 말투: 맛없으면 맛없다고, 실망했으면 실망했다고 솔직하게 써요 / 가도 될지 말지 결론부터 말해서 30초 안에 판단할 수 있게 해요 / 친구가 물어볼 때 알려 주듯 편하게, 웨이팅·자리 팁까지 구체적으로 써요 · 보여 주는 방식: 괜찮다

#### 1회

- 자기 평가 fact·broken:
  - [review_fact] bios.3 원문은 '협찬인데 협찬 아닌 척하는 게 싫다'는 피할 것뿐인데, 바이오에서 '협찬은 꼭 밝혀요'라는 약속으로 바꿔 계정 주인의 말처럼 썼습니다.
- 아이디: `julseodo.dessert` · `dessert.panjeong` · `dubeon.gabon.dessert` · `galmal.dessert` · `dessert.honest.pick`
- 표시 이름: 줄 서도 아깝지 않은 디저트 · 갈까 말까 디저트 판정 · 두 번 가 보는 디저트 리뷰 · 솔직 디저트 | 웨이팅 팁 · 30초 디저트 판정
- 바이오:
  - 줄 서도 아깝지 않은 디저트만 솔직하게 골라요 ⏎ 평일·주말 두 번 가 보고 갈지 말지 판정 ⏎ 웨이팅·자리 팁 | 동네 디저트 지도 | 디저트 일상 (79자)
  - 맛없으면 맛없다고 말하는 디저트 리뷰 ⏎ 결론부터: 갈까, 말까 ⏎ 평일·주말 두 번 가 본 웨이팅·자리 팁 ⏎ 직접 그린 동네 디저트 지도도 있어요 (77자)
  - 주말에 갈 카페 고민될 때 저장해 두세요 ⏎ ✔ 두 번 가 본 판정 리뷰 ⏎ ✔ 직접 그린 동네 디저트 지도 ⏎ ✔ 카페 다니는 날의 디저트 기록 (75자)
  - 성수동 디저트 지도 그린 사람 ⏎ 가게마다 평일·주말 두 번 가 보고 판정해요 ⏎ 웨이팅·자리 팁 + 오늘 먹은 디저트 기록 (65자)
  - 친구가 물어보면 알려 주듯 쓰는 디저트 판정 ⏎ 결론부터: 가도 됨 / 안 가도 됨 ⏎ 웨이팅 시간·자리 잡기 팁 | 동네 디저트 지도 | 디저트 일상 (80자)
- 빠진 글 후보:
  - bios "줄 서서 먹고 실망한 적이 많아서 솔직하게 써요
가도 될지 30초 안에 판단하게
웨이팅·자리 잡기 팁까지
협찬은 꼭 밝혀요" — [review_fact] 원문은 '협찬인데 협찬 아닌 척하는 게 싫다'는 피할 것뿐인데, 바이오에서 '협찬은 꼭 밝혀요'라는 약속으로 바꿔 계정 주인의 말처럼 썼습니다.
- 팔레트:
  - 딸기 크림: primary #B0304A, secondary #F2B8C0, accent #6B8E4E, background #FFF8F0, text #2B1B17 · 글자/배경 15.68 · 주색 위 5.92
  - 말차 라떼: primary #3F5A3A, secondary #A9B98A, accent #E0A43A, background #F3F1E6, text #1F2A1C · 글자/배경 13.18 · 주색 위 6.78
  - 에스프레소 나이트: primary #D9A066, secondary #7A4E35, accent #E86F5A, background #2A1F1A, text #F5EBDD · 글자/배경 13.60 · 주색 위 7.00
- 폰트 짝: paperlogy+pretendard · gowun-batang+gowun-dodum · suit+noto-sans-kr
- 그림 프롬프트:
  - [profile · 프로필] Square 1:1 profile image, 1080x1080. A single glossy strawberry cream tart on a small round ceramic plate, viewed from slightly above, placed on a warm cream-colored cafe table, soft natural window light, gentle shadows, a tiny silver dessert fork resting beside it. Warm raspberry and cream tones, clean minimal composition with the tart centered so it reads clearly in a small circular crop. Appetizing, honest, cozy cafe mood. No people, no hands, no text, no letters, no logos.
  - [highlight · 두 번 가 본 판정 리뷰] Vertical 9:16 story highlight cover, 1080x1920. Flat illustration of two identical slices of cake side by side on small plates, one in bright daytime light and one in warm evening light, suggesting a weekday visit and a weekend visit, with a small hourglass between them hinting at waiting time. All key elements centered within a circle in the middle of the frame, plain solid background around it. Simple bold shapes, mustard yellow, deep blue and warm cream palette. No people, no text, no letters, no numbers.
  - [highlight · 동네 디저트 지도] Vertical 9:16 story highlight cover, 1080x1920. Hand-drawn style illustrated neighborhood map with winding streets, small rooftops, a few trees, and tiny dessert icons such as a croissant, a cupcake, and a coffee cup marked with map pins. The map is centered within a circle in the middle of the frame, plain soft matcha-green background around it. Warm pencil-and-watercolor texture, friendly and practical feel. No people, no text, no labels, no letters, no street names.
  - [highlight · 디저트 일상 기록] Vertical 9:16 story highlight cover, 1080x1920. Cozy top-down view of a cafe table with a latte in a ceramic cup, a small plate with a half-eaten slice of cake, an open blank notebook, and soft afternoon sunlight falling across the table. The scene is centered within a circle in the middle of the frame, plain warm coffee-brown background around it. Soft illustration style, warm caramel and cream tones, calm everyday diary mood. No people, no hands, no text, no letters, no writing in the notebook.

#### 2회

- 자기 평가 fact·broken:
  - [review_fact] bios.0 사용자는 '협찬인데 협찬 아닌 척하는 게 싫다'고만 했는데, '협찬은 꼭 밝혀요'라는 다짐을 계정 주인의 말로 바꿔 썼습니다.
  - [review_fact] bios.3 사용자가 싫다고만 한 것(협찬 숨기기)을 '협찬은 꼭 밝혀요'라는 약속으로 바꿔 계정 주인의 말처럼 썼습니다.
- 아이디: `dessert.verdict` · `twice.dessert` · `honest.dessert.log` · `julseodo.dessert` · `go.or.no.dessert`
- 표시 이름: 줄 서도 되는 디저트 · 디저트 판정러 · 두 번 가 본 디저트 · 갈까 말까 디저트 · 솔직한 디저트 리뷰
- 바이오:
  - 갈까 말까, 30초면 판단 끝 ⏎ ✔ 두 번 가 본 판정 리뷰 ⏎ ✔ 직접 그린 동네 디저트 지도 ⏎ ✔ 카페 가는 날 기록 ⏎ 맛없으면 맛없다고 써요 (76자)
  - 줄 서서 먹고 실망한 적이 너무 많아서 시작했어요 ⏎ 평일·주말 두 번 가 보고 갈지 말지 알려 줄게요 ⏎ 웨이팅·자리 잡기 팁은 덤 (70자)
  - 친구가 물어보면 알려 주듯 솔직하게 ⏎ 맛있으면 가라고, 실망이면 실망이라고 ⏎ 웨이팅·자리 잡기 팁까지 다 적어요 (60자)
  - 주말에 갈 카페 찾는 중이라면 ⏎ 줄 설 가치가 있는지 먼저 판정해 드려요 ⏎ 평일·주말 두 번 방문 | 동네 디저트 지도 | 디저트 일상 (73자)
  - 오늘 먹은 디저트, 솔직하게 남겨요 ⏎ 가도 되는 곳 / 안 가도 되는 곳 결론부터 ⏎ 두 번 가 본 리뷰 · 동네 디저트 지도 (67자)
- 빠진 글 후보:
  - bios "줄 서도 아깝지 않은 디저트만 솔직하게 골라요
평일·주말 두 번 가 보고 판정
웨이팅·자리 팁 | 동네 디저트 지도
협찬은 꼭 밝혀요" — [review_fact] 사용자는 '협찬인데 협찬 아닌 척하는 게 싫다'고만 했는데, '협찬은 꼭 밝혀요'라는 다짐을 계정 주인의 말로 바꿔 썼습니다.
  - bios "📍 직접 그린 동네 디저트 지도
🍰 두 번 가 본 판정 리뷰 + 웨이팅 팁
☕ 카페 다니는 날의 기록
협찬은 꼭 밝혀요" — [review_fact] 사용자가 싫다고만 한 것(협찬 숨기기)을 '협찬은 꼭 밝혀요'라는 약속으로 바꿔 계정 주인의 말처럼 썼습니다.
- 팔레트:
  - 베리 타르트: primary #B3264A, secondary #F4C7C3, accent #8DB255, background #FFF8F0, text #2B1B17 · 글자/배경 15.68 · 주색 위 6.05
  - 말차 호지차: primary #4F6B3A, secondary #C9B79C, accent #D97B3A, background #F3F1E7, text #1F2A1C · 글자/배경 13.19 · 주색 위 5.30
  - 커스터드 판정: primary #FFC93C, secondary #3A3A3A, accent #FF5A36, background #111111, text #FFF4E0 · 글자/배경 17.33 · 주색 위 12.29
- 폰트 짝: paperlogy+pretendard · gowun-batang+gowun-dodum · suit+pretendard
- 그림 프롬프트:
  - [profile · 프로필] 1:1 square, 1080x1080, no text, no people. A single glossy strawberry tart on a small cream ceramic plate, seen from a slightly high angle, with a tiny round red stamp-shaped sugar decoration beside it like a seal of approval. Soft natural window light, warm cream background, berry red and cream color palette, clean minimal composition with the tart centered, cozy Seoul cafe mood, crisp and appetizing, simple enough to read at small icon size.
  - [highlight · 두 번 가 본 판정 리뷰] 9:16 vertical, 1080x1920, no text, no people. Flat illustration: two identical dessert plates side by side, one under bright weekday daylight and one under busy weekend golden light, with a small hourglass between them for waiting time. The key subject is centered within a circle in the middle of the frame, plain soft cream background around the circle, berry red and cream palette, simple bold shapes that read clearly at small size.
  - [highlight · 동네 디저트 지도] 9:16 vertical, 1080x1920, no text, no letters, no people. Hand-drawn neighborhood map illustration on kraft paper with navy ink streets and small red pins, each pin topped by a tiny dessert icon such as a croissant, a cake slice and a cookie. The map is centered within a circle in the middle of the frame, plain kraft-paper background around the circle, warm and playful sketch style, simple shapes readable at small size.
  - [highlight · 디저트 일상 기록] 9:16 vertical, 1080x1920, no text, no people. Cozy flat-lay of an open blank notebook, a latte in a cream cup and a half-eaten pastry on a wooden cafe table, soft morning sunlight from a window. The scene is centered within a circle in the middle of the frame, plain warm cream background around the circle, calm diary mood, matcha green and latte beige accents, simple composition readable at small size.
