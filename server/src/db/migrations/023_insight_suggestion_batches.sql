-- 제안 받기 한 번 = 묶음 하나 (2026-11-24 코드 리뷰). 제안이 0개로 끝난 받기도 줄을 남겨,
-- 화면 · 수락 · 넘기기가 「가장 최근 받기」의 제안만 쓰게 한다 — 0개로 끝났는데 그 전 묶음이 아직 고를 수 있게 남는 일을 막으려고.
-- job_id 는 AI 작업 ID. AI 를 부르지 않은 받기(결론 낼 묶음 없음)는 NULL
CREATE TABLE insight_suggestion_batches (
  id          INTEGER PRIMARY KEY,
  brand_id    INTEGER NOT NULL REFERENCES brands(id),
  job_id      TEXT,
  count       INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX insight_suggestion_batches_brand ON insight_suggestion_batches(brand_id, id);

-- 이미 받은 제안은 받은 순서대로 묶음 줄을 채워 둔다(지금처럼 가장 최근 묶음이 그대로 보이게)
INSERT INTO insight_suggestion_batches (brand_id, job_id, count, created_at)
SELECT brand_id, job_id, COUNT(*), MIN(created_at) FROM insight_suggestions GROUP BY brand_id, job_id ORDER BY MIN(id);
