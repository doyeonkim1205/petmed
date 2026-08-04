-- 앱 스토어 업데이트 게이트 v1 — 원격 설정 테이블(플랫폼별 1행).
--   운영자 제어형: latest_build 지정 → 앱이 설치빌드와 비교해 대상자에게만 모달.
--   v1 = 선택(soft) 업데이트만. 필수(hard)는 min_supported_build=null 로 OFF.
--   접근: RLS 정책 없음(default deny) + anon/authenticated 권한 회수 → 클라 직접접근 차단.
--         서버 API(GET /api/app-config)가 service_role 로만 조회(RLS/grant 우회).

create table if not exists public.app_update_config (
  platform             text primary key check (platform in ('android','ios')),
  enabled              boolean not null default true,
  latest_version       text,                                          -- 표시용 버전 문자열
  latest_build         text,                                          -- 선택 업데이트 기준. null=선택 OFF.
                                                                      --   ⚠️ text 컬럼 — 빌드 대소 비교는 반드시 앱의 compareBuild(세그먼트 숫자비교)로만.
                                                                      --      SQL 의 text 정렬(예: ORDER BY latest_build)은 "9">"10" 이 되어 최신 판단에 쓰면 안 됨.
  min_supported_build  text,                                          -- 필수 업데이트 기준. null=필수 OFF.
  store_url            text not null,                                 -- 공식 스토어 HTTPS (API 가 도메인 검증)
  reminder_days        integer not null default 7 check (reminder_days >= 1),
  updated_at           timestamptz not null default now()
);
--   ⚠️ min_supported_build <= latest_build 제약은 text 비교라 DB CHECK 로 못 검. API(isValidUpdateConfig)가 검증 →
--      위반 시 enabled:false 응답 + 로그(운영자 오타로 전체 유저 브릭 방지).

alter table public.app_update_config enable row level security;
revoke all on public.app_update_config from anon, authenticated;

-- seed (idempotent). latest_build = 현재 스토어 공개 빌드 → 현재 유저에겐 모달 안 뜸(안전한 기본값). min=null=필수 OFF.
--   ⚠️ 새 네이티브 빌드가 스토어에 "실제 공개"된 뒤 latest_version/latest_build 갱신(Android 는 단계배포 100% 후).
--   iOS store_url 의 App ID(6783735811)는 src/app/start/page.tsx 의 App Store 랜딩 링크에서 확인됨.
insert into public.app_update_config (platform, enabled, latest_version, latest_build, min_supported_build, store_url, reminder_days)
values
  ('android', true, '1.0.43', '43', null, 'https://play.google.com/store/apps/details?id=com.dylabs.pawdex', 7),
  ('ios',     true, '1.0.1',  '10', null, 'https://apps.apple.com/app/id6783735811', 7)
on conflict (platform) do nothing;
