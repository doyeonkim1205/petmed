import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel Cron sends this header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();

    // Find expired subscriptions (active or canceled, past period_end)
    const { data: expired } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id, plan')
      .in('status', ['active', 'canceled'])
      .lt('period_end', now);

    if (!expired || expired.length === 0) {
      return NextResponse.json({ message: 'No expired subscriptions', count: 0 });
    }

    const userIds = expired.map(s => s.user_id);

    // Update subscriptions to expired
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'expired', updated_at: now })
      .in('user_id', userIds)
      .in('status', ['active', 'canceled']);

    // Downgrade profiles to free
    await supabaseAdmin
      .from('profiles')
      .update({ plan: 'free' })
      .in('id', userIds);

    // Log activity and subscription events for each user
    const { logActivity } = await import('@/lib/activityLog');
    const { logSubscriptionEvent } = await import('@/lib/subscriptionEvents');
    for (const sub of expired) {
      logActivity(sub.user_id, 'subscription.expired', {
        details: { previousPlan: sub.plan },
      });
      await logSubscriptionEvent(sub.user_id, 'expired', sub.plan, undefined, '구독 기간 만료');
    }

    return NextResponse.json({
      message: `Expired ${expired.length} subscriptions`,
      count: expired.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
