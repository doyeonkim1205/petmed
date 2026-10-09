-- 보안 수정: 서버(service_role) 전용 SECURITY DEFINER RPC 의 anon/authenticated 실행권한 회수.
--
-- 배경 (2026-10 점검):
--   아래 함수들은 생성 시 REVOKE ... FROM PUBLIC 만 했거나 아예 회수하지 않아, Supabase 기본 권한
--   (anon/authenticated 에 EXECUTE 직접 GRANT)이 남아 있었음 → 공개 anon 키로 Data API
--   /rest/v1/rpc/<fn> 호출 가능.
--     - get_storage_usage_by_user   : 전체 사용자 id/파일수/용량
--     - get_orphan_activity_user_ids: 탈퇴 사용자 id
--     - get_trends                  : 가입/검색/매출 추이
--     - get_cron_last_run           : 크론 실행 상태 (운영에만 존재)
--     - upsert_push_subscription    : 임의 p_user_id 로 푸시 구독 등록/덮어쓰기 (호출자 검증 없음)
--   앱 호출 경로는 전부 서버 라우트(verifyAuth/verifyAdmin 후 service_role 클라이언트):
--     admin/storage, admin/activity-logs, admin/trends, admin/notifications/stats, push/subscribe.
--   → anon/authenticated 회수해도 앱 동작 영향 없음.
--
-- 함수 정의/데이터 변경 없음. 권한만 변경. 존재하는 함수에만 적용 (dev 에는 get_cron_last_run 없음).
-- 롤백: GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO anon, authenticated;  (권장하지 않음)

DO $$
DECLARE
  f regprocedure;
  targets text[] := ARRAY[
    'public.get_storage_usage_by_user()',
    'public.get_orphan_activity_user_ids()',
    'public.get_trends(text, integer)',
    'public.get_cron_last_run(text)',
    'public.upsert_push_subscription(uuid, text, text, text)'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY targets LOOP
    f := to_regprocedure(t);
    IF f IS NULL THEN
      RAISE NOTICE 'skip (not found): %', t;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    RAISE NOTICE 'revoked anon/authenticated: %', t;
  END LOOP;
END $$;
