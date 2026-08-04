-- 앱 설치 버전/빌드 분포 (운영자 수동 실행 — 어드민 UI 없음, v1).
-- 용도: 유저들이 실제로 어떤 앱 버전을 쓰는지 파악 → app_update_config.min_supported_build 를
--       올려 필수 업데이트를 걸기 전에 "구버전 유저가 몇 %인지" 근거로 확인.
--
-- 집계 기준:
--   · 최근 30일 활성 세션만 (last_active — active_sessions 의 마지막 활동 컬럼).
--   · (platform, device_id) 별 "최신 1행"만 선택 → 한 기기가 여러 행/유저 다세션으로 부풀지 않게.
--   · 최신 행 확정: last_active DESC, 동률이면 id(PK) DESC 로 결정론적 선택.
--   · device_id / app_version / app_build 이 NULL 인 행 제외(네이티브 미보고분).
--
-- ⚠️ app_build 는 text 컬럼이다. 아래 마지막 ORDER BY app_build DESC 는 **문자열 정렬**이라
--    "9" > "10" 처럼 뒤집힌다 — 표시 정렬(cosmetic)일 뿐, "어느 빌드가 최신인가" 판단에는 쓰지 말 것.
--    실제 빌드 대소 비교는 앱의 lib/appVersionCompare.ts (compareBuild, 세그먼트 숫자비교)로만 한다.

select platform, app_version, app_build, count(*) as devices
from (
  select distinct on (platform, device_id)
    platform, device_id, app_version, app_build
  from public.active_sessions
  where last_active > now() - interval '30 days'
    and platform in ('android', 'ios')
    and device_id  is not null
    and app_version is not null
    and app_build   is not null
  order by platform, device_id, last_active desc, id desc  -- last_active 동률 시 PK 로 최신행 확정
) latest
group by platform, app_version, app_build
order by platform, app_build desc;  -- ⚠️ text 정렬(cosmetic) — 최신 빌드 판단용 아님
