-- 인터뷰 다양화(2026-11-08): 질문 각도(lens) · 답하는 방식(format) · 방식별 재료.
-- 예전 질문(v2 이하 · 고정 질문)은 lens NULL · format 'open' — 모르는 값은 NULL 로 둔다
ALTER TABLE interview_turns ADD COLUMN lens TEXT;
ALTER TABLE interview_turns ADD COLUMN format TEXT NOT NULL DEFAULT 'open';
-- 고쳐 쓰기: 다시 써 달라고 보인 예시 문장
ALTER TABLE interview_turns ADD COLUMN sample TEXT;
-- 말투 척도: {"left":"…","right":"…"}
ALTER TABLE interview_turns ADD COLUMN scale_json TEXT;
-- 둘 중 고르기에서 고른 쪽 · 척도에서 고른 칸(1~5) — 답 글과 따로 남긴다(답 글은 사용자가 직접 쓴 이유만)
ALTER TABLE interview_turns ADD COLUMN pick TEXT;
