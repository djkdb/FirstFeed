-- 정체성 찾기 (FR-ID-1 설문 → FR-ID-2 인터뷰 → FR-ID-4 프로필 초안)

-- 정체성 찾기 한 번 = 세션 하나. 처음부터 다시 하면 새 세션을 만든다 (이전 세션은 기록으로 남긴다)
CREATE TABLE identity_sessions (
  id          INTEGER PRIMARY KEY,
  brand_id    INTEGER NOT NULL REFERENCES brands(id),
  survey_json TEXT NOT NULL,                -- { S1: {choices, other, text}, … }
  status      TEXT NOT NULL,                -- interview | ready | profiled
  -- 프로필 단계에서 인터뷰로 돌아왔거나 실패했을 때 화면에 다시 보여 줄 안내 { kind, message, missing[] }
  note_json   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 인터뷰 질문 하나 = 한 줄. 답이 오면 같은 줄을 채운다
CREATE TABLE interview_turns (
  id            INTEGER PRIMARY KEY,
  session_id    INTEGER NOT NULL REFERENCES identity_sessions(id),
  turn_no       INTEGER NOT NULL,
  question      TEXT NOT NULL,
  why           TEXT,
  examples_json TEXT NOT NULL,              -- AI 가 준 예시 답
  options_json  TEXT NOT NULL,              -- "잘 모르겠어요" 뒤에 준 선택지
  target        TEXT,                       -- 이 질문으로 채우려는 빈칸
  answer        TEXT,
  -- text: 직접 입력 / example: 예시를 그대로 보냄(AI 가 쓴 문장 — 근거로 세지 않는다) / choice: 선택지를 고름 / unknown: 잘 모르겠어요
  answer_kind   TEXT,
  job_id        TEXT,
  asked_at      TEXT NOT NULL DEFAULT (datetime('now')),
  answered_at   TEXT,
  UNIQUE (session_id, turn_no)
);

-- 브랜드 프로필의 판(version). 고칠 때마다 새 줄을 만들어 이전 판으로 되돌릴 수 있게 한다 (FR-ID-5 대비)
CREATE TABLE brand_profiles (
  id                  INTEGER PRIMARY KEY,
  brand_id            INTEGER NOT NULL REFERENCES brands(id),
  session_id          INTEGER REFERENCES identity_sessions(id),
  version             INTEGER NOT NULL,
  account_line        TEXT NOT NULL,
  audience            TEXT NOT NULL,
  pillars_json        TEXT NOT NULL,        -- 코드가 원문 대조를 마친 인용만 들어 있다
  dropped_json        TEXT NOT NULL,        -- 근거 부족으로 뺀 축 (화면에 「근거 부족」으로)
  voice_rules_json    TEXT NOT NULL,
  avoid_json          TEXT NOT NULL,
  unknown_json        TEXT NOT NULL,
  origin              TEXT NOT NULL,        -- interview | edit | insight
  job_id              TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at        TEXT,
  UNIQUE (brand_id, version)
);
