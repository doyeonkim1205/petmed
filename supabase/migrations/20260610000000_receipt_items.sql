-- 영수증 OCR (Phase 1a) — 진료/입퇴원 기록에 "간이 영수증" 저장.
--
-- receipt_items: 영수증에서 추출한 항목 배열 (JSONB).
--   각 항목: { name: text, amount: number, category: text, note?: text }
--   · category ∈ consult|test|med|treatment|vaccine|etc
--   · 총액만 있는 영수증 → [] (빈 배열). 항목 없으면 null/[].
--   · 멀티 영수증(입퇴원 등)은 스캔을 누적 병합해 한 배열로 저장.
--
-- 총액·병원명·날짜는 기존 컬럼(cost·hospital_name·visit_date) 재사용.
-- RLS: 같은 row 라 health_records 기존 정책이 그대로 커버 → 추가 정책 불필요.

alter table public.health_records
  add column if not exists receipt_items jsonb;

comment on column public.health_records.receipt_items is
  '영수증 OCR 추출 항목 배열 [{name, amount, category, note?}] · 총액만이면 [] · 멀티영수증 병합 저장';
