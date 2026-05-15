-- Performance indexes for medications table.
--
-- 1. user_id index: 일반 유저 쿼리 (CRUD, getTodayMedications) 가속.
-- 2. Cron partial index: 1분 단위 cron 의 활성 알림 필터링 가속.
--    `WHERE alarm_enabled = true` 부분 인덱스라 알림 켠 row 만 대상 →
--    테이블이 커져도 풀스캔 회피.

CREATE INDEX IF NOT EXISTS medications_user_id_idx
  ON medications (user_id);

CREATE INDEX IF NOT EXISTS medications_cron_active_idx
  ON medications (start_date, end_date)
  WHERE alarm_enabled = true;
