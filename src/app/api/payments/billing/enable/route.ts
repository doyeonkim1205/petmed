import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';
import { issueBillingKey, type TossBillingError } from '@/lib/toss-billing';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Enable auto-renewal for an existing subscription.
 * Registers a billing key but does NOT charge immediately.
 * The auto-billing cron will charge on the existing period_end date.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  try {
    const { authKey, customerKey } = await request.json();
    if (!authKey || !customerKey) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }

    if (customerKey !== userId) {
      return NextResponse.json({ error: '인증 정보가 일치하지 않습니다.' }, { status: 403 });
    }

    // Must have an existing active subscription
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!subscription) {
      return NextResponse.json({ error: '활성 구독이 없습니다.' }, { status: 404 });
    }

    if (subscription.billing_type === 'recurring') {
      return NextResponse.json({ error: '이미 자동 결제가 활성화되어 있습니다.' }, { status: 400 });
    }

    // Issue billing key from Toss
    let issued;
    try {
      issued = await issueBillingKey(authKey, customerKey);
    } catch (err) {
      const e = err as TossBillingError;
      return NextResponse.json({ error: e.message || '카드 등록에 실패했습니다.' }, { status: 400 });
    }

    const cardCompany = issued.cardCompany || issued.card?.issuerCode || null;
    const cardNumber = issued.cardNumber || issued.card?.number || null;

    // Update subscription: switch to recurring, set next billing to period_end
    await supabaseAdmin
      .from('subscriptions')
      .update({
        billing_type: 'recurring',
        toss_billing_key: issued.billingKey,
        toss_customer_key: customerKey,
        card_company: cardCompany,
        card_number: cardNumber,
        next_billing_at: subscription.period_end, // Charge when current period ends
        product_id: subscription.product_id || 'plus_monthly',
        billing_failed_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    const { logActivity } = await import('@/lib/activityLog');
    logActivity(userId, 'subscription.enable_recurring', {
      details: { plan: subscription.plan },
    });

    return NextResponse.json({
      success: true,
      message: `자동 결제가 등록되었습니다. ${new Date(subscription.period_end).toLocaleDateString('ko-KR')}부터 자동 결제됩니다.`,
      nextBillingAt: subscription.period_end,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '처리에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
