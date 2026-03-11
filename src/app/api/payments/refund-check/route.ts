import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
    // Get active subscription
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!subscription) {
      return NextResponse.json({ refundable: false, reason: '활성 구독이 없습니다.' });
    }

    // Get latest payment
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

    // Check 24-hour window
    const paymentTime = new Date(payment.created_at).getTime();
    const now = Date.now();
    const hoursSincePayment = (now - paymentTime) / (1000 * 60 * 60);

    if (hoursSincePayment > 24) {
      return NextResponse.json({ refundable: false, reason: '결제 후 24시간이 경과했습니다.' });
    }

    // Check paid feature usage
    const paymentDate = payment.created_at;

    const { count: analysisCount } = await supabaseAdmin
      .from('saved_analyses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', paymentDate);

    const { count: recordCount } = await supabaseAdmin
      .from('health_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', paymentDate);

    const { count: paidUsageCount } = await supabaseAdmin
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('action', ['symptom.search', 'symptom.refine', 'analysis.save'])
      .gte('created_at', paymentDate);

    const { count: searchCount } = await supabaseAdmin
      .from('search_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', paymentDate);

    const totalUsage = (analysisCount || 0) + (recordCount || 0) + (paidUsageCount || 0) + (searchCount || 0);

    if (totalUsage > 0) {
      return NextResponse.json({ refundable: false, reason: '유료 서비스를 이용한 이력이 있습니다.' });
    }

    const remainingHours = Math.floor(24 - hoursSincePayment);

    return NextResponse.json({
      refundable: true,
      amount: payment.amount,
      remainingHours,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '확인에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
