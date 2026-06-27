import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { verifyAuth } from '@/lib/apiAuth';
import { confirmPayment } from '@/lib/toss';
import { getProductById } from '@/lib/products';

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

    // orderId format: pawdex_{userIdShort}_{productId}_{timestamp}
    // productId may itself contain underscores (e.g. plus_monthly), so we
    // strip the prefix/suffix and rejoin the middle parts.
    const parts = orderId.split('_');
    if (parts.length < 4 || parts[0] !== 'pawdex') {
      return NextResponse.json({ error: '유효하지 않은 주문 ID입니다.' }, { status: 400 });
    }
    const productId = parts.slice(2, parts.length - 1).join('_');

    // Server-side product lookup. The DB is the source of truth for price.
    const product = await getProductById(productId);
    if (!product) {
      return NextResponse.json({ error: '유효하지 않은 상품입니다.' }, { status: 400 });
    }

    // Verify amount matches DB price (prevent client-side tampering)
    if (amount !== product.price) {
      return NextResponse.json({ error: '결제 금액이 일치하지 않습니다.' }, { status: 400 });
    }

    // Confirm payment with Toss
    const tossResult = await confirmPayment(paymentKey, orderId, amount);

    // Check for existing active subscription (plan change / upgrade case)
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('period_end, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    // If upgrading from an active plan, new period starts after current period ends.
    // If new subscription (no active sub), starts now.
    const existingEnd = existingSub?.period_end ? new Date(existingSub.period_end) : null;
    const startFrom = existingEnd && existingEnd > new Date() ? existingEnd : new Date();

    const periodStart = startFrom;
    const periodEnd = new Date(startFrom.getTime());
    if (product.period === 'year') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setDate(periodEnd.getDate() + 30);
    }

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
      plan: product.plan,
      product_id: product.id,
      status: 'active',
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      canceled_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    // Update profile plan
    await supabaseAdmin.from('profiles').update({ plan: product.plan }).eq('id', userId);

    const { logActivityServer } = await import('@/lib/activityLogServer');
    await logActivityServer(userId, 'subscription.purchase', { details: { plan: product.plan, productId: product.id, amount } });

    const { logSubscriptionEvent } = await import('@/lib/subscriptionEvents');
    await logSubscriptionEvent(userId, 'purchase', product.plan, amount, '신규 결제');

    return NextResponse.json({
      success: true,
      plan: product.plan,
      productId: product.id,
      periodEnd: periodEnd.toISOString(),
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'payment', action: 'confirm' },
      extra: { userId },
    });
    const message = error instanceof Error ? error.message : '결제 처리에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
