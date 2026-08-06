-- 다음 예약에 선택 입력 "예약 메모"(재검·항암 3차 등). 캘린더 예약일에 원 진료 사유 대신 이 메모를 표시.
--   비면 병원명 → "다음 진료" 순으로 폴백. 진료(visit) 기록의 next_appointment_date 와 세트.
alter table public.health_records add column if not exists next_appointment_reason text;
