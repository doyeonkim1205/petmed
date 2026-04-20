import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { verifyAuth } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  try {
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!subscription) {
      return NextResponse.json({ refundable: false, reason: '활성 구독이 없습니다.' });
    }

    const { data: payment } = await supabaseAdmin
      .from('payment_history')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!payment) {
      return NextResponse.json({ refundable: false, reason: '결제 내역이 없습니다.' });
    }

    const paymentTime = new Date(payment.created_at).getTime();
    const now = Date.now();
    const hoursSincePayment = (now - paymentTime) / 3600000;
    const isYearly = subscription.product_id?.includes('yearly');

    // === Monthly refund: 24h + no usage ===
    if (!isYearly) {
      if (hoursSincePayment > 24) {
        return NextResponse.json({ refundable: false, reason: '결제 후 24시간이 경과했습니다.' });
      }

      // Check usage
      const paymentDate = payment.created_at;
      const [{ count: a }, { count: r }, { count: u }, { count: s }] = await Promise.all([
        supabaseAdmin.from('saved_analyses').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', paymentDate),
        supabaseAdmin.from('health_records').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', paymentDate),
        supabaseAdmin.from('activity_logs').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('action', ['symptom.search', 'symptom.refine', 'analysis.save']).gte('created_at', paymentDate),
        supabaseAdmin.from('search_logs').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', paymentDate),
      ]);

      if ((a || 0) + (r || 0) + (u || 0) + (s || 0) > 0) {
        return NextResponse.json({ refundable: false, reason: '유료 서비스를 이용한 이력이 있습니다.' });
      }

      return NextResponse.json({
        refundable: true,
        amount: payment.amount,
        remainingHours: Math.floor(24 - hoursSincePayment),
      });
    }

    // === Yearly refund ===
    // 24h + no usage → full refund
    if (hoursSincePayment <= 24) {
      const paymentDate = payment.created_at;
      const [{ count: a }, { count: r }, { count: u }, { count: s }] = await Promise.all([
        supabaseAdmin.from('saved_analyses').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', paymentDate),
        supabaseAdmin.from('health_records').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', paymentDate),
        supabaseAdmin.from('activity_logs').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('action', ['symptom.search', 'symptom.refine', 'analysis.save']).gte('created_at', paymentDate),
        supabaseAdmin.from('search_logs').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', paymentDate),
      ]);

      if ((a || 0) + (r || 0) + (u || 0) + (s || 0) === 0) {
        return NextResponse.json({
          refundable: true,
          amount: payment.amount,
          remainingHours: Math.floor(24 - hoursSincePayment),
        });
      }
    }

    // After 24h or with usage → proportional refund
    const startDate = new Date(subscription.period_start || payment.created_at);
    const monthsUsed = Math.ceil((now - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
    const remainingMonths = Math.max(0, 12 - monthsUsed);
    const refundAmount = Math.round(payment.amount * (remainingMonths / 12));

    if (refundAmount <= 0) {
      return NextResponse.json({ refundable: false, reason: '남은 이용 기간이 없어 환불이 불가합니다.' });
    }

    return NextResponse.json({
      refundable: true,
      amount: refundAmount,
      reason: `${monthsUsed}개월 사용, ${remainingMonths}개월분 환불`,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'payment', action: 'refund-check' },
      extra: { userId },
    });
    const message = error instanceof Error ? error.message : '확인에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
