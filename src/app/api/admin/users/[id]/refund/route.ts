import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { verifyAdmin } from '@/lib/adminAuth';
import { cancelPaymentAutoKey } from '@/lib/toss';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const { id: userId } = await params;
  const { paymentId } = await request.json();

  try {
    const { data: payment } = await supabaseAdmin
      .from('payment_history')
      .select('*')
      .eq('id', paymentId)
      .eq('user_id', userId)
      .eq('status', 'done')
      .single();

    if (!payment) {
      return NextResponse.json({ error: '환불 가능한 결제를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Check if billing payment (need billing secret key)
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('billing_type')
      .eq('user_id', userId)
      .maybeSingle();
    const useBillingKey = sub?.billing_type === 'recurring';

    // 키 불일치(one_time↔recurring 전환 이력) 대비 자동 키 재시도.
    await cancelPaymentAutoKey(payment.toss_payment_key, '관리자 환불 처리', useBillingKey);

    await supabaseAdmin.from('payment_history').update({ status: 'refunded' }).eq('id', paymentId);
    await supabaseAdmin.from('subscriptions').update({
      status: 'expired', updated_at: new Date().toISOString(),
    }).eq('user_id', userId).in('status', ['active', 'canceled']);
    await supabaseAdmin.from('profiles').update({ plan: 'free' }).eq('id', userId);

    return NextResponse.json({
      success: true,
      message: `${payment.amount.toLocaleString()}원 환불 완료. 무료 플랜으로 전환되었습니다.`,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: 'admin', action: 'refund' },
      extra: { targetUserId: userId, paymentId },
    });
    return NextResponse.json({ error: err instanceof Error ? err.message : '환불에 실패했습니다.' }, { status: 500 });
  }
}
