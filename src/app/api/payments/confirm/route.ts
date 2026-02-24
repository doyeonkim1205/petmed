import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';
import { confirmPayment } from '@/lib/toss';
import { PLANS, PlanType } from '@/lib/plans';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  try {
    const { paymentKey, orderId, amount } = await request.json();

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    // Extract plan from orderId: pawdex_{userId}_{plan}_{timestamp}
    const parts = orderId.split('_');
    const plan = parts[2] as PlanType;

    if (!plan || !(plan in PLANS) || plan === 'free') {
      return NextResponse.json({ error: '유효하지 않은 플랜입니다.' }, { status: 400 });
    }

    // Verify amount matches plan price (prevent client-side tampering)
    const expectedAmount = PLANS[plan].price;
    if (amount !== expectedAmount) {
      return NextResponse.json({ error: '결제 금액이 일치하지 않습니다.' }, { status: 400 });
    }

    // Confirm payment with Toss
    const tossResult = await confirmPayment(paymentKey, orderId, amount);

    // Calculate subscription period (30 days)
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    // Insert payment history
    await supabaseAdmin.from('payment_history').insert({
      user_id: userId,
      toss_payment_key: paymentKey,
      toss_order_id: orderId,
      amount,
      status: 'done',
      receipt_url: tossResult.receipt?.url || null,
    });

    // Upsert subscription
    await supabaseAdmin.from('subscriptions').upsert({
      user_id: userId,
      plan,
      status: 'active',
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      canceled_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    // Update profile plan
    await supabaseAdmin.from('profiles').update({ plan }).eq('id', userId);

    return NextResponse.json({
      success: true,
      plan,
      periodEnd: periodEnd.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '결제 처리에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
