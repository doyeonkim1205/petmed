import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { logActivityServer } from '@/lib/activityLogServer';
import { disableAlarmsOnDowngrade } from '@/lib/disableAlarmsOnDowngrade';
import { secureEqual } from '@/lib/secureCompare';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel Cron sends this header)
  const authHeader = request.headers.get('authorization');
  if (!secureEqual(authHeader, `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();

    // Find expired subscriptions (active or canceled, past period_end).
    // ⚠️ Play(앱) 구독은 제외 — 만료/갱신 판정은 RevenueCat 웹훅(EXPIRATION/RENEWAL)이 진실원.
    //    period_end 만 보고 강등하면 갱신 웹훅 지연 시 유효 구독을 조기 강등할 위험.
    const { data: expired } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id, plan')
      .in('status', ['active', 'canceled'])
      .lt('period_end', now)
      .neq('store', 'play');

    if (!expired || expired.length === 0) {
      await logActivityServer(null, 'cron.expire_subscriptions', {
        details: { count: 0, result: 'no_expired' },
      });
      return NextResponse.json({ message: 'No expired subscriptions', count: 0 });
    }

    const userIds = expired.map(s => s.user_id);

    // Update subscriptions to expired (Play 제외 — 위 select 와 동일 가드)
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'expired', updated_at: now })
      .in('user_id', userIds)
      .in('status', ['active', 'canceled'])
      .neq('store', 'play');

    // Downgrade profiles to free
    await supabaseAdmin
      .from('profiles')
      .update({ plan: 'free' })
      .in('id', userIds);

    // 무료 전환 → 약 알림·푸시 OFF 정리 (UI 정직성)
    await disableAlarmsOnDowngrade(supabaseAdmin, userIds);

    // Log activity and subscription events for each user
    const { logSubscriptionEvent } = await import('@/lib/subscriptionEvents');
    for (const sub of expired) {
      await logActivityServer(sub.user_id, 'subscription.expired', {
        details: { previousPlan: sub.plan },
      });
      await logSubscriptionEvent(sub.user_id, 'expired', sub.plan, undefined, '구독 기간 만료');
    }

    await logActivityServer(null, 'cron.expire_subscriptions', {
      details: { count: expired.length, result: 'success' },
    });

    return NextResponse.json({
      message: `Expired ${expired.length} subscriptions`,
      count: expired.length,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'cron', action: 'expire-subscriptions' },
    });
    await logActivityServer(null, 'cron.expire_subscriptions', {
      details: {
        result: 'error',
        error: error instanceof Error ? error.message : String(error),
      },
    });
    const message = error instanceof Error ? error.message : 'Failed to process';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
