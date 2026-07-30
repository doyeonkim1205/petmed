import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';

// 세션 텔레메트리 하트비트 — 앱 실행 시 설치 버전/빌드 갱신(버전 분포 통계).
//   ⚠️ verify(GET)와 분리한 이유: GET 은 조회 전용이어야 함(캐시/재시도 안전). 갱신은 여기 POST 에서.
//   ⚠️ claim 과 달리 eviction/슬롯 로직 없음. **update-only**(행 없으면 무시) — 밀려난 기기가
//      하트비트로 슬롯을 재생성하지 않도록. 버전 수집 실패는 세션/앱 사용에 영향 없어야 함.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request, { skipDeviceCheck: true });
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  const { device_id, platform, app_version, app_build } = await request.json().catch(() => ({}));
  if (!device_id) {
    return NextResponse.json({ error: 'device_id is required' }, { status: 400 });
  }

  const platformLabel = ['ios', 'android', 'web'].includes(platform) ? platform : null;
  const clean = (v: unknown): string | null =>
    typeof v === 'string' && v.trim().length > 0 && v.length <= 32 ? v.trim() : null;
  const appVersion = clean(app_version);
  const appBuild = clean(app_build);

  // update-only: 이미 claim 된 기기의 행만 갱신(없으면 0 rows, 재생성 안 함).
  await supabaseAdmin
    .from('active_sessions')
    .update({
      last_active: new Date().toISOString(),
      ...(platformLabel ? { platform: platformLabel } : {}),
      ...(appVersion ? { app_version: appVersion } : {}),
      ...(appBuild ? { app_build: appBuild } : {}),
    })
    .eq('user_id', userId)
    .eq('device_id', device_id);

  return NextResponse.json({ ok: true });
}
