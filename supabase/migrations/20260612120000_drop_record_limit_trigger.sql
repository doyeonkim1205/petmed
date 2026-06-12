-- 무료 플랜 기록 무제한화: 레거시 DB 트리거 제거
--
-- 코드(plans.ts)는 이미 free.maxRecords = 0(무제한)으로 바뀌었으나,
-- 옛 버전의 DB 트리거 enforce_record_limit / check_record_limit() 가 남아
-- 무료 유저를 15개로 막고 있었음(코드↔DB 불일치). 무료 유저가 15개를 넘기면
-- health_records INSERT 가 트리거 예외로 전부 실패 → 기록 저장 불가.
--
-- 기록은 retention(데이터 묶어두기)용이고 수익화 레버가 아니므로(비용 방어는
-- 저장용량 maxStorageMB 로) 트리거를 완전히 제거해 코드 의도(무제한)와 일치시킨다.

DROP TRIGGER IF EXISTS enforce_record_limit ON public.health_records;
DROP FUNCTION IF EXISTS public.check_record_limit();
