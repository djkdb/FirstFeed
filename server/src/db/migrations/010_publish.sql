-- 업로드 준비 (FR-PB-1 · 결정 2026-10-18).
-- 최소 캡션: 세트마다 최신 하나(다시 만들면 바꾼다). 풀이 표시는 카드와 같이 [{ sentence, term, checkedAt }] — 모두 확인해야 폴더를 만든다
CREATE TABLE captions (
  set_id         INTEGER PRIMARY KEY REFERENCES card_sets(id),
  hook           TEXT NOT NULL,
  lines_json     TEXT NOT NULL,
  hashtags_json  TEXT NOT NULL,
  glosses_json   TEXT NOT NULL,
  edited         INTEGER NOT NULL DEFAULT 0,  -- 사용자가 직접 고쳤는가(그러면 사용자 글 — 허용 출처 4번)
  job_id         TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 만든 업로드 폴더. 「폴더 열기」는 여기 적힌 경로만 연다(이 앱이 만든 폴더만)
CREATE TABLE exports (
  id          INTEGER PRIMARY KEY,
  set_id      INTEGER NOT NULL REFERENCES card_sets(id),
  path        TEXT NOT NULL,
  files       INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
