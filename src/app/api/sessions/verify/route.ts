import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET: 현재 기기(X-Device-Id)가 아직 active_sessions 에 등록돼 있는지만 확인.
 *
 * 읽기 전용 — 절대 등록/갱신/evict 하지 않는다 (claim 과 분리, 핑퐁 방지).
 * 밀려난 경우 403 session_evicted 를 반환 → authFetch 가 자동 로그아웃 + 리다이렉트.
 *
 * 인증 검증만 verifyAuth(skipDeviceCheck) 로 하고, 기기 판정은 여기서 직접
 * (단순 존재 여부 SELECT) 처리한다. verifyAuth 의 기기체크 경로는 heartbeat·
 * 자동등록 side-effect 가 있어 verify 의 "무변경" 원칙과 맞지 않으므로 쓰지 않음.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request, { skipDeviceCheck: true });
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  const deviceId = request.headers.get('x-device-id');
  if (!deviceId) {
    // 기기 ID 없는 클라(구버전 등) — 판정 보류, 통과시킴(로그아웃 X).
    return NextResponse.json({ valid: true, reason: 'no_device_id' });
  }

  const { data } = await supabaseAdmin
    .from('active_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle();

  if (!data) {
    return NextResponse.json(
      { error: 'session_evicted', valid: false, reason: 'device_evicted' },
      { status: 403 },
    );
  }

  return NextResponse.json({ valid: true });
}
