-- 보안: profiles.role 권한 상승 차단 강화
--
-- 기존 prevent_role_change 트리거는 (1) UPDATE 에만 걸려있고 (2) JWT role='anon' 일 때만 막아서
-- 로그인 유저(authenticated)가  프로필 DELETE → role='admin' 으로 재INSERT 하면 관리자 승격이 가능했음.
--   - DELETE: RLS "Users can delete own profile" (auth.uid()=id) 허용
--   - INSERT: RLS "Users can insert own profile" WITH CHECK (auth.uid()=id) 가 role 을 검사하지 않음 + 트리거가 INSERT 미적용
--
-- 수정: INSERT/UPDATE 모두, anon/authenticated 모두에 대해 role 을 보호한다.
--   - INSERT: 클라이언트는 무조건 'user' 로만 생성 (값 무시하고 강제)
--   - UPDATE: role 변경 시도 차단
--   - service_role / 직접 postgres 접속(jwt 없음)은 자유롭게 설정 가능 → 관리자 지정은 service_role 로만

CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  jwt_role text := current_setting('request.jwt.claims', true)::json->>'role';
BEGIN
  IF jwt_role IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.role := 'user';
    ELSIF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'role 변경 권한이 없습니다.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_role_column ON public.profiles;
CREATE TRIGGER protect_role_column
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_change();
