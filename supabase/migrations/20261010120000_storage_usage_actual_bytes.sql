-- 저장 용량 = Storage(medical-files) 실제 저장 바이트 기준으로 전환.
--
-- 배경 (2026-10):
--   record_files / lab_test_files.file_size 에 압축 전 원본 크기가 기록돼 사용량이 실제보다
--   약 20배 과대 계산됨 (예: 무료 사용자 실제 1.6MB 인데 51.8MB=104% 로 첨부 차단).
--   앱 업로드 경로 = medical-files/{user_id}/{record_or_lab_id}/{uuid}.{ext} (124개 전부 확인).
--   → 사용량을 storage.objects.metadata.size 합으로 계산 (기록에 연결 안 된 파일도 실제 공간이므로 포함).
--
-- 관리자 RPC 의 anon/authenticated 실행권한 회수는 별도 보안 마이그레이션
--   (20261010110000_revoke_public_rpc_grants.sql) 으로 분리. 이 파일은 그 권한을 건드리지 않음
--   (CREATE OR REPLACE 는 기존 ACL 을 유지).
--
-- 데이터 변경 없음 (함수 정의/권한만). 롤백 = 하단 주석의 이전 정의로 CREATE OR REPLACE.

-- 1) 사용자 1명의 실제 저장 바이트 (/api/storage-usage 전용, service_role 만)
CREATE OR REPLACE FUNCTION public.storage_used_bytes(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(SUM((o.metadata->>'size')::bigint), 0)::bigint
  FROM storage.objects o
  WHERE o.bucket_id = 'medical-files'
    -- '{uuid}/' 접두 범위 → idx_objects_current_version 인덱스 범위 스캔
    AND o.name COLLATE "C" >= (p_user_id::text || '/')
    AND o.name COLLATE "C" <  (p_user_id::text || '0')
    AND o.archived_at IS NULL
    AND NOT COALESCE(o.is_delete_marker, false);
$$;

-- 신규 함수: Supabase 기본 권한이 anon/authenticated 에 직접 EXECUTE 를 주므로 명시 회수 필수.
REVOKE ALL ON FUNCTION public.storage_used_bytes(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_used_bytes(uuid) TO service_role;

-- 2) 관리자 사용자별 집계 — 반환 형태 동일, 기준만 Storage 실제 바이트로
CREATE OR REPLACE FUNCTION public.get_storage_usage_by_user()
RETURNS TABLE(user_id uuid, file_count bigint, total_bytes bigint, last_upload timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    split_part(o.name, '/', 1)::uuid                     AS user_id,
    COUNT(*)::bigint                                     AS file_count,
    COALESCE(SUM((o.metadata->>'size')::bigint), 0)::bigint AS total_bytes,
    MAX(o.created_at)                                    AS last_upload
  FROM storage.objects o
  WHERE o.bucket_id = 'medical-files'
    AND split_part(o.name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND o.archived_at IS NULL
    AND NOT COALESCE(o.is_delete_marker, false)
  GROUP BY 1;
$$;

-- 새 RPC 를 Data API(PostgREST)가 즉시 인식하도록 스키마 캐시 리로드.
--   dev 실측: 적용 직후 수 초간 /api/storage-usage 가 503(fail-closed) → 리로드로 공백 제거.
NOTIFY pgrst, 'reload schema';

-- 롤백 (get_storage_usage_by_user 이전 정의, 20260607000000_admin_stats_rpcs.sql):
--   CREATE OR REPLACE FUNCTION public.get_storage_usage_by_user()
--   RETURNS TABLE(user_id uuid, file_count bigint, total_bytes bigint, last_upload timestamptz)
--   LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
--     SELECT rf.user_id, COUNT(*)::bigint, COALESCE(SUM(rf.file_size), 0)::bigint, MAX(rf.created_at)
--     FROM public.record_files rf GROUP BY rf.user_id; $$;
--   DROP FUNCTION IF EXISTS public.storage_used_bytes(uuid);
--   ⚠️ 롤백 순서: 코드(/api/storage-usage 가 storage_used_bytes 사용)를 먼저 되돌린 뒤 DROP.
