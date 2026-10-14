-- 카드뉴스 (FR-MK-1·2·8). 결정: CLAUDE.md 2026-10-15 · FR-MK-1 카드뉴스
-- 소재는 사용자가 넣은 글이라 넣을 때 저장한다. 카드 세트는 모든 카드가 규칙·렌더링을 통과했을 때만(또는 사용자가
-- 넘친 칸을 직접 줄인 뒤) 저장한다 — 반쯤 만든 결과는 저장하지 않는다
CREATE TABLE sources (
  id               INTEGER PRIMARY KEY,
  brand_id         INTEGER NOT NULL REFERENCES brands(id),
  title            TEXT,
  body             TEXT NOT NULL,           -- 소재 원문 (허용 출처 1)
  memo             TEXT,                    -- 만들 때 사용자가 적은 메모 (허용 출처 4)
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE card_sets (
  id                   INTEGER PRIMARY KEY,
  brand_id             INTEGER NOT NULL REFERENCES brands(id),
  source_id            INTEGER NOT NULL REFERENCES sources(id),
  profile_id           INTEGER NOT NULL REFERENCES brand_profiles(id),   -- 어느 프로필 판으로 만들었나 (FR-ID-6)
  template_version_id  INTEGER NOT NULL REFERENCES template_versions(id),-- 어느 고정 틀로 그렸나 (FR-TP-3) — 다시 그릴 때도 이 판
  pillar_id            TEXT,                -- 어느 콘텐츠 축인가 (성과 단계의 축별 통계)
  body_count           INTEGER NOT NULL,
  edited               INTEGER NOT NULL DEFAULT 0,  -- 넘친 칸을 사용자가 직접 줄였는가
  cover_job_id         TEXT,
  body_job_id          TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE cards (
  id               INTEGER PRIMARY KEY,
  set_id           INTEGER NOT NULL REFERENCES card_sets(id),
  idx              INTEGER NOT NULL,        -- 0 = 표지, 1..N = 본문, N+1 = 마무리
  kind             TEXT NOT NULL,           -- cover | body | closing
  content_json     TEXT NOT NULL,           -- 그린 원고 (템플릿 FrameContent) — 렌더링 직전 다듬기 전의 글
  evidence         TEXT,                    -- 본문: 소재 원문 근거 인용
  image_json       TEXT,                    -- 그림 프롬프트 { prompt, filename } (FR-MK-8) 또는 null
  edited           INTEGER NOT NULL DEFAULT 0,
  png_file         TEXT NOT NULL,           -- data/renders/set-<id>/ 안 파일 이름
  render_json      TEXT NOT NULL,           -- { browser, reference, scale }
  UNIQUE (set_id, idx)
);
