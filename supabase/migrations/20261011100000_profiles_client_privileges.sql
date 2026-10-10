-- 보안 수정: profiles 의 클라이언트(anon/authenticated) 권한을 앱이 실제로 쓰는 범위로 축소.
--
-- 배경 (2026-10 점검, dev 실측):
--   authenticated 가 profiles 에 테이블 단위 INSERT·DELETE 권한을 갖고 있었음.
--   → 본인 프로필을 plan='plus' 로 직접 생성 / 삭제 후 재생성 가능 (결제 없이 Plus).
--      role 은 protect_role_column 트리거가 막지만 plan 은 무방비.
--   → quota_timezone 도 직접 UPDATE·재생성 가능 → 일일 한도 창을 리셋하는 우회.
--
-- 앱이 실제로 쓰는 클라이언트 경로 (코드 확인):
--   INSERT: AuthContext ensureProfile upsert(id, email, nickname, avatar_url), 가입 insert(id, email, nickname)
--   UPDATE: nickname, avatar_url, is_push_enabled, preferred_language, market_region, market_region_source
--   DELETE: 없음 (탈퇴·관리자 삭제는 service_role 서버 라우트)
--   quota_timezone: 신규 서버 API /api/profile/quota-timezone (service_role, 비어 있을 때 1회)
--
-- 순서: 코드(RegionSync → 서버 API) 배포 후 적용. 기존 데이터 변경 없음. 재실행 안전.

DO $$
DECLARE
  col text;
BEGIN
  -- 1) 테이블 단위 INSERT·DELETE 회수
  REVOKE INSERT, DELETE ON public.profiles FROM anon, authenticated;

  -- 2) 남아 있을 수 있는 컬럼 단위 INSERT 도 전부 회수
  FOR col IN SELECT a.attname FROM pg_attribute a
             WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped LOOP
    EXECUTE format('REVOKE INSERT (%I) ON public.profiles FROM anon, authenticated', col);
  END LOOP;

  -- 3) 앱이 쓰는 INSERT 컬럼만 재부여 (plan/role/quota_timezone 등은 기본값으로만 생성)
  GRANT INSERT (id, email, nickname, avatar_url) ON public.profiles TO authenticated;

  -- 4) quota_timezone 클라이언트 UPDATE 회수 (서버 API 전용)
  REVOKE UPDATE (quota_timezone) ON public.profiles FROM anon, authenticated;

  -- 5) 사후 검증 — 기대와 다르면 전체 롤백
  IF has_table_privilege('authenticated', 'public.profiles', 'DELETE')
     OR has_column_privilege('authenticated', 'public.profiles', 'plan', 'INSERT')
     OR has_column_privilege('authenticated', 'public.profiles', 'role', 'INSERT')
     OR has_column_privilege('authenticated', 'public.profiles', 'quota_timezone', 'INSERT')
     OR has_column_privilege('authenticated', 'public.profiles', 'quota_timezone', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.profiles', 'nickname', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.profiles', 'market_region', 'UPDATE') THEN
    RAISE EXCEPTION 'ABORT: unexpected profiles privileges after change';
  END IF;
END $$;
