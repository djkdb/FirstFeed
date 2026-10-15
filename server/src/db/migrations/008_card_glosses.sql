-- 카드의 소재 밖 용어 풀이·비유 문장 표시 (결정 2026-10-15 · 카드 풀이·그림 사람 규칙).
-- 맞는지 코드로 잴 수 없어 화면에서 사람에게 보인다. [{ sentence, term }] JSON. 칸이 생기기 전 세트는 NULL(표시했는지 모름)
ALTER TABLE cards ADD COLUMN glosses_json TEXT;
