import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { isValidUpdateConfig } from '@/lib/appVersionCompare';

// 앱 업데이트 게이트 설정 조회 (사전 로그인 공개 — 구버전이 로그인 못 넘어가도 동작해야 함).
//   테이블은 RLS 로 클라 직접접근 차단 → 여기서 service_role 로 읽고 허용 필드만 반환.
//   ⚠️ v1: Cache-Control no-store (필수 업데이트는 "현재 실행의 신선 응답"에서만 발동해야 하므로 캐시 금지).
//   설정 유효성 실패(min>latest·비공식 store_url 등) → enabled:false 로 응답 + 로그(전체 브릭 방지).

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get('platform');
  if (platform !== 'android' && platform !== 'ios') {
    return NextResponse.json({ enabled: false }, { headers: NO_STORE });
  }

  const { data, error } = await supabaseAdmin
    .from('app_update_config')
    .select('enabled, latest_version, latest_build, min_supported_build, store_url, reminder_days')
    .eq('platform', platform)
    .maybeSingle();

  // 조회 실패/행 없음 → fail-open (아무것도 안 함).
  if (error || !data) {
    if (error) Sentry.captureException(error, { tags: { feature: 'app-update', action: 'config-read' } });
    return NextResponse.json({ enabled: false }, { headers: NO_STORE });
  }

  // 설정 유효성 검증 — 오설정이면 enabled:false (필수 업데이트로 전체 유저 브릭 방지).
  if (!data.enabled || !isValidUpdateConfig(platform, data)) {
    if (data.enabled) {
      // enabled=true 인데 값이 비정상 → 운영자 실수 가능성. 로그 남김.
      Sentry.captureMessage(`[app-update] invalid config for ${platform}`, {
        level: 'warning',
        tags: { feature: 'app-update' },
        extra: { platform, latest_build: data.latest_build, min_supported_build: data.min_supported_build, store_url: data.store_url, reminder_days: data.reminder_days },
      });
    }
    return NextResponse.json({ enabled: false }, { headers: NO_STORE });
  }

  // 허용 필드만 반환(테이블 원본 노출 X). updated_at 등은 제외.
  return NextResponse.json(
    {
      enabled: true,
      latestVersion: data.latest_version,
      latestBuild: data.latest_build,
      minSupportedBuild: data.min_supported_build,
      storeUrl: data.store_url,
      reminderDays: data.reminder_days,
    },
    { headers: NO_STORE },
  );
}
