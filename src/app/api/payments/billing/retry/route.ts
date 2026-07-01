import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { verifyAuth } from '@/lib/apiAuth';
import { checkRateLimit } from '@/lib/rateLimit';
import { chargeBilling, classifyBillingError, type TossBillingError } from '@/lib/toss-billing';
import { getProductById } from '@/lib/products';
import { decrypt } from '@/lib/encryption';

/**
 * 사용자가 결제 페이지에서 "즉시 재결제" 버튼을 누를 때 호출하는 API.
 *
 * 동작:
 *  - 활성 recurring 구독 + billing_failed_count > 0 인 경우만 허용
 *  - 토스 빌링키로 즉시 charge
 *  - 성공: period_end 30일 연장, billing_failed_count=0, payment_history 기록
 *  - 실패: billing_failed_count / next_billing_at 그대로 (cron 일정 영향 X)
 *
 * 정책:
 *  - 1회 결제 / 해지 예약 / 빌링키 없음 → 403
 *  - 결제 실패 이력 없으면 → 403 (next_billing_at 까지 기다리면 됨)
 *  - 분당 3회 rate limit
 *  - 동시성: 한 번 charge 후 응답 받기 전엔 다른 요청은 rate limit 으로 막힘
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const MONTHLY_CYCLE_DAYS = 30;

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (auth.error) return auth.error;
    const userId = auth.user!.id;

    // 분당 3회 — 정상 사용자는 1~2번이면 충분.
    if (!checkRateLimit(`${userId}:billing-retry`, 3, 60_000)) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 },
      );
    }

    // 1) 사용자 구독 조회
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, plan, product_id, status, billing_type, toss_billing_key, toss_customer_key, period_end, next_billing_at, billing_failed_count')
      .eq('user_id', userId)
      .in('status', ['active'])
      .maybeSingle();

    if (!sub) {
      return NextResponse.json({ error: '활성 구독이 없습니다.' }, { status: 404 });
    }
    if (sub.billing_type !== 'recurring') {
      return NextResponse.json({
        error: '자동 갱신 구독에서만 즉시 재결제가 가능합니다.',
      }, { status: 403 });
    }
    if (!sub.toss_billing_key || !sub.toss_customer_key || !sub.product_id) {
      return NextResponse.json({
        error: '결제 정보가 부족합니다. 새 카드로 다시 등록해 주세요.',
      }, { status: 400 });
    }
    if ((sub.billing_failed_count || 0) === 0) {
      return NextResponse.json({
        error: '재결제할 결제 실패 내역이 없습니다.',
      }, { status: 403 });
    }

    // 2) 상품/빌링키 준비
    const product = await getProductById(sub.product_id);
    if (!product) {
      return NextResponse.json({
        error: '상품 정보를 찾을 수 없습니다.',
      }, { status: 500 });
    }
    const billingKey = decrypt(sub.toss_billing_key) || sub.toss_billing_key;
    const orderId = `pawdex_retry_${userId.slice(0, 8)}_${product.id}_${Date.now()}`;

    // 3) 토스 charge
    let charged;
    try {
      charged = await chargeBilling({
        billingKey,
        customerKey: sub.toss_customer_key,
        amount: product.price,
        orderId,
        orderName: product.name,
      });
    } catch (err) {
      const e = err as TossBillingError;
      const { userMessage } = classifyBillingError(e.code);
      Sentry.captureException(e, {
        tags: { feature: 'billing-retry', action: 'charge' },
        extra: { userId, subscriptionId: sub.id, errorCode: e.code },
      });
      return NextResponse.json({
        error: `결제에 실패했습니다: ${userMessage}`,
        code: e.code,
      }, { status: 402 });
    }

    // 4) 성공 처리 — auto-billing cron 의 성공 경로와 동일 흐름
    const now = new Date();
    const newPeriodEnd = new Date(now.getTime() + MONTHLY_CYCLE_DAYS * 24 * 60 * 60 * 1000);

    await supabaseAdmin
      .from('payment_history')
      .insert({
        user_id: userId,
        toss_payment_key: charged.paymentKey,
        toss_order_id: orderId,
        amount: charged.totalAmount,
        status: 'done',
        store: 'toss',
        environment: 'production',
        receipt_url: charged.receipt?.url || null,
      });

    await supabaseAdmin
      .from('subscriptions')
      .update({
        period_end: newPeriodEnd.toISOString(),
        next_billing_at: newPeriodEnd.toISOString(),
        billing_failed_count: 0,
        last_billing_failure_at: null,
        last_billing_failure_reason: null,
        updated_at: now.toISOString(),
      })
      .eq('id', sub.id);

    // 5) 활동/이벤트 로그
    const { logActivityServer } = await import('@/lib/activityLogServer');
    await logActivityServer(userId, 'subscription.manual_retry', {
      details: { plan: product.plan, productId: product.id, amount: charged.totalAmount },
    });

    const { logSubscriptionEvent } = await import('@/lib/subscriptionEvents');
    await logSubscriptionEvent(
      userId,
      'renew',
      product.plan,
      charged.totalAmount,
      '즉시 재결제 성공',
    );

    return NextResponse.json({
      ok: true,
      amount: charged.totalAmount,
      periodEnd: newPeriodEnd.toISOString(),
    });
  } catch (err) {
    console.error('billing-retry error:', err);
    Sentry.captureException(err);
    return NextResponse.json(
      { error: '서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );
  }
}
