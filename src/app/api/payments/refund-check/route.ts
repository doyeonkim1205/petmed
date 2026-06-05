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

    // === 모든 plan 통일: 24시간 + 미사용 만 환불. 24시간 경과 또는 사용 이력 = 환불 불가. ===
    // (이전 yearly 비율 환불 로직 제거 — 정책 문서와 일치)

    if (hoursSincePayment > 24) {
      return NextResponse.json({ refundable: false, reason: '결제 후 24시간이 경과했습니다.' });
    }

    // Check usage
    const paymentDate = payment.created_at;
    const [{ count: a }, { count: r }, { count: u }, { count: s }] = await Promise.all([
      supabaseAdmin.from('saved_analyses').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', paymentDate),
      supabaseAdmin.from('health_records').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', paymentDate),
      supabaseAdmin.from('activity_logs').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('action', 'analysis.save').gte('created_at', paymentDate),
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
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'payment', action: 'refund-check' },
      extra: { userId },
    });
    const message = error instanceof Error ? error.message : '확인에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
