-- FK / 자주 JOIN 되는 컬럼 인덱스 추가.
--
-- Postgres 는 외래키 컬럼에 자동 인덱스를 생성하지 않음. 데이터 증가 시
-- 유저별 / 기록별 조회가 seq scan 으로 떨어져 느려지는 것을 방지.
--
-- 쿼리 패턴:
--   - health_records WHERE user_id = $me → /records 목록 로드
--   - health_records WHERE pet_id = $x → 특정 반려동물 기록 조회
--   - pets WHERE user_id = $me → PetSelector 로드
--   - medications WHERE record_id = $x → records/[id] 상세
--   - record_files WHERE record_id = $x → 첨부파일 조회
--   - record_files WHERE user_id = $me → 스토리지 사용량 집계
--
-- IF NOT EXISTS 로 멱등 — 재실행 안전.

CREATE INDEX IF NOT EXISTS idx_health_records_user_id
  ON health_records (user_id);

CREATE INDEX IF NOT EXISTS idx_health_records_pet_id
  ON health_records (pet_id);

CREATE INDEX IF NOT EXISTS idx_pets_user_id
  ON pets (user_id);

CREATE INDEX IF NOT EXISTS idx_medications_record_id
  ON medications (record_id);

CREATE INDEX IF NOT EXISTS idx_record_files_record_id
  ON record_files (record_id);

CREATE INDEX IF NOT EXISTS idx_record_files_user_id
  ON record_files (user_id);
