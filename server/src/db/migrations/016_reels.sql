-- 릴스 편집(결정 2026-11-06 · 편집 화면 녹이기). 편집 내용은 doc_json 하나(장면 · 글자 · 얹기 · 소리 · 올린 파일 목록 · 메모 · 원본 문구).
-- 올린 원본은 data/reels/reel-<id>/media/ 의 복사본, 뽑은 영상은 data/reels/reel-<id>/renders/ — 원본 파일은 고치지 않는다
CREATE TABLE reels (
  id          INTEGER PRIMARY KEY,
  brand_id    INTEGER NOT NULL REFERENCES brands(id),
  name        TEXT NOT NULL,
  doc_json    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX reels_brand ON reels(brand_id);
