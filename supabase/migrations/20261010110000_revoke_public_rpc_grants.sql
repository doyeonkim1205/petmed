-- 보안 수정: 서버(service_role) 전용 SECURITY DEFINER RPC 의 anon/authenticated 실행권한 회수.
--
-- 배경 (2026-10 점검):
--   아래 함수들은 생성 시 REVOKE ... FROM PUBLIC 만 했거나 아예 회수하지 않아, Supabase 기본 권한
--   (anon/authenticated 에 EXECUTE 직접 GRANT)이 남아 있었음 → 공개 anon 키로 Data API
--   /rest/v1/rpc/<fn> 호출 가능.
--     - get_storage_usage_by_user   : 전체 사용자 id/파일수/용량
--     - get_orphan_activity_user_ids: 탈퇴 사용자 id
--     - get_trends                  : 가입/검색/매출 추이
--     - get_cron_last_run           : 크론 실행 상태
--     - upsert_push_subscription    : 임의 p_user_id 로 푸시 구독 등록/덮어쓰기 (호출자 검증 없음)
--   앱 호출 경로는 전부 서버 라우트(verifyAuth/verifyAdmin 후 service_role 클라이언트):
--     admin/storage, admin/activity-logs, admin/trends, admin/notifications/stats, push/subscribe.
--   → anon/authenticated 회수해도 앱 동작 영향 없음 (dev 실측: 관리자 API 5경로·푸시 구독/해제 정상).
--
-- 안전장치: 5개가 정확한 서명으로 모두 있어야 실행, 하나라도 없으면 EXCEPTION 으로 전체 중단.
--           적용 후 권한이 기대와 다르면 EXCEPTION → 블록 전체 롤백.
-- 함수 정의/데이터 변경 없음. 재실행 안전(멱등).
-- 장애 시: 먼저 해당 서버 API 가 service_role 키로 호출하는지·실행 경로 확인.
--          anon/authenticated 재부여(GRANT)는 취약점 재개방이므로 최후의 수단.

DO $$
DECLARE
  targets text[] := ARRAY[
    'public.get_storage_usage_by_user()',
    'public.get_orphan_activity_user_ids()',
    'public.get_trends(text, integer)',
    'public.get_cron_last_run(text)',
    'public.upsert_push_subscription(uuid, text, text, text)'
  ];
  t text;
  f regprocedure;
  missing text[] := ARRAY[]::text[];
BEGIN
  -- 1) 사전 검증: 5개 모두 정확한 서명으로 존재하는지 확인 (하나라도 없으면 아무것도 바꾸지 않고 중단)
  FOREACH t IN ARRAY targets LOOP
    IF to_regprocedure(t) IS NULL THEN
      missing := array_append(missing, t);
    END IF;
  END LOOP;
  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: target function(s) not found with exact signature: %', array_to_string(missing, ', ');
  END IF;

  -- 2) 권한 회수 + service_role 실행 보장
  FOREACH t IN ARRAY targets LOOP
    f := to_regprocedure(t);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;

  -- 3) 사후 검증: 기대 상태가 아니면 예외 → 블록 전체 롤백
  FOREACH t IN ARRAY targets LOOP
    f := to_regprocedure(t);
    IF has_function_privilege('anon', f, 'EXECUTE')
       OR has_function_privilege('authenticated', f, 'EXECUTE')
       OR NOT has_function_privilege('service_role', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'ABORT: unexpected privileges after revoke on %', t;
    END IF;
  END LOOP;
END $$;
