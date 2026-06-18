import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import webpush from 'web-push';
import { chargeBilling, classifyBillingError, type TossBillingError } from '@/lib/toss-billing';
import { getProductById } from '@/lib/products';
import { decrypt } from '@/lib/encryption';
import { logActivityServer } from '@/lib/activityLogServer';
import { disableAlarmsOnDowngrade } from '@/lib/disableAlarmsOnDowngrade';
import { secureEqual } from '@/lib/secureCompare';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// How long is one billing cycle for monthly recurring subs?
const MONTHLY_CYCLE_DAYS = 30;

// Retry schedule (in days) after each consecutive failure.
// failure #1 → wait 1d, failure #2 → wait 3d, failure #3 → wait 7d.
// failure #4 → no more retries, mark expired.
const RETRY_DELAYS_DAYS = [1, 3, 7];
const MAX_RETRY_ATTEMPTS = RETRY_DELAYS_DAYS.length; // 3 retries → expire on 4th failure

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
  if (!secureEqual(authHeader, `Bearer ${process.env.CRON_SECRET}`)) {
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
    Sentry.captureException(fetchErr, {
      tags: { feature: 'cron', action: 'auto-billing-fetch' },
    });
    console.error('auto-billing: failed to fetch due subscriptions', fetchErr);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }

  for (const sub of (due as DueSubscription[]) || []) {
    processed++;

    if (!sub.toss_billing_key || !sub.toss_customer_key || !sub.product_id) {
      console.warn('auto-billing: subscription missing billing fields', sub.id);
      continue;
    }

    // Decrypt billing key (stored encrypted in DB)
    const billingKey = decrypt(sub.toss_billing_key) || sub.toss_billing_key;

    const product = await getProductById(sub.product_id);
    if (!product) {
      console.warn('auto-billing: product not found for subscription', sub.id, sub.product_id);
      continue;
    }

    const orderId = `pawdex_${sub.user_id.slice(0, 8)}_${product.id}_${Date.now()}`;

    try {
      const charged = await chargeBilling({
        billingKey,
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
      const { userMessage, retryable } = classifyBillingError(e.code);
      Sentry.captureException(e, {
        tags: { feature: 'cron', action: 'auto-billing-charge' },
        extra: {
          subscriptionId: sub.id,
          userId: sub.user_id,
          errorCode: e.code,
          attempt: (sub.billing_failed_count || 0) + 1,
          retryable,
        },
      });
      console.error('auto-billing: charge failed', sub.id, e.code, e.message);

      const newFailedCount = (sub.billing_failed_count || 0) + 1;
      const reasonSummary = `${e.code || 'UNKNOWN'}: ${userMessage}`;

      // Decide: retry, or expire?
      // - Non-retryable errors (lost/stolen, expired card, bad number) → expire immediately
      // - Retryable errors but reached max attempts → expire
      // - Otherwise → schedule next retry
      const shouldExpire = !retryable || newFailedCount > MAX_RETRY_ATTEMPTS;

      if (shouldExpire) {
        // Final: expire the subscription, downgrade profile to free
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'expired',
            billing_failed_count: newFailedCount,
            last_billing_failure_at: now.toISOString(),
            last_billing_failure_reason: reasonSummary,
            next_billing_at: null,
            updated_at: now.toISOString(),
          })
          .eq('id', sub.id);

        await supabaseAdmin
          .from('profiles')
          .update({ plan: 'free' })
          .eq('id', sub.user_id);

        // 무료 전환 → 약 알림·푸시 OFF 정리
        await disableAlarmsOnDowngrade(supabaseAdmin, sub.user_id);

        const { logActivity } = await import('@/lib/activityLog');
        logActivity(sub.user_id, 'subscription.expired', {
          details: { reason: 'billing_failed', code: e.code, attempts: newFailedCount },
        });

        const { logSubscriptionEvent } = await import('@/lib/subscriptionEvents');
        await logSubscriptionEvent(
          sub.user_id,
          'expired',
          sub.plan,
          undefined,
          `자동 결제 실패로 만료: ${userMessage}`,
        );

        // Send push notification — final failure, action required.
        // category 'subscription' → sw.js 에서 오른쪽 alarm.webp 아이콘 분기.
        // 횟수 변수 (newFailedCount) 는 실제 1차+3 retry = 4회 시점이라
        // 사용자 직관과 차이가 있어 "여러 번"으로 일반화.
        await sendBillingFailurePush(sub.user_id, {
          title: '🚫 정기 구독 자동 종료',
          body: '결제가 여러 번 거절되어 무료 플랜으로 전환되었습니다. 언제든 다시 Plus 구독을 시작하실 수 있습니다.',
          url: '/profile/subscription',
          category: 'subscription',
        });
      } else {
        // Schedule next retry based on attempt count
        const delayDays = RETRY_DELAYS_DAYS[newFailedCount - 1] ?? RETRY_DELAYS_DAYS.at(-1)!;
        const retryAt = new Date(now.getTime() + delayDays * 24 * 60 * 60 * 1000);

        await supabaseAdmin
          .from('subscriptions')
          .update({
            billing_failed_count: newFailedCount,
            last_billing_failure_at: now.toISOString(),
            last_billing_failure_reason: reasonSummary,
            next_billing_at: retryAt.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', sub.id);

        const { logActivity } = await import('@/lib/activityLog');
        logActivity(sub.user_id, 'subscription.billing_failed', {
          details: { code: e.code, attempt: newFailedCount, retryInDays: delayDays },
        });

        // Notify user of failure + retry.
        // category 'subscription' → sw.js 에서 오른쪽 alarm.webp 아이콘 분기.
        // delayDays 는 RETRY_DELAYS_DAYS[newFailedCount-1] (1/3/7). 사유 텍스트는
        // 잠금화면 길이 부담이 커서 push body 에선 생략 — 상세는 결제 페이지에서 확인.
        await sendBillingFailurePush(sub.user_id, {
          title: '💳 정기 결제 승인 실패',
          body: `카드 거절 등의 사유로 결제가 승인되지 않았습니다. ${delayDays}일 뒤 재시도 예정이니 결제 수단을 점검해 주세요.`,
          url: '/profile/subscription',
          category: 'subscription',
        });
      }

      failures.push({ userId: sub.user_id, reason: userMessage });
      failed++;
    }
  }

  await logActivityServer(null, 'cron.auto_billing', {
    details: { processed, succeeded, failed, time: now.toISOString() },
  });

  return NextResponse.json({
    time: now.toISOString(),
    processed,
    succeeded,
    failed,
    failures,
  });
}

// Send a push notification to all of a user's registered devices.
// Mirrors sendPushToUser in push-notifications/route.ts.
let vapidConfigured = false;
async function sendBillingFailurePush(
  userId: string,
  notification: { title: string; body: string; url: string; category?: string },
) {
  if (!vapidConfigured) {
    try {
      webpush.setVapidDetails(
        'mailto:dylabs.pawdex@gmail.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!,
      );
      vapidConfigured = true;
    } catch (e) {
      console.error('VAPID setup failed', e);
      return;
    }
  }

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  const payload = JSON.stringify(notification);
  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        payload,
      );
    } catch {
      await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
    }
  }
}
