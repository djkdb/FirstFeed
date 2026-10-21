-- 30일 뒤 내 계정 미리보기의 시리즈 계획 (FR-BR-6 · 결정 2026-10-21). 바뀔 때마다 새 줄(이력), 최신이 적용 중.
-- slots_json: [{ title, pillarId, locked, origin: 'ai' | 'edit' }] — 격자에서 만든 카드 다음 칸을 차례로 채운다
CREATE TABLE series_plans (
  id          INTEGER PRIMARY KEY,
  brand_id    INTEGER NOT NULL REFERENCES brands(id),
  profile_id  INTEGER NOT NULL REFERENCES brand_profiles(id),
  slots_json  TEXT NOT NULL,
  job_id      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX series_plans_brand ON series_plans(brand_id, id);
