import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { verifyAuth } from '@/lib/apiAuth';
import { cancelPaymentAutoKey } from '@/lib/toss';
import { disableAlarmsOnDowngrade } from '@/lib/disableAlarmsOnDowngrade';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  try {
    const body = await request.json().catch(() => ({}));
    const cancelReason = body.reason || '';
    const withRefund = body.withRefund === true;

    // Get current subscription
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!subscription) {
      return NextResponse.json({ error: '활성 구독이 없습니다.' }, { status: 404 });
    }

    // Play(앱) 구독은 Google Play 에서만 해지·환불 가능. 토스 해지 경로로 처리하지 않는다.
    // (UI 에서도 막혀 있지만 서버 방어심층 — 잘못된 호출은 명확히 거부)
    if (subscription.store === 'play') {
      return NextResponse.json(
        { error: 'Google Play 구독은 Google Play 구독 관리에서 해지·환불해 주세요.' },
        { status: 400 },
      );
    }

    let refundedAmount: number | null = null;
    // Use billing secret key if the subscription was paid via billing (bill) service
    const useBillingKey = subscription.billing_type === 'recurring';

    // Handle refund if requested. If refund fails, cancel is BLOCKED (user keeps subscription).
    // 모든 plan 통일: 24시간 + 미사용 만 환불. yearly 비율 환불 로직 제거 (정책과 일치).
    if (withRefund) {
      const { data: payment } = await supabaseAdmin
        .from('payment_history')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (payment) {
        const hoursSincePayment = (Date.now() - new Date(payment.created_at).getTime()) / 3600000;

        if (hoursSincePayment <= 24) {
          // refund-check 와 동일한 4가지 사용 이력 체크
          const paymentDate = payment.created_at;
          const [{ count: a }, { count: r }, { count: u }, { count: s }] = await Promise.all([
            supabaseAdmin.from('saved_analyses').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', paymentDate),
            supabaseAdmin.from('health_records').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', paymentDate),
            supabaseAdmin.from('activity_logs').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('action', 'analysis.save').gte('created_at', paymentDate),
            supabaseAdmin.from('search_logs').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', paymentDate),
          ]);

          if ((a || 0) + (r || 0) + (u || 0) + (s || 0) === 0) {
            await cancelPaymentAutoKey(payment.toss_payment_key, '사용자 환불 요청 (24시간 이내, 미이용)', useBillingKey);
            refundedAmount = payment.amount;
          }
        }

        if (refundedAmount !== null) {
          await supabaseAdmin.from('payment_history').update({ status: 'refunded' }).eq('id', payment.id);
        }
      }
    }

    // Cancel subscription + clear billing if recurring
    const updateData: Record<string, unknown> = {
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // If recurring, also disable auto-billing
    if (subscription.billing_type === 'recurring') {
      updateData.billing_type = 'one_time';
      updateData.toss_billing_key = null;
      updateData.next_billing_at = null;
    }

    // If refunded, expire immediately (not just canceled)
    // Canceled = still has access until period_end
    // Expired = no access, no subscription info shown
    if (refundedAmount !== null) {
      updateData.status = 'expired';
      await supabaseAdmin.from('profiles').update({ plan: 'free' }).eq('id', userId);
      await disableAlarmsOnDowngrade(supabaseAdmin, userId);
    }

    await supabaseAdmin
      .from('subscriptions')
      .update(updateData)
      .eq('user_id', userId)
      .eq('status', 'active');

    const { logActivity } = await import('@/lib/activityLog');
    logActivity(userId, 'subscription.cancel', {
      details: { plan: subscription.plan, refunded: refundedAmount, reason: cancelReason },
    });

    const { logSubscriptionEvent } = await import('@/lib/subscriptionEvents');
    await logSubscriptionEvent(
      userId,
      refundedAmount ? 'refund' : 'cancel',
      subscription.plan,
      refundedAmount || undefined,
      cancelReason || '사용자 해지 요청',
    );

    const periodEndStr = new Date(subscription.period_end).toLocaleDateString('ko-KR');
    let message = `구독이 해지되었습니다. ${periodEndStr}까지 이용 가능합니다.`;
    if (subscription.billing_type === 'recurring') {
      message += ' 자동 결제가 중지되었습니다.';
    }
    if (refundedAmount !== null) {
      message = `${refundedAmount.toLocaleString()}원이 환불되었습니다. 카드사에 따라 반영에 3~10영업일이 소요될 수 있습니다.`;
    }

    return NextResponse.json({
      success: true,
      message,
      periodEnd: subscription.period_end,
      refundedAmount,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'payment', action: 'cancel' },
      extra: { userId },
    });
    const message = error instanceof Error ? error.message : '구독 해지에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
