-- 복약 재구조화: 진료기록(record_id) 종속 → 펫(pet_id) 단위로 승격
-- 매일 주는 영양제 등도 진료 기록 없이 펫에 직접 등록할 수 있게 한다.
-- record_id 는 진료/입퇴원에 딸린 약(기존 입구)을 위해 유지하되 nullable 로 푼다.

-- 1) 펫 직접 연결 컬럼
ALTER TABLE medications ADD COLUMN IF NOT EXISTS pet_id UUID REFERENCES pets(id) ON DELETE CASCADE;

-- 2) record 없이도 등록 가능하도록 NOT NULL 해제
ALTER TABLE medications ALTER COLUMN record_id DROP NOT NULL;

-- 3) 종류 태그: 처방약 / 영양제 / 기타
ALTER TABLE medications ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'prescription';
ALTER TABLE medications DROP CONSTRAINT IF EXISTS medications_kind_check;
ALTER TABLE medications ADD CONSTRAINT medications_kind_check CHECK (kind IN ('prescription', 'supplement', 'other'));

-- 4) 기존 데이터: 진료기록을 통해 pet_id 백필 (무손실)
UPDATE medications m
SET pet_id = hr.pet_id
FROM health_records hr
WHERE m.record_id = hr.id AND m.pet_id IS NULL;

-- 5) 펫 단위 조회 성능
CREATE INDEX IF NOT EXISTS idx_medications_pet_id ON medications(pet_id);
