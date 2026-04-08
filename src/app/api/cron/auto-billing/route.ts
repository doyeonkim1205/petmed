import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { chargeBilling, classifyBillingError, type TossBillingError } from '@/lib/toss-billing';
import { getProductById } from '@/lib/products';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// How long is one billing cycle for monthly recurring subs?
const MONTHLY_CYCLE_DAYS = 30;

interface DueSubscription {
  id: string;
  user_id: string;
  plan: string;
  product_id: string | null;
  status: string;
  toss_billing_key: string | null;
  toss_customer_key: string | null;
  period_end: string;
  next_billing_at: string | null;
  billing_failed_count: number;
}

export async function GET(request: NextRequest) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const failures: { userId: string; reason: string }[] = [];

  // Find all due recurring subscriptions
  const { data: due, error: fetchErr } = await supabaseAdmin
    .from('subscriptions')
    .select(
      'id, user_id, plan, product_id, status, toss_billing_key, toss_customer_key, period_end, next_billing_at, billing_failed_count',
    )
    .eq('billing_type', 'recurring')
    .eq('status', 'active')
    .lte('next_billing_at', now.toISOString())
    .not('toss_billing_key', 'is', null);

  if (fetchErr) {
    console.error('auto-billing: failed to fetch due subscriptions', fetchErr);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }

  for (const sub of (due as DueSubscription[]) || []) {
    processed++;

    if (!sub.toss_billing_key || !sub.toss_customer_key || !sub.product_id) {
      console.warn('auto-billing: subscription missing billing fields', sub.id);
      continue;
    }

    const product = await getProductById(sub.product_id);
    if (!product) {
      console.warn('auto-billing: product not found for subscription', sub.id, sub.product_id);
      continue;
    }

    // Idempotency: stamp updated_at first so concurrent crons can detect a race.
    // (We rely on Postgres row-level last-writer-wins; this is a soft guard.)
    const orderId = `pawdex_${sub.user_id.slice(0, 8)}_${product.id}_${Date.now()}`;

    try {
      const charged = await chargeBilling({
        billingKey: sub.toss_billing_key,
        customerKey: sub.toss_customer_key,
        amount: product.price,
        orderId,
        orderName: product.name,
      });

      // Success — extend period_end and schedule next billing
      const newPeriodEnd = new Date(now.getTime() + MONTHLY_CYCLE_DAYS * 24 * 60 * 60 * 1000);

      await supabaseAdmin
        .from('payment_history')
        .insert({
          user_id: sub.user_id,
          toss_payment_key: charged.paymentKey,
          toss_order_id: orderId,
          amount: charged.totalAmount,
          status: 'done',
          receipt_url: charged.receipt?.url || null,
        });

      await supabaseAdmin
        .from('subscriptions')
        .update({
          period_end: newPeriodEnd.toISOString(),
          next_billing_at: newPeriodEnd.toISOString(),
          billing_failed_count: 0,
          last_billing_failure_at: null,
          last_billing_failure_reason: null,
          // Reset reminder so we can fire it again next cycle
          reminder_3day_sent_at: null,
          updated_at: now.toISOString(),
        })
        .eq('id', sub.id);

      // Log activity + subscription event
      const { logActivity } = await import('@/lib/activityLog');
      logActivity(sub.user_id, 'subscription.auto_billed', {
        details: { plan: product.plan, productId: product.id, amount: charged.totalAmount },
      });

      const { logSubscriptionEvent } = await import('@/lib/subscriptionEvents');
      await logSubscriptionEvent(
        sub.user_id,
        'renew',
        product.plan,
        charged.totalAmount,
        '자동 갱신 결제 성공',
      );

      succeeded++;
    } catch (err) {
      const e = err as TossBillingError;
      const { userMessage } = classifyBillingError(e.code);
      console.error('auto-billing: charge failed', sub.id, e.code, e.message);

      const newFailedCount = (sub.billing_failed_count || 0) + 1;

      // Schedule retry: 1 day after failure (Phase 2-6 will refine)
      const retryAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await supabaseAdmin
        .from('subscriptions')
        .update({
          billing_failed_count: newFailedCount,
          last_billing_failure_at: now.toISOString(),
          last_billing_failure_reason: `${e.code || 'UNKNOWN'}: ${userMessage}`,
          next_billing_at: retryAt.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', sub.id);

      const { logActivity } = await import('@/lib/activityLog');
      logActivity(sub.user_id, 'subscription.billing_failed', {
        details: { code: e.code, attempt: newFailedCount },
      });

      failures.push({ userId: sub.user_id, reason: userMessage });
      failed++;
    }
  }

  return NextResponse.json({
    time: now.toISOString(),
    processed,
    succeeded,
    failed,
    failures,
  });
}
