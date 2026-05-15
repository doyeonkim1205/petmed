-- pg_cron 의 cron.job_run_details 를 PostgREST 통해 안전하게 조회하기 위한
-- public 스키마 헬퍼 함수.
--
-- 배경: cron 스키마는 Supabase PostgREST 기본 노출에서 제외됨. 직접
-- supabaseAdmin.from('cron.job_run_details').select() 호출하면 안 보임.
-- SECURITY DEFINER 로 함수 만들어 service_role 만 호출 가능하게 GRANT.
--
-- 사용처: /api/admin/notifications/stats — admin 진단 카드의 cronHealth
-- (cron 정상 가동 중 / 지연 / 멈춤 표시).

CREATE OR REPLACE FUNCTION public.get_cron_last_run(p_jobname text)
RETURNS TABLE(start_time timestamptz, status text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT jrd.start_time, jrd.status
  FROM cron.job_run_details jrd
  JOIN cron.job j ON j.jobid = jrd.jobid
  WHERE j.jobname = p_jobname
  ORDER BY jrd.start_time DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_cron_last_run(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cron_last_run(text) TO service_role;
