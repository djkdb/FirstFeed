-- 티스토리 발행 기록 (사용자 결정 2026-11-20). 같은 세트를 두 번 올리지 않게(다시 올리려면 화면에서 한 번 더 확인) · 리틀리 링크에 최근 글을 넣으려고.
-- url 은 발행 뒤 블로그 RSS 에서 같은 제목 글을 찾아 채운다 — 못 찾으면 NULL(모름)
CREATE TABLE blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL,
  site TEXT NOT NULL,
  set_id INTEGER,
  title TEXT NOT NULL,
  url TEXT,
  visibility TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX blog_posts_set ON blog_posts(site, set_id);
