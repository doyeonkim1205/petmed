-- 음수·식사·수액 기록에도 시각(시간)을 저장 — 대소변처럼 날짜 헤더 + 시간 표시용.
-- measured_at: date → timestamptz. 기존 date 값은 자정으로 변환됨(날짜 보존).
-- 일별 합산/버킷팅은 클라이언트에서 로컬 날짜(localDateKey)로 처리 → UTC 함정 회피.
alter table public.health_metrics
  alter column measured_at type timestamptz using measured_at::timestamptz;
alter table public.health_metrics
  alter column measured_at set default now();
