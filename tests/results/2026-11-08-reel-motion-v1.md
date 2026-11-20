# 릴스 모션 제안 측정 — v1 (2026-11-08)

- 프롬프트: reel_motion v1 · 모델 설정 opus · 실제 모델 claude-opus-5-5
- 입력: 고정 릴스 3개(tests/fixtures/generated/reels — **AI 생성 예시 문장**) × 브랜드 팔레트(me 실제·공개 · doyun · seoyeon AI 생성), 1회
- 규칙 기준: reels.motion {"minHoldFrames":12,"subtitleMaxEnter":8,"subtitleMaxExit":6,"maxEnterFrames":30,"maxExitFrames":20,"maxTransitionFrames":20,"maxEmphasis":2}
- 실제·비공개 자료: 없음(이 측정은 비공개 자료를 쓰지 않는다)

| 회 | 릴스 | 팔레트(출처) | 결과 | 재작성 | 걸린 규칙 | 시간 | 입력 · 캐시 쓰기 · 캐시 읽기 · 출력 토큰 | 등장 분포 |
|---|---|---|---|---|---|---|---|---|
| 1 | info | me(실제·공개) | 통과 | 0 | 없음 | 15초 | 2 · 5,484 · 0 · 1,391 | typewriter 1 · rise 5 |
| 1 | hook | doyun(AI 생성) | 통과 | 0 | 없음 | 11초 | 2 · 3,679 · 1,533 · 1,011 | typewriter 1 · rise 3 |
| 1 | photo | seoyeon(AI 생성) | 통과 | 0 | 없음 | 13초 | 2 · 3,711 · 1,533 · 1,200 | typewriter 1 · fade 3 |

통과 3/3 · 첫 시도 통과 3/3

## 제안 한 줄(note)
- 1회 info-me: 제목은 타자기로 한 글자씩 강하게 열고, 자막은 짧은 rise로 통일했으며, 강조는 '세 줄·세 가지·저장해'에만 두었습니다.
- 1회 hook-doyun: 훅 제목은 아래 여유가 좁아 타자기로 힘 있게 열고, 자막은 짧은 rise로 통일해 '먼저'와 '5분'만 강조했다.
- 1회 photo-seoyeon: 첫 제목은 typewriter와 bar로 강하게 열고, 자막은 짧은 fade로 통일해 말에 맞췄으며, 강조는 '하나만', '케이블 정리함', '서랍' 세 곳에만 두었습니다.

## 경고(재작성 사유 아님)
- 없음

## 프레임 판
- info-me: [_sheet.png](2026-11-08-reel-motion-v1/info-me/_sheet.png) (0.2초마다 한 장, 720 으로 뽑은 mp4 에서)
- hook-doyun: [_sheet.png](2026-11-08-reel-motion-v1/hook-doyun/_sheet.png) (0.2초마다 한 장, 720 으로 뽑은 mp4 에서)
- photo-seoyeon: [_sheet.png](2026-11-08-reel-motion-v1/photo-seoyeon/_sheet.png) (0.2초마다 한 장, 720 으로 뽑은 mp4 에서)

사람이 열어 본 결과는 devlog 에 적는다.
