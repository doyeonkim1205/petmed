import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';

export async function POST(request: Request) {
  const { user, error } = await verifyAuth(request);
  if (error) return error;

  const { endpoint, keys_p256dh, keys_auth } = await request.json();
  if (!endpoint || !keys_p256dh || !keys_auth) {
    return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Only paid users can subscribe to push notifications
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user!.id)
    .single();

  const { getEffectivePlan } = await import('@/lib/plans');
  if (getEffectivePlan(profile?.plan) === 'free') {
    return NextResponse.json({ error: '유료 플랜 사용자만 알림을 등록할 수 있습니다.' }, { status: 403 });
  }

  // upsert_push_subscription RPC: endpoint 글로벌 유니크(20260424020000)에
  // ON CONFLICT upsert 하고 "신규 insert 여부"(xmax=0)를 원자적으로 반환.
  // 같은 기기에 다른 user 가 구독하면 user_id 덮어쓰기 → 기기 소유권 자동 이전
  // (이전 계정 알림이 새 계정 기기로 배달되는 문제 방지).
  // 자동 재구독(AuthContext)·재동기화 upsert 는 is_new=false → 로그 스킵.
  const { data: isNew, error: dbError } = await supabase.rpc('upsert_push_subscription', {
    p_user_id: user!.id,
    p_endpoint: endpoint,
    p_p256dh: keys_p256dh,
    p_auth: keys_auth,
  });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // 신규 구독일 때만 활동 로그 기록 (재동기화 upsert 는 노이즈라 남기지 않음).
  if (isNew) {
    await supabase.from('activity_logs').insert({
      user_id: user!.id,
      action: 'push.subscribe',
      resource_type: 'push',
      details: { endpoint: endpoint.slice(0, 50) },
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { user, error } = await verifyAuth(request);
  if (error) return error;

  const { endpoint } = await request.json();
  if (!endpoint) {
    return NextResponse.json({ error: '엔드포인트가 필요합니다.' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user!.id)
    .eq('endpoint', endpoint);

  // 구독 해제 기록
  await supabase.from('activity_logs').insert({
    user_id: user!.id,
    action: 'push.unsubscribe',
    resource_type: 'push',
    details: { endpoint: endpoint.slice(0, 50) },
  });

  return NextResponse.json({ success: true });
}
