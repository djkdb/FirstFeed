-- 성과 분석 (FR-IN-2~6 · 사용자 결정 2026-11-22). 숫자는 Metricool 에서 앱이 직접 받아(AI 를 거치지 않음) 여기에 넣고,
-- Metricool 에 없는 게시물만 사용자가 직접 입력한다(source = manual). 모르는 수치는 NULL — 0 으로 채우지 않는다(PRD 5장).
-- set_id 는 사용자가 「맞아요」로 확인했을 때만 채운다(앱은 후보만 낸다). 한 세트는 게시물 하나에만
CREATE TABLE insight_posts (
  id            INTEGER PRIMARY KEY,
  brand_id      INTEGER NOT NULL REFERENCES brands(id),
  source        TEXT NOT NULL CHECK (source IN ('metricool', 'manual')),
  external_id   TEXT NOT NULL,           -- Metricool 게시물 ID(IGPO04 · IGRE04) 또는 manual-<무작위>
  url           TEXT,
  type          TEXT,                    -- FEED_CAROUSEL_ALBUM · FEED_IMAGE · FEED_VIDEO · REELS … (모르면 NULL)
  published_at  TEXT,                    -- ISO(UTC, Z). 모르면 NULL — 그런 게시물은 분석에 쓰지 않는다
  content       TEXT,                    -- 캡션 글(잇기 후보 고르기에만 쓴다)
  reach         INTEGER,
  saved         INTEGER,
  shares        INTEGER,
  views         INTEGER,
  likes         INTEGER,
  comments      INTEGER,
  fetched_at    TEXT,                    -- Metricool 에서 마지막으로 받은 시각(ISO). 직접 입력은 NULL
  set_id        INTEGER REFERENCES card_sets(id),
  linked_at     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (brand_id, source, external_id)
);
CREATE UNIQUE INDEX insight_posts_set ON insight_posts(set_id) WHERE set_id IS NOT NULL;

-- 잇기 후보에서 「아니에요」를 누른 짝 — 같은 후보를 다시 내지 않으려고
CREATE TABLE insight_link_rejections (
  post_id     INTEGER NOT NULL REFERENCES insight_posts(id) ON DELETE CASCADE,
  set_id      INTEGER NOT NULL REFERENCES card_sets(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, set_id)
);

-- 「다음에 더 할 것 / 줄일 것」 제안(FR-IN-5)과 수락 · 넘기기(FR-IN-6). 규칙을 통과한 제안만 저장한다.
-- status: pending → accepted(프로필 새 판 profile_id, 만료 expires_at) | rejected
CREATE TABLE insight_suggestions (
  id            INTEGER PRIMARY KEY,
  brand_id      INTEGER NOT NULL REFERENCES brands(id),
  job_id        TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('more', 'less')),
  group_key     TEXT NOT NULL,
  text          TEXT NOT NULL,
  rule          TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  table_json    TEXT NOT NULL,           -- 제안을 만들 때 보인 표(근거를 나중에도 그대로 보이려고)
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  profile_id    INTEGER REFERENCES brand_profiles(id),
  expires_at    TEXT,
  decided_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX insight_suggestions_brand ON insight_suggestions(brand_id, id);
