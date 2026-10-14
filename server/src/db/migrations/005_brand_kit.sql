-- 브랜딩 키트 (FR-BR-1~4). 결정: CLAUDE.md 2026-10-14 · 브랜딩 키트 설계

-- 생성한 후보 묶음. kind: words(아이디·이름·바이오) | visual(팔레트·폰트·그림 프롬프트)
-- profile_id: 어느 프로필 판으로 만들었는지 — 프로필이 바뀌면 "다시 만들기"를 알린다 (FR-ID-6)
CREATE TABLE brand_kits (
  id               INTEGER PRIMARY KEY,
  brand_id         INTEGER NOT NULL REFERENCES brands(id),
  profile_id       INTEGER NOT NULL REFERENCES brand_profiles(id),
  kind             TEXT NOT NULL,
  candidates_json  TEXT NOT NULL,           -- 규칙을 통과한 후보만
  dropped_json     TEXT NOT NULL,           -- 끝까지 규칙을 통과하지 못해 뺀 후보와 이유
  job_id           TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX brand_kits_brand ON brand_kits(brand_id, kind, id);

-- 사용자가 고른 것. 고를 때마다 새 줄(이력), 가장 최근 줄이 적용 중 — 프로필 판과 같은 방식
CREATE TABLE brand_kit_selections (
  id               INTEGER PRIMARY KEY,
  brand_id         INTEGER NOT NULL REFERENCES brands(id),
  profile_id       INTEGER REFERENCES brand_profiles(id),
  handle           TEXT,
  display_name     TEXT,
  bio              TEXT,
  palette_json     TEXT,                    -- { name, colors{primary,secondary,accent,background,text} }
  title_font       TEXT,                    -- fonts.ts 의 id
  body_font        TEXT,
  profile_image    TEXT,                    -- 'monogram' 또는 data/brand-assets 안 파일 이름
  changed          TEXT NOT NULL,           -- 이 줄에서 바뀐 칸 (이력 화면용)
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX brand_kit_selections_brand ON brand_kit_selections(brand_id, id);
