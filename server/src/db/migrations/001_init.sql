-- 첫 스키마: 지금 필요한 테이블만 만든다. 나머지(프로필·템플릿·콘텐츠 등)는 기능을 만들 때 추가한다.
-- user_id·brand_id 는 처음부터 둔다 — 나중에 로그인·브랜드 여러 개(F)를 붙일 때 데이터를 옮기지 않으려고.

CREATE TABLE users (
  id          INTEGER PRIMARY KEY,
  email       TEXT,                         -- 로그인 전 로컬 사용자는 NULL
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE brands (
  id                 INTEGER PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id),
  name               TEXT NOT NULL,
  handle             TEXT,
  active_profile_id  INTEGER,
  active_template_id INTEGER,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 사용자가 바꾼 설정만 저장한다. 기본값은 server/src/config.ts 한 곳에 있다.
CREATE TABLE settings (
  user_id     INTEGER NOT NULL REFERENCES users(id),
  key         TEXT NOT NULL,
  value_json  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);

-- AI 호출 한 번 = 한 줄. 재요청·재작성도 각각 한 줄로 남겨 이력(FR-AI-4)과 사용량(FR-AI-5)을 본다.
CREATE TABLE ai_runs (
  id           INTEGER PRIMARY KEY,
  job_id       TEXT NOT NULL,               -- 같은 생성 작업에 속한 호출을 묶는다
  task         TEXT NOT NULL,
  provider     TEXT NOT NULL,
  model        TEXT,
  prompt_name  TEXT,
  prompt_ver   TEXT,
  attempt      INTEGER NOT NULL,            -- 작업 안에서 몇 번째 호출인지 (1부터)
  kind         TEXT NOT NULL,               -- generate | json_retry | rewrite | review
  status       TEXT NOT NULL,               -- ok | invalid_json | schema_error | rule_error | failed | timeout | cancelled
  error        TEXT,
  issues_json  TEXT,                        -- 규칙·자기 평가가 찾은 문제 목록
  duration_ms  INTEGER,
  started_at   TEXT NOT NULL,
  finished_at  TEXT
);
CREATE INDEX ai_runs_job ON ai_runs(job_id);

-- 로그인 없이 바로 쓰도록 로컬 사용자 1명 + 브랜드 1개로 시작한다
INSERT INTO users (id, email) VALUES (1, NULL);
INSERT INTO brands (id, user_id, name) VALUES (1, 1, '내 브랜드');
