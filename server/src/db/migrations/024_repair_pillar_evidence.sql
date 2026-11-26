-- 004 가 남긴 결함을 고친다: 축의 근거(evidence)가 배열이 아니라 "배열을 적은 문자열"로 저장된 판을 배열로 되돌린다
-- 원인: 004 는 json_set(…, '$.evidence', (SELECT json_group_array(…))) 로 썼는데, SQLite 는 하위 질의를 거친 값의
--       JSON 표시(subtype)를 잃어 문자열로 넣는다(SQLite 3.54.1 에서 확인). 004 는 이미 적용된 파일이라 고치지 않고
--       (체크섬 검사에 걸린다) 새 번호로 바로잡는다. 이미 배열인 판은 건드리지 않는다
UPDATE brand_profiles SET pillars_json = (
  SELECT json_group_array(
    json_set(
      p.value,
      '$.evidence',
      json(
        CASE
          WHEN json_type(p.value, '$.evidence') = 'text' AND json_valid(json_extract(p.value, '$.evidence'))
            THEN json_extract(p.value, '$.evidence')
          ELSE COALESCE(json_extract(p.value, '$.evidence'), '[]')
        END
      )
    )
  )
  FROM json_each(brand_profiles.pillars_json) AS p
)
WHERE EXISTS (
  SELECT 1 FROM json_each(brand_profiles.pillars_json) AS q
  WHERE json_type(q.value, '$.evidence') = 'text'
);
