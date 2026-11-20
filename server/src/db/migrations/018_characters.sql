-- 개성 캐릭터(2026-11-08): 캐릭터 프롬프트 기계에서 고른 값. 프롬프트는 저장하지 않고 고른 값에서 다시 만든다
-- (팔레트를 바꾸면 색 구절이 따라가게 — 칸 이름으로 저장)
CREATE TABLE characters (
  id         INTEGER PRIMARY KEY,
  brand_id   INTEGER NOT NULL,
  name       TEXT NOT NULL,
  spec_json  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
