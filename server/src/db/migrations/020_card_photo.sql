-- 본문 카드 사진 칸 (2026-11-19, 사진 칸이 있는 시안 G · I · J): 카드마다 사용자가 올린 그림의 이름(data/brand-assets 안).
-- 없으면 NULL — 사진 칸 시안도 글만 있는 모양으로 그린다
ALTER TABLE cards ADD COLUMN photo TEXT;
