-- Photo analysis support
-- 사진 증상 분석 (Vision API) 도입을 위한 컬럼 추가 + dev catch-up.
--
-- 변경 사항:
-- 1. dev 누락된 search_logs.kind 컬럼 보강 (prod 에는 이미 존재 → IF NOT EXISTS 로 멱등)
-- 2. saved_analyses.kind 컬럼 추가 (보관함 통합 — 'paper' vs 'symptom_photo')
-- 3. search_logs.result_summary JSONB 추가 (분석 메타: input_type, main_category, ai_confidence, is_valid_photo)
-- 4. 사용량 카운트 인덱스 (user_id, kind, created_at DESC)

-- 1) search_logs.kind: dev 누락 catch-up. prod 는 이미 존재.
ALTER TABLE search_logs
  ADD COLUMN IF NOT EXISTS kind text;

-- dev 의 기존 행이 있다면 'symptom' 으로 백필 (prod 는 이미 채워져 있으므로 영향 없음)
UPDATE search_logs SET kind = 'symptom' WHERE kind IS NULL;

ALTER TABLE search_logs
  ALTER COLUMN kind SET NOT NULL;

-- 2) saved_analyses.kind: 보관함 통합 ('paper' 기존 / 'symptom_photo' 신규)
ALTER TABLE saved_analyses
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'paper';

-- 3) search_logs.result_summary: 분석 메타 데이터
--    예: { "input_type": "photo_with_text", "main_category": "Dermatology",
--         "ai_confidence": "high", "is_valid_photo": true }
ALTER TABLE search_logs
  ADD COLUMN IF NOT EXISTS result_summary jsonb;

-- 4) 사용량 카운트 인덱스 (오늘 분량 빠른 집계)
CREATE INDEX IF NOT EXISTS idx_search_logs_user_kind_created
  ON search_logs (user_id, kind, created_at DESC);

-- 5) 보관함 필터 인덱스
CREATE INDEX IF NOT EXISTS idx_saved_analyses_user_kind_created
  ON saved_analyses (user_id, kind, created_at DESC);
