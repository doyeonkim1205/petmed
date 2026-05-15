-- RLS UPDATE 정책에 WITH CHECK 추가 — 소유권 이전 우회 방어.
--
-- 문제: 기존 UPDATE 정책은 USING (auth.uid() = user_id) 만 있고 WITH CHECK
-- 없음. 유저가 anon key 로 직접 PATCH 호출 시 body 에 user_id='<victim>' 을
-- 실어 자기 row 를 피해자 소유로 이전 가능 (데이터 오염 벡터).
--
-- 수정: WITH CHECK 추가해 UPDATE 후 상태도 자기 소유여야 함을 강제.
--
-- 영향:
--   - 우리 코드베이스는 .update({user_id:...}) 호출 0건 → 회귀 없음
--   - service_role (cron/admin) 은 RLS 자체를 bypass → 영향 없음
--   - profiles 는 이미 WITH CHECK 있어서 제외
--   - activity_logs, search_logs, payment_history 는 UPDATE 정책 자체가 없어
--     서비스롤만 변경 가능 → 대상 외

ALTER POLICY "medications_update_own" ON medications
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "med_checks_update_own" ON medication_checks
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "pets_update_own" ON pets
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "record_files_update_own" ON record_files
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "weight_logs_update_own" ON weight_logs
  WITH CHECK (auth.uid() = user_id);
