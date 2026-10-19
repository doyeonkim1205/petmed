-- 보안 수정 (1/2): profiles 클라이언트 INSERT·DELETE 를 앱이 실제로 쓰는 범위로 축소.
--
-- 배경 (2026-10 점검, dev 실측):
--   authenticated 가 profiles 에 테이블 단위 INSERT·DELETE 권한을 갖고 있었음.
--   → 본인 프로필을 plan='plus' 로 직접 생성 / 삭제 후 재생성 가능 (결제 없이 Plus).
--      role 은 protect_role_column 트리거가 막지만 plan 은 무방비.
--
-- 앱이 실제로 쓰는 클라이언트 INSERT (코드 확인, 기존·신규 코드 동일):
--   AuthContext ensureProfile upsert(id, email, nickname, avatar_url) + ignoreDuplicates, 가입 insert(id, email, nickname)
--   클라이언트 DELETE: 없음 (탈퇴·관리자 삭제는 service_role 서버 라우트)
-- → 기존 코드와 호환되므로 코드 배포와 무관하게 먼저 적용 가능.
--   quota_timezone UPDATE 회수는 RegionSync 신규 코드 배포 후 2/2 (20261011100100) 에서.
--
-- 기존 데이터 변경 없음. 재실행 안전. 사후 검증 실패 시 전체 롤백.

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

  -- 4) 사후 검증 — 기대와 다르면 전체 롤백
  IF has_table_privilege('authenticated', 'public.profiles', 'DELETE')
     OR has_table_privilege('anon', 'public.profiles', 'DELETE')
     OR has_table_privilege('anon', 'public.profiles', 'INSERT')
     OR has_column_privilege('authenticated', 'public.profiles', 'plan', 'INSERT')
     OR has_column_privilege('authenticated', 'public.profiles', 'role', 'INSERT')
     OR has_column_privilege('authenticated', 'public.profiles', 'quota_timezone', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.profiles', 'id', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.profiles', 'email', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.profiles', 'nickname', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'INSERT') THEN
    RAISE EXCEPTION 'ABORT: unexpected profiles INSERT/DELETE privileges after change';
  END IF;
END $$;
