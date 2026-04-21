import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { verifyAuth } from '@/lib/apiAuth';
import { issueBillingKey, type TossBillingError } from '@/lib/toss-billing';
import { encrypt } from '@/lib/encryption';

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

    // 연간 구독자는 자동 갱신 차단.
    // UX 판단: 연간은 "1년 단발 체험" 모델이 자연스러움. 1년 뒤 자동 결제는
    //   - 유저 심리 부담 (모르는 새 4만원 결제)
    //   - 한국 소비자 보호 관점에서 민원 요소
    // 프론트에서 버튼을 이미 숨기지만 API 직접 호출 방지용 백엔드 가드.
    if (subscription.product_id === 'plus_yearly') {
      return NextResponse.json(
        { error: '연간 구독은 자동 갱신을 지원하지 않습니다. 만료 전 연장 안내를 드립니다.' },
        { status: 400 },
      );
    }

    // Issue billing key from Toss
    let issued;
    try {
      issued = await issueBillingKey(authKey, customerKey);
    } catch (err) {
      const e = err as TossBillingError;
      Sentry.captureException(e, {
        tags: { feature: 'billing', action: 'enable-issue-key' },
        extra: { userId },
      });
      return NextResponse.json({ error: e.message || '카드 등록에 실패했습니다.' }, { status: 400 });
    }

    const cardCompany = issued.cardCompany || issued.card?.issuerCode || null;
    const cardNumber = issued.cardNumber || issued.card?.number || null;

    // Product ID 전환 규칙:
    //   plus_monthly_onetime (3,900원 단건) → plus_monthly (3,500원 자동결제 할인가)
    //   그 외는 유지. 유저가 "자동 결제로 전환하면 할인가 적용" 을 기대하므로.
    const newProductId =
      subscription.product_id === 'plus_monthly_onetime'
        ? 'plus_monthly'
        : subscription.product_id || 'plus_monthly';

    // 다음 결제 금액: 새 product_id 기준으로 조회
    const { getProductById } = await import('@/lib/products');
    const newProduct = await getProductById(newProductId);

    // Update subscription: switch to recurring, set next billing to period_end
    await supabaseAdmin
      .from('subscriptions')
      .update({
        billing_type: 'recurring',
        toss_billing_key: encrypt(issued.billingKey),
        toss_customer_key: customerKey,
        card_company: cardCompany,
        card_number: cardNumber,
        next_billing_at: subscription.period_end, // Charge when current period ends
        product_id: newProductId,
        billing_failed_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    const { logActivity } = await import('@/lib/activityLog');
    logActivity(userId, 'subscription.enable_recurring', {
      details: { plan: subscription.plan, productId: newProductId },
    });

    return NextResponse.json({
      success: true,
      mode: 'enable',
      message: `자동 결제가 등록되었습니다. ${new Date(subscription.period_end).toLocaleDateString('ko-KR')}부터 자동 결제됩니다.`,
      // 페이지에서 정보 카드 렌더용 구조화 필드
      productId: newProductId,
      productName: newProduct?.name || 'PawDex Plus 월간 자동 결제',
      period: newProduct?.period || 'month',
      nextBillingAt: subscription.period_end,
      amount: newProduct?.price ?? null,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'billing', action: 'enable' },
      extra: { userId },
    });
    const message = error instanceof Error ? error.message : '처리에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
