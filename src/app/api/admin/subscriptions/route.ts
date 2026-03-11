import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

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
    .range(offset, offset + limit - 1);

  const { data: payments, count: paymentCount } = await supabase
    .from('payment_history')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: events, count: eventCount } = await supabase
    .from('subscription_events')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

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
    payments: payments || [],
    paymentTotal: paymentCount || 0,
    events: events || [],
    eventTotal: eventCount || 0,
    eventStats: eventTypeCounts,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
