-- 프로필 단계에서 인터뷰로 돌아왔거나 실패했을 때 화면에 다시 보여 줄 안내 { kind, message, missing[] }.
-- 처음엔 002 에 넣었다가, 002 가 이미 적용된 개발 DB 와 어긋나서 따로 뺐다 (devlog 2026-10-13-04: 적용된 마이그레이션은 고치지 않는다)
ALTER TABLE identity_sessions ADD COLUMN note_json TEXT;
