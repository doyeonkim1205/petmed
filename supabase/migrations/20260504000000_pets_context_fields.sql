-- 펫 컨텍스트 확장 — AI 증상분석에 펫 정보 활용 위해 필드 추가.
--
-- 추가 컬럼:
--   sex                 — 성별 ('male' | 'female') — 일부 질병 (자궁축농증,
--                         전립선 질환 등) 이 성별 특이라 분석 정확도 ↑.
--   neutered            — 중성화 여부 (BOOLEAN) — 호르몬 관련 질병 / 비만
--                         위험도 평가에 사용.
--   weight              — 현재 체중 (kg) — 약 용량 / 비만 평가 / 체중 변화
--                         추적의 시작점.
--   chronic_conditions  — 만성질환 목록 (TEXT[]) — "이 펫은 신부전 환자"
--                         같은 컨텍스트를 분석에 자동 반영.
--
-- 모두 NULL 허용 — 기존 펫 데이터 영향 0. 신규 등록 시 선택 입력.
-- 사용자가 점진적으로 채울 수 있도록 "프로필 보완 안내" 부드러운 prompt 으로 유도.
--
-- 주의:
--   - 새 컬럼 추가만 — 기존 컬럼/제약/인덱스 변경 X.
--   - INSERT 시 새 컬럼 생략하면 NULL — 기존 코드 (profile/page.tsx 의 PetModal)
--     수정 없이도 작동.

ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS sex TEXT,
  ADD COLUMN IF NOT EXISTS neutered BOOLEAN,
  ADD COLUMN IF NOT EXISTS weight NUMERIC,
  ADD COLUMN IF NOT EXISTS chronic_conditions TEXT[];

-- sex 값 검증: NULL 또는 'male'/'female' 만 허용.
-- (한국어 표기는 UI 단에서 변환 — DB 는 영문 통일.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pets_sex_check'
  ) THEN
    ALTER TABLE pets
      ADD CONSTRAINT pets_sex_check
      CHECK (sex IS NULL OR sex IN ('male', 'female'));
  END IF;
END $$;

-- weight 값 검증: 음수 차단 (오타 방지).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pets_weight_check'
  ) THEN
    ALTER TABLE pets
      ADD CONSTRAINT pets_weight_check
      CHECK (weight IS NULL OR weight > 0);
  END IF;
END $$;
