-- 재작성 기록 (중간 보고서 그림 1 · devlog 2026-10-21-04). 규칙·자기 평가에 걸린 시도와 그 바로 다음 시도의 출력만 남긴다 —
-- 재작성이 없는 작업은 비어 있다(용량). 같은 job_id 끼리 짝지어 「무엇에 걸려 무엇을 고쳤나」를 보인다
ALTER TABLE ai_runs ADD COLUMN output_json TEXT;
