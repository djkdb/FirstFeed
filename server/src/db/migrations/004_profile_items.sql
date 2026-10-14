-- FR-ID-5·6 설계 (CLAUDE.md 결정 2026-10-14 · FR-ID-5·6 설계)
-- 1) 판 단위 origin → "판이 생긴 이유"(reason: interview | edit | alternative | rollback). 출처는 이제 항목 단위다 (PRD 5장과 다른 결정)
-- 2) 축마다 고정 ID · 항목마다 출처(origin)와 만료일(expiresAt, nullable — 자동으로 빼는 로직은 F 범위)
-- 3) 「보여 주는 방식」(presence): 설문 S6 을 그대로 옮긴 것
-- 4) based_on: 이 판이 어느 판에서 나왔는지 (이력 화면용)
-- 5) 계정 소개·대상의 출처 칸

ALTER TABLE brand_profiles RENAME COLUMN origin TO reason;
ALTER TABLE brand_profiles ADD COLUMN presence_json TEXT;
ALTER TABLE brand_profiles ADD COLUMN based_on INTEGER REFERENCES brand_profiles(id);
-- 계정 소개·대상도 항목이다: 사용자가 직접 고쳤는지(edit)가 근거 판정(허용 출처 4번)에 쓰인다
ALTER TABLE brand_profiles ADD COLUMN account_line_origin TEXT NOT NULL DEFAULT 'interview';
ALTER TABLE brand_profiles ADD COLUMN audience_origin TEXT NOT NULL DEFAULT 'interview';

-- 이미 저장된 판 변환: 축에 ID·출처·만료일, 근거에 무게(weight). 예전 근거의 countsAsUserInput 은 weight 로 바꾼다
-- (선택지를 고른 답은 출처 이름에 "선택지를 고른 답"이 들어 있어 supporting, 나머지는 primary)
UPDATE brand_profiles SET pillars_json = (
  SELECT json_group_array(
    json_set(
      p.value,
      '$.id', lower(hex(randomblob(8))),
      '$.origin', 'interview',
      '$.expiresAt', json('null'),
      '$.evidence', (
        SELECT json_group_array(json_set(
          json_remove(e.value, '$.countsAsUserInput'),
          '$.weight',
          CASE
            WHEN json_extract(e.value, '$.weight') IS NOT NULL THEN json_extract(e.value, '$.weight')
            WHEN json_extract(e.value, '$.sourceLabel') LIKE '%선택지를 고른 답%' THEN 'supporting'
            ELSE 'primary'
          END
        ))
        FROM json_each(p.value, '$.evidence') AS e
      )
    )
  )
  FROM json_each(brand_profiles.pillars_json) AS p
);

UPDATE brand_profiles SET voice_rules_json = (
  SELECT json_group_array(json_object('text', value, 'origin', 'interview', 'expiresAt', json('null')))
  FROM json_each(brand_profiles.voice_rules_json)
);

UPDATE brand_profiles SET avoid_json = (
  SELECT json_group_array(json_object('text', value, 'origin', 'interview', 'expiresAt', json('null')))
  FROM json_each(brand_profiles.avoid_json)
);

-- 「보여 주는 방식」: 그 판을 만든 세션의 설문 S6 ("고른 것 — 덧붙인 글")
UPDATE brand_profiles SET presence_json = (
  SELECT CASE
    WHEN json_extract(s.survey_json, '$.S6') IS NULL THEN NULL
    ELSE json_object(
      'text',
      COALESCE((SELECT group_concat(value, ', ') FROM json_each(s.survey_json, '$.S6.choices')), '')
        || COALESCE(' — ' || NULLIF(json_extract(s.survey_json, '$.S6.text'), ''), ''),
      'source', 'S6',
      'origin', 'interview'
    )
  END
  FROM identity_sessions s WHERE s.id = brand_profiles.session_id
);
