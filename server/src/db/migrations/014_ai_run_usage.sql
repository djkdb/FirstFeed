-- AI 호출마다 토큰 사용량을 남긴다 (토큰 줄이기 작업 2026-11-04 — 과제별 전/후를 같은 기록으로 재려고).
-- 공급자가 알려 주지 않으면 NULL (모르는 값은 0 으로 채우지 않는다)
ALTER TABLE ai_runs ADD COLUMN input_tokens INTEGER;
ALTER TABLE ai_runs ADD COLUMN cache_creation_tokens INTEGER;
ALTER TABLE ai_runs ADD COLUMN cache_read_tokens INTEGER;
ALTER TABLE ai_runs ADD COLUMN output_tokens INTEGER;
-- 출력 중 생각(thinking) 토큰 — 출력이 큰 과제에서 생각이 얼마나 차지하는지 보려고
ALTER TABLE ai_runs ADD COLUMN thinking_tokens INTEGER;
ALTER TABLE ai_runs ADD COLUMN cost_usd REAL;
