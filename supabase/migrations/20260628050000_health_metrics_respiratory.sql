-- health_metrics.metric_type 에 'respiratory'(호흡수) 추가.
--
-- 호흡수 기록 신기능 — 분당 호흡수(value, 회/분), 측정 상태(memo: sleeping/resting/
-- afterActivity/other). 기존 water/food/fluid 와 같은 테이블 재사용.
--
-- ⚠️ 2026-06-28 현재 DEV(lzmmiksdvioidcldrnvh)에만 적용. 기능을 main(운영)에 배포할 때
-- PROD(ylbxtzwbwbnlmfxqgmoz)에도 반드시 동일 적용할 것 (안 하면 호흡수 INSERT 가 CHECK 로 거부됨).

ALTER TABLE public.health_metrics DROP CONSTRAINT IF EXISTS health_metrics_metric_type_check;
ALTER TABLE public.health_metrics
  ADD CONSTRAINT health_metrics_metric_type_check
  CHECK (metric_type = ANY (ARRAY['water'::text, 'food'::text, 'fluid'::text, 'respiratory'::text]));
