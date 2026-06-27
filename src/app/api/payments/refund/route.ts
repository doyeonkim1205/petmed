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
    // 1. Get active subscription
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!subscription) {
      return NextResponse.json({ error: '활성 구독이 없습니다.' }, { status: 404 });
    }

    // Play(앱) 구독은 Google Play 환불 절차만 가능 — 토스 환불 경로로 처리하지 않는다(방어심층).
    if (subscription.store === 'play') {
      return NextResponse.json(
        { error: 'Google Play 구독은 Google Play 에서 환불을 요청해 주세요.' },
        { status: 400 },
      );
    }

    // 2. Check if within 24 hours of payment
    const { data: payment } = await supabaseAdmin
      .from('payment_history')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!payment) {
      return NextResponse.json({ error: '결제 내역이 없습니다.' }, { status: 404 });
    }

    const paymentTime = new Date(payment.created_at).getTime();
    const now = Date.now();
    const hoursSincePayment = (now - paymentTime) / (1000 * 60 * 60);

    if (hoursSincePayment > 24) {
      return NextResponse.json({
        error: '결제 후 24시간이 경과하여 환불이 불가합니다. 구독 해지는 가능합니다.',
        refundable: false,
      }, { status: 400 });
    }

    // 3. Check if user has used any paid features since payment
    const paymentDate = payment.created_at;

    // Check AI analysis saves
    const { count: analysisCount } = await supabaseAdmin
      .from('saved_analyses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', paymentDate);

    // Check health records
    const { count: recordCount } = await supabaseAdmin
      .from('health_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', paymentDate);

    // Check symptom searches and AI analysis usage from activity logs
    const { count: paidUsageCount } = await supabaseAdmin
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', 'analysis.save')
      .gte('created_at', paymentDate);

    // Check search logs
    const { count: searchCount } = await supabaseAdmin
      .from('search_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', paymentDate);

    const totalUsage = (analysisCount || 0) + (recordCount || 0) + (paidUsageCount || 0) + (searchCount || 0);

    if (totalUsage > 0) {
      return NextResponse.json({
        error: '유료 서비스를 이용한 이력이 있어 환불이 불가합니다. 구독 해지는 가능합니다.',
        refundable: false,
      }, { status: 400 });
    }

    // 4. Process refund via Toss — 구독 billing_type 으로 키 추정 + 불일치 시 자동 재시도.
    await cancelPaymentAutoKey(
      payment.toss_payment_key,
      '사용자 환불 요청 (24시간 이내, 미이용)',
      subscription.billing_type === 'recurring',
    );

    // 5. Update payment history
    await supabaseAdmin
      .from('payment_history')
      .update({ status: 'refunded' })
      .eq('id', payment.id);

    // 6. Update subscription
    await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'active');

    // 7. Downgrade to free plan immediately
    await supabaseAdmin
      .from('profiles')
      .update({ plan: 'free' })
      .eq('id', userId);

    // 무료 전환 → 약 알림·푸시 OFF 정리
    await disableAlarmsOnDowngrade(supabaseAdmin, userId);

    // 8. Log activity
    const { logActivityServer } = await import('@/lib/activityLogServer');
    await logActivityServer(userId, 'subscription.refund', {
      details: { plan: subscription.plan, amount: payment.amount },
    });

    const { logSubscriptionEvent } = await import('@/lib/subscriptionEvents');
    await logSubscriptionEvent(userId, 'refund', subscription.plan, payment.amount, '24시간 이내 환불 (미이용)');

    return NextResponse.json({
      success: true,
      message: '환불이 완료되었습니다. 결제 수단으로 환불 금액이 반영됩니다.',
      refundedAmount: payment.amount,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'payment', action: 'refund' },
      extra: { userId },
    });
    const message = error instanceof Error ? error.message : '환불 처리에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
