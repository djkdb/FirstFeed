-- 카드뉴스 채팅으로 고치기 (FR-MK-3 · 2026-11-04 사용자 지시). 지시 하나 = 줄 하나.
-- 제안(proposed)은 전/후만 보여 주고 세트는 그대로 — 사용자가 「적용」을 눌러야 바뀐다(사용자 결정: 전/후 보고 적용).
-- 적용할 때 바뀌기 전 카드를 before_json 에 남겨 되돌릴 수 있게 한다(PNG 는 renders/set-N/chat-<id>-NN.png 로 보관)
CREATE TABLE card_chat (
  id            INTEGER PRIMARY KEY,
  set_id        INTEGER NOT NULL REFERENCES card_sets(id),
  message       TEXT NOT NULL,              -- 사용자가 쓴 지시 그대로(허용 출처 4번 — 사용자가 직접 입력한 문장)
  targets_json  TEXT,                       -- 화면에서 고른 카드 번호(idx) 목록, 없으면 NULL
  status        TEXT NOT NULL,              -- proposed | applied | discarded | reverted | failed
  reply         TEXT,                       -- AI 가 남긴 한 줄 설명
  changes_json  TEXT,                       -- 바뀔 카드: [{ idx, content, evidence, glosses, png }]
  before_json   TEXT,                       -- 적용 때 바뀌기 전 카드: [{ idx, content, evidence, glosses, edited, png }]
  error         TEXT,
  job_id        TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX card_chat_set ON card_chat(set_id);
