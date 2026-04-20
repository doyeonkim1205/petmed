import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { verifyAuth } from '@/lib/apiAuth';
import { getProductById } from '@/lib/products';
import { issueBillingKey, chargeBilling, classifyBillingError, type TossBillingError } from '@/lib/toss-billing';
import { encrypt } from '@/lib/encryption';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;
  const userEmail = auth.user!.email || undefined;

  try {
    const { authKey, customerKey, productId } = await request.json();
    if (!authKey || !customerKey || !productId) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }

    // The customerKey from Toss MUST match the user — defends against
    // someone passing another user's customerKey.
    if (customerKey !== userId) {
      return NextResponse.json({ error: '인증 정보가 일치하지 않습니다.' }, { status: 403 });
    }

    // Server-side product lookup. Only monthly recurring products allowed here.
    const product = await getProductById(productId);
    if (!product) {
      return NextResponse.json({ error: '유효하지 않은 상품입니다.' }, { status: 400 });
    }
    if (product.period !== 'month') {
      return NextResponse.json(
        { error: '자동 갱신은 월간 상품에서만 이용할 수 있습니다.' },
        { status: 400 },
      );
    }

    // 1) Exchange authKey for permanent billingKey
    let issued;
    try {
      issued = await issueBillingKey(authKey, customerKey);
    } catch (err) {
      const e = err as TossBillingError;
      Sentry.captureException(e, {
        tags: { feature: 'billing', action: 'issue-key' },
        extra: { userId, productId },
      });
      console.error('issueBillingKey failed', e);
      return NextResponse.json(
        { error: e.message || '카드 등록에 실패했습니다.' },
        { status: 400 },
      );
    }

    // 2) Charge first payment immediately
    const firstOrderId = `pawdex_${userId.slice(0, 8)}_${product.id}_${Date.now()}`;
    let charged;
    try {
      charged = await chargeBilling({
        billingKey: issued.billingKey,
        customerKey,
        amount: product.price,
        orderId: firstOrderId,
        orderName: product.name,
        customerEmail: userEmail,
      });
    } catch (err) {
      const e = err as TossBillingError;
      Sentry.captureException(e, {
        tags: { feature: 'billing', action: 'first-charge' },
        extra: { userId, productId, code: e.code },
      });
      console.error('first chargeBilling failed', e);
      const friendly = classifyBillingError(e.code).userMessage;
      return NextResponse.json(
        { error: `카드 등록은 완료되었으나 첫 결제에 실패했습니다: ${friendly}` },
        { status: 400 },
      );
    }

    // 3) Compute subscription period (monthly = +30 days)
    const now = new Date();
    const periodStart = now;
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const nextBillingAt = periodEnd; // billing fires on the same day as period_end

    // 4) Insert payment_history
    await supabaseAdmin.from('payment_history').insert({
      user_id: userId,
      toss_payment_key: charged.paymentKey,
      toss_order_id: firstOrderId,
      amount: charged.totalAmount,
      status: 'done',
      receipt_url: charged.receipt?.url || null,
    });

    // Card info from Toss response (for displaying in subscription mgmt UI)
    const cardCompany = issued.cardCompany || issued.card?.issuerCode || null;
    const cardNumber = issued.cardNumber || issued.card?.number || null;

    // 5) Upsert subscription with billing info
    await supabaseAdmin.from('subscriptions').upsert(
      {
        user_id: userId,
        plan: product.plan,
        product_id: product.id,
        status: 'active',
        billing_type: 'recurring',
        toss_billing_key: encrypt(issued.billingKey),
        toss_customer_key: customerKey,
        card_company: cardCompany,
        card_number: cardNumber,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        next_billing_at: nextBillingAt.toISOString(),
        canceled_at: null,
        billing_failed_count: 0,
        last_billing_failure_at: null,
        last_billing_failure_reason: null,
        // 새 결제니까 만료 알림 다시 보낼 수 있게 reset
        reminder_3day_sent_at: null,
        updated_at: now.toISOString(),
      },
      { onConflict: 'user_id' },
    );

    // 6) Update profile plan
    await supabaseAdmin.from('profiles').update({ plan: product.plan }).eq('id', userId);

    // 7) Activity + subscription event logs
    const { logActivity } = await import('@/lib/activityLog');
    logActivity(userId, 'subscription.purchase', {
      details: { plan: product.plan, productId: product.id, amount: charged.totalAmount, billingType: 'recurring' },
    });

    const { logSubscriptionEvent } = await import('@/lib/subscriptionEvents');
    await logSubscriptionEvent(userId, 'purchase', product.plan, charged.totalAmount, '자동 갱신 결제 등록');

    return NextResponse.json({
      success: true,
      plan: product.plan,
      productId: product.id,
      periodEnd: periodEnd.toISOString(),
      nextBillingAt: nextBillingAt.toISOString(),
      billingType: 'recurring',
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'billing', action: 'register' },
      extra: { userId },
    });
    const message = error instanceof Error ? error.message : '결제 처리에 실패했습니다.';
    console.error('billing/register fatal error', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
