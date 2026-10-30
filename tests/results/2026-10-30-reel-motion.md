# 릴스 계획 실험 c · 2026-10-30 · 3초 모션 → mp4

- 명령: `node scripts/probe-reel-motion.ts <출력 폴더>` (브랜드 키트 기본 `tests/fixtures/generated/brands/demo.json` — 소개 페이지 데모 브랜드, AI 생성 페르소나)
- 렌더링: 카드와 같은 경로(`withCardPage` — 앱에 넣은 글꼴만, 바깥 요청 차단), 1080×1920, 제목 Paperlogy · 자막 Pretendard, 바탕 주색 #2F5D8A · 강조 #F2B33D
- 프레임: CSS 애니메이션을 멈추고 Web Animations `currentTime` 으로 시각을 정해 30fps × 3초 = 90장 캡처(실시간 녹화 아님 — 매번 같은 결과)
- 인코딩: 이 맥의 ffmpeg 8.1.2(Homebrew) `libx264 · yuv420p · +faststart`, 무음
- 배치: 제목 · 자막은 릴스 격자 가림(위아래 240px, `render.safeArea.reel` y 240 · h 1440) 안쪽에 120px 더 들여서

| 항목 | 값 |
|---|---|
| 프레임 캡처 | 90장 · 8,233 ms (영상 1초당 약 2.7초) |
| ffmpeg 인코딩 | 2,294 ms |
| 결과 (ffprobe) | h264 · 1080×1920 · 30/1 fps · 90 프레임 · 3.000000 초 · 70,854 바이트 |

- 눈 확인: mp4 에서 0.1 · 0.5 · 1.0 · 1.4 · 2.9 초 프레임을 다시 뽑아 나란히(`2026-10-30-reel-motion/frames-from-mp4.png`) — 0.1초 빈 바탕 → 0.5초 제목 올라옴 → 1.0초 강조 막대 → 1.4초 자막 나타나는 중 → 2.9초 모두. 글꼴이 대체 글꼴로 바뀐 흔적 없음(제목 Paperlogy 굵은 모양 · 자막 Pretendard). 자동 글꼴 확인은 이 실험에 없다(카드 렌더링의 대체 글꼴 검사는 renderCard 에만) — 구현 때 넣는다
- 결과 파일: `2026-10-30-reel-motion/probe.mp4`(70KB) · `frames-from-mp4.png`
