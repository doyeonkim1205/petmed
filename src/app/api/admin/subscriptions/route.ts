import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || '';
  const limit = 20;
  // 세 테이블(구독/결제/이벤트)은 서로 독립 데이터셋이라 각자 페이지 파라미터를 가진다.
  //   기존엔 단일 page 를 공유해서, 한 테이블 페이지를 넘기면 나머지도 같이 넘어가
  //   행 수가 다른 테이블이 빈 페이지로 빠지거나 도달 불가했음.
  //   (subPage 는 기존 page 파라미터와 호환 위해 page 도 fallback 으로 받음)
  const subPage = parseInt(searchParams.get('subPage') || searchParams.get('page') || '1');
  const payPage = parseInt(searchParams.get('payPage') || '1');
  const eventPage = parseInt(searchParams.get('eventPage') || '1');
  const subOffset = (subPage - 1) * limit;
  const payOffset = (payPage - 1) * limit;
  const eventOffset = (eventPage - 1) * limit;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let subQuery = supabase
    .from('subscriptions')
    .select('*', { count: 'exact' });

  if (status) {
    subQuery = subQuery.eq('status', status);
  }

  const { data: subscriptions, count } = await subQuery
    .order('created_at', { ascending: false })
    .range(subOffset, subOffset + limit - 1);

  const { data: payments, count: paymentCount } = await supabase
    .from('payment_history')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(payOffset, payOffset + limit - 1);

  const { data: events, count: eventCount } = await supabase
    .from('subscription_events')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(eventOffset, eventOffset + limit - 1);

  // Attach profile info (FK points to auth.users, not profiles)
  const allItems = [...(subscriptions || []), ...(payments || []), ...(events || [])];
  if (allItems.length > 0) {
    const userIds = [...new Set(allItems.map((item: any) => item.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, nickname')
      .in('id', userIds);
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    for (const item of allItems) {
      (item as any).profiles = profileMap.get(item.user_id) || null;
    }
  }

  // Event stats
  const { data: eventStats } = await supabase
    .from('subscription_events')
    .select('event_type');
  const eventTypeCounts: Record<string, number> = {};
  for (const e of eventStats || []) {
    eventTypeCounts[e.event_type] = (eventTypeCounts[e.event_type] || 0) + 1;
  }

  return NextResponse.json({
    subscriptions: subscriptions || [],
    subscriptionTotal: count || 0,
    subscriptionPages: Math.ceil((count || 0) / limit),
    subPage,
    payments: payments || [],
    paymentTotal: paymentCount || 0,
    paymentPages: Math.ceil((paymentCount || 0) / limit),
    payPage,
    events: events || [],
    eventTotal: eventCount || 0,
    eventPages: Math.ceil((eventCount || 0) / limit),
    eventPage,
    eventStats: eventTypeCounts,
    // 하위호환: 기존 UI 가 page/totalPages 를 읽던 것 (구독 기준)
    page: subPage,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
