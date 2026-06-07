-- Admin 통계/로그 페이지의 대용량 스캔을 DB 측 집계/안티조인으로 대체하는 RPC.
--
-- 배경 (P3 — 사용자 1000+ 대비 사전 fix):
--   1) /api/admin/storage 가 record_files 전체 row 를 앱 메모리로 끌어와 집계 →
--      파일 수만 단위 시 OOM/지연. DB 에서 user_id 별 집계만 반환.
--   2) /api/admin/activity-logs 의 'deleted_user' 필터가 살아있는 profile id 전부를
--      IN 절 inline → 유저 수백+ 시 URL 길이 초과로 깨짐. 반대로 "탈퇴 유저(고아) id"
--      만 반환 (탈퇴 유저는 소수라 항상 작은 목록).
--
-- 둘 다 읽기 전용. SECURITY DEFINER + service_role 만 실행 (admin 라우트 전용).

-- 1) 사용자별 스토리지 사용량 집계
CREATE OR REPLACE FUNCTION public.get_storage_usage_by_user()
RETURNS TABLE(user_id uuid, file_count bigint, total_bytes bigint, last_upload timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rf.user_id,
    COUNT(*)::bigint                         AS file_count,
    COALESCE(SUM(rf.file_size), 0)::bigint   AS total_bytes,
    MAX(rf.created_at)                        AS last_upload
  FROM public.record_files rf
  GROUP BY rf.user_id;
$$;

REVOKE ALL ON FUNCTION public.get_storage_usage_by_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storage_usage_by_user() TO service_role;

-- 2) activity_logs 중 profiles 에 없는 (탈퇴) user_id 목록
CREATE OR REPLACE FUNCTION public.get_orphan_activity_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT a.user_id
  FROM public.activity_logs a
  WHERE a.user_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = a.user_id);
$$;

REVOKE ALL ON FUNCTION public.get_orphan_activity_user_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_orphan_activity_user_ids() TO service_role;
