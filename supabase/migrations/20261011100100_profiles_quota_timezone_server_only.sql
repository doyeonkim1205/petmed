-- 보안 수정 (2/2): profiles.quota_timezone 클라이언트 UPDATE 회수 — 서버 API 전용.
--
-- 배경 (2026-10 점검, dev 실측): 로그인 사용자가 quota_timezone 을 직접 바꿔 일일 AI 한도 창을 리셋 가능
--   (하루 중 언제든 자정이 1시간 이내로 지난 시간대가 존재 → 한도 무력화).
-- 대체 경로: POST /api/profile/quota-timezone (verifyAuth + IANA 검증 + service_role, 비어 있을 때 1회).
--
-- ⚠️ 선행 조건: RegionSync 신규 코드(quota_timezone 을 서버 API 로 보냄) 운영 배포 + 동작 확인 후 적용.
--   구 코드 화면이 열려 있으면 그 화면의 RegionSync UPDATE(지역+시간대 한 문장)가 42501 로 실패 →
--   신규 가입자의 market_region 이 저장되지 않음 (화면 지역은 기기 시간대 추정으로 동일하게 동작, 새 코드 로드 시 자동 저장).
-- 기존 데이터 변경 없음. 재실행 안전. 사후 검증 실패 시 전체 롤백.

DO $$
BEGIN
  REVOKE UPDATE (quota_timezone) ON public.profiles FROM anon, authenticated;

  IF has_column_privilege('authenticated', 'public.profiles', 'quota_timezone', 'UPDATE')
     OR has_column_privilege('anon', 'public.profiles', 'quota_timezone', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.profiles', 'market_region', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.profiles', 'market_region_source', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.profiles', 'nickname', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.profiles', 'is_push_enabled', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.profiles', 'preferred_language', 'UPDATE') THEN
    RAISE EXCEPTION 'ABORT: unexpected profiles UPDATE privileges after change';
  END IF;
END $$;
