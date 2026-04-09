import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';
import { cancelPayment } from '@/lib/toss';

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

    let refundedAmount: number | null = null;

    // Handle refund if requested
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
        const isYearly = subscription.product_id?.includes('yearly');

        if (isYearly && hoursSincePayment <= 24) {
          // Yearly 24h: full refund
          await cancelPayment(payment.toss_payment_key, '사용자 환불 요청 (연간, 24시간 이내)');
          refundedAmount = payment.amount;
        } else if (isYearly && hoursSincePayment > 24) {
          // Yearly after 24h: proportional refund
          const startDate = new Date(subscription.period_start || payment.created_at);
          const now = new Date();
          const monthsUsed = Math.ceil(
            (now.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
          );
          const remainingMonths = Math.max(0, 12 - monthsUsed);
          const refundAmount = Math.round(payment.amount * (remainingMonths / 12));

          if (refundAmount > 0) {
            await cancelPayment(payment.toss_payment_key, `사용자 환불 요청 (연간, ${monthsUsed}개월 사용, ${remainingMonths}개월분 환불)`);
            refundedAmount = refundAmount;
          }
        } else if (!isYearly && hoursSincePayment <= 24) {
          // Monthly 24h: check usage then full refund
          const paymentDate = payment.created_at;
          const { count: usage } = await supabaseAdmin
            .from('activity_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .in('action', ['symptom.search', 'symptom.refine', 'analysis.save'])
            .gte('created_at', paymentDate);

          const { count: records } = await supabaseAdmin
            .from('health_records')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', paymentDate);

          if ((usage || 0) + (records || 0) === 0) {
            await cancelPayment(payment.toss_payment_key, '사용자 환불 요청 (월간, 24시간 이내, 미이용)');
            refundedAmount = payment.amount;
          }
        }

        if (refundedAmount !== null) {
          await supabaseAdmin
            .from('payment_history')
            .update({ status: 'refunded' })
            .eq('id', payment.id);
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

    // If refunded, downgrade immediately
    if (refundedAmount !== null) {
      updateData.status = 'canceled';
      await supabaseAdmin.from('profiles').update({ plan: 'free' }).eq('id', userId);
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
    const message = error instanceof Error ? error.message : '구독 해지에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
