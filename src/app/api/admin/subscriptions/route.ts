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

  // 결제 실패 큐 — 자동 결제 실패 이력이 있는 구독 (billing_failed_count >= 1).
  //   auto-billing cron 이 재시도하지만 운영자 가시성이 없어 별도 노출. 보통 소수라 비페이지네이션.
  const { data: failedBillings } = await supabase
    .from('subscriptions')
    .select('user_id, plan, status, billing_type, billing_failed_count, next_billing_at, card_company')
    .gte('billing_failed_count', 1)
    .order('billing_failed_count', { ascending: false });

  // Attach profile info (FK points to auth.users, not profiles)
  const allItems = [...(subscriptions || []), ...(payments || []), ...(events || []), ...(failedBillings || [])];
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

  // 현재 Plus 이용자 플랫폼 분포 — "자동갱신(active)" + "해지했지만 기간 남음(canceled & 미래)"
  //   을 모두 포함하고 distinct user_id 로 센다. status='active' 만 세면 해지예정 유저가
  //   빠져 Plus 이용자 수와 플랫폼 합계가 어긋남.
  //   유저가 여러 구독 행을 가지면 가장 늦은 period_end(현재 유효 구독)의 store 로 귀속.
  const nowIso = new Date().toISOString();
  const storeToPlatform = (store: string | null): 'ios' | 'android' | 'web' | null => {
    if (store === 'apple') return 'ios';
    if (store === 'play' || store === 'play_store') return 'android';
    if (store === 'toss') return 'web';
    return null;
  };
  const { data: liveRows } = await supabase
    .from('subscriptions')
    .select('user_id, store, status, period_end, canceled_at')
    .order('period_end', { ascending: false }); // 가장 늦은 만료일 먼저
  const userPlatform = new Map<string, 'ios' | 'android' | 'web'>();
  const autoRenewSet = new Set<string>();
  const cancelingSet = new Set<string>();
  for (const r of (liveRows || []) as { user_id: string; store: string | null; status: string; period_end: string | null; canceled_at: string | null }[]) {
    const inPeriod = !!r.period_end && r.period_end > nowIso;
    if (!inPeriod) continue; // 만료/완전해지는 제외
    // 스토어(구글/애플) 해지는 status='active'+canceled_at 라 canceled_at 도 봐야 함(stats route 와 동일 기준).
    const isCanceled = r.status === 'canceled' || !!r.canceled_at;
    if (isCanceled) cancelingSet.add(r.user_id);
    else if (r.status === 'active') autoRenewSet.add(r.user_id);
    else continue; // active/canceled 아닌 기타 상태는 집계·플랫폼 카운트에서 제외
    if (!userPlatform.has(r.user_id)) {
      const p = storeToPlatform(r.store);
      if (p) userPlatform.set(r.user_id, p);
    }
  }
  const platformCounts = { ios: 0, android: 0, web: 0 };
  for (const p of userPlatform.values()) platformCounts[p]++;
  const autoRenewing = autoRenewSet.size;
  const canceling = cancelingSet.size;

  return NextResponse.json({
    subscriptions: subscriptions || [],
    platformCounts,
    autoRenewing,
    canceling,
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
    failedBillings: failedBillings || [],
    // 하위호환: 기존 UI 가 page/totalPages 를 읽던 것 (구독 기준)
    page: subPage,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
