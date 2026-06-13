-- 건강 지표(음수·식사·수액)·체중 기록에 메모 추가 — 대소변 메모와 통일.
-- 측정 조건/맥락 메모용 (예: "공복 측정", "사료 바꿈", "병원 수액").
alter table public.health_metrics add column if not exists memo text;
alter table public.weight_logs add column if not exists memo text;
