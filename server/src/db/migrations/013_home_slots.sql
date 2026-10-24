-- 「오늘 올릴 것」 홈 (FR-HM-1~3 · 결정 2026-10-24). 계획 칸(번호)마다 이은 세트 · 올린 날(사용자 표시) · 미룬 날 수.
-- 칸 번호로 잇는다 — 세트를 잇거나 올린 칸은 계획에서 고정해(locked) 다시 만들어도 같은 자리에 남게 한다(plan.ts 의 고정 규칙)
-- posted_at: 사용자가 「올렸어요」를 누른 날(YYYY-MM-DD, 그 컴퓨터의 날짜). 인스타에 실제로 올라갔는지는 확인하지 않는다
CREATE TABLE home_slots (
  brand_id    INTEGER NOT NULL REFERENCES brands(id),
  slot_idx    INTEGER NOT NULL,
  set_id      INTEGER REFERENCES card_sets(id),
  posted_at   TEXT,
  delay_days  INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (brand_id, slot_idx)
);
