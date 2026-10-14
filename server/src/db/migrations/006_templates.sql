-- 템플릿 고정과 판 (FR-TP-3). 결정: CLAUDE.md 2026-10-15 · FR-TP 템플릿 계획
-- 고를 때마다 새 판, 브랜드의 template_version_id 가 지금 고정한 판. 옛 판은 지우지 않는다 —
-- 콘텐츠는 만들 때의 판 id 를 기록해서(FR-MK 에서) 판을 새로 만들어도 옛 콘텐츠는 옛 틀로 다시 그려진다
CREATE TABLE template_versions (
  id               INTEGER PRIMARY KEY,
  brand_id         INTEGER NOT NULL REFERENCES brands(id),
  version          INTEGER NOT NULL,
  draft_id         TEXT NOT NULL,           -- 'A' | 'B' | 'C' (server/src/templates)
  look_json        TEXT NOT NULL,           -- 고정할 때의 브랜드 모양(팔레트·제목/본문 폰트·아이디·표시 이름·프로필 사진) — 키트를 다시 골라도 이 판은 그대로
  budget_json      TEXT NOT NULL,           -- 칸별 한 줄 글자 수·최대 줄 수 (생성 프롬프트에 넘긴다, FR-MK-1)
  browser          TEXT NOT NULL,           -- 글자 수를 잰 브라우저·버전 ("playwright-chromium 156.0.8078.4")
  selection_id     INTEGER REFERENCES brand_kit_selections(id),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (brand_id, version)
);

ALTER TABLE brands ADD COLUMN template_version_id INTEGER REFERENCES template_versions(id);
