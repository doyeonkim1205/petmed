import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';

// 세션 텔레메트리 하트비트 — 앱 실행 시 설치 버전/빌드 갱신(버전 분포 통계).
//   ⚠️ verify(GET)와 분리한 이유: GET 은 조회 전용이어야 함(캐시/재시도 안전). 갱신은 여기 POST 에서.
//   ⚠️ claim 과 달리 eviction/슬롯 로직 없음. **update-only**(행 없으면 무시) — 밀려난 기기가
//      하트비트로 슬롯을 재생성하지 않도록. 버전 수집 실패는 세션/앱 사용에 영향 없어야 함.
//
//   [v1 허용사항 — 문서화]
//   · user_id 는 verifyAuth 인증값(클라 입력 아님) → 타 계정 세션 절대 수정 불가.
//     (user_id, device_id) 는 유니크 인덱스(active_sessions_user_id_device_id_key)라 대상 행 최대 1개(중복 없음).
//   · 단 device_id 는 클라이언트 입력이라 "요청 보낸 실제 기기"와 서버에서 강결속(기기 서명 등)되진 않음.
//     → 같은 계정 내 다른(자기 소유) device_id 를 넣어 그 세션의 last_active/version 을 갱신하는 것은 가능.
//   · last_active 는 claim 의 last-login-wins eviction(가장 오래된 last_active 부터 제거) 기준이므로,
//     하트비트가 특정 기기 last_active 를 밀어올리면 eviction 순서에 영향 갈 수 있음.
//     → v1 수용(동일 계정·활성 기기 갱신은 정상에 가깝고 cross-user 위험 없음). 기기 강결속은 후속 과제.

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
