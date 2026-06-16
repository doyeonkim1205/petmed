import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';

/**
 * 네이티브(Capacitor) 앱의 FCM 토큰 등록/해제.
 * web-push(push/subscribe)와 동일 정책: 유료 플랜만, 토큰 글로벌 유니크(기기 소유권 이전).
 */
export async function POST(request: Request) {
  const { user, error } = await verifyAuth(request);
  if (error) return error;

  const { token, platform } = await request.json();
  if (!token) {
    return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 유료 플랜만 알림 등록 (web-push 와 동일).
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user!.id)
    .single();
  const { getEffectivePlan } = await import('@/lib/plans');
  if (getEffectivePlan(profile?.plan) === 'free') {
    return NextResponse.json({ error: '유료 플랜 사용자만 알림을 등록할 수 있습니다.' }, { status: 403 });
  }

  // token 유니크 → upsert 시 user_id 갱신(소유권 이전).
  const { error: dbError } = await supabase.from('fcm_tokens').upsert(
    {
      user_id: user!.id,
      token,
      platform: platform || 'android',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { user, error } = await verifyAuth(request);
  if (error) return error;

  const { token } = await request.json();
  if (!token) {
    return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  await supabase.from('fcm_tokens').delete().eq('user_id', user!.id).eq('token', token);
  return NextResponse.json({ success: true });
}
