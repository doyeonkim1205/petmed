import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { secureEqual } from '@/lib/secureCompare';

/**
 * RevenueCat 웹훅 — 앱(Google Play Billing) 구독 상태를 Supabase 로 동기화.
 *
 * 아키텍처: 웹 = 토스(/api/payments/confirm), 앱 = Play Billing(RevenueCat).
 * 둘 다 최종적으로 profiles.plan 을 갱신 → 권한의 단일 진실원 유지.
 *
 * 인증: RevenueCat 대시보드에서 설정한 Authorization 헤더를 REVENUECAT_WEBHOOK_SECRET 과 대조.
 *   - 시크릿 미설정(미구성) → 503 (dormant). 웹/심사 중 안전하게 비활성.
 *   - 불일치 → 401.
 *
 * app_user_id 규칙: 네이티브 RC 초기화 시 Supabase user id 를 app_user_id 로 지정한다.
 *   (익명 $RCAnonymousID 이벤트는 무시 — 로그인 유저만 동기화)
 *
 * 멱등성: subscriptions.last_event_at 과 비교해 더 오래된 이벤트는 무시.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// 엔타이틀먼트 → plan. RevenueCat entitlement id 를 'plus' 로 매핑.
const ENTITLEMENT_ID = 'plus';

// 구독이 '활성'으로 전환되는 이벤트 (권한 부여).
const GRANT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
]);
// 권한 즉시 회수: EXPIRATION(만료) / REFUND(환불됨).
// ⚠️ CANCELLATION 은 '해지 예약'(자동갱신 OFF)일 뿐 만료 시점까지는 active → 즉시 다운그레이드 X.
//    BILLING_ISSUE(grace) 도 즉시 회수 X (EXPIRATION 이 최종 판정). 실권한은 expires_at/entitlement 기준.
const REVOKE_TYPES = new Set(['EXPIRATION', 'REFUND']);
// 실제 결제(돈이 오간)가 발생하는 이벤트 — payment_history 기록 대상.
const PAYMENT_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE', 'PRODUCT_CHANGE']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  // 미구성 → dormant. (Play Billing 출시 전까지 안전 비활성)
  if (!secret) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }
  // Authorization 헤더는 'Bearer <secret>' 또는 '<secret>' 둘 다 허용 → 상수시간 비교.
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!secureEqual(token, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let event: Record<string, unknown> | undefined;
  try {
    const body = await request.json();
    event = body?.event;
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!event || typeof event !== 'object') {
    return NextResponse.json({ error: 'no event' }, { status: 400 });
  }

  const type = String(event.type || '');
  const appUserId = String(event.app_user_id || '');
  const eventAtMs = Number(event.event_timestamp_ms || 0);
  const expirationMs = Number(event.expiration_at_ms || 0);
  // RC 의 Play product_id 는 'plus_yearly:annual'(상품ID:베이스플랜) 형태.
  // subscriptions.product_id 는 payment_products(id) 로 FK 가 걸려 있어(plus_monthly/plus_yearly),
  // 베이스플랜 접미사를 떼어 매핑한다. (안 떼면 FK 위반 → upsert 실패 → 행 미생성)
  const productId = event.product_id ? String(event.product_id).split(':')[0] : null;
  // RC 는 store 를 'PLAY_STORE'/'APP_STORE'/'MAC_APP_STORE' 등으로 보냄.
  // subscriptions.store CHECK 는 ('toss','play','apple') 만 허용 → 매핑 필수
  // (소문자 'play_store' 그대로 넣으면 CHECK 위반으로 upsert 가 조용히 실패한다).
  const storeRaw = event.store ? String(event.store).toLowerCase() : 'play';
  const store = storeRaw.includes('app') ? 'apple' : 'play';
  const txId = event.original_transaction_id ? String(event.original_transaction_id) : null;
  const eventTxId = event.transaction_id ? String(event.transaction_id) : null;
  // 결제 금액(구매 통화 기준). KRW 면 정수(3900/40000). 없으면 0 → 기록 생략.
  const priceAmount = Number(event.price_in_purchased_currency ?? event.price ?? 0);
  // 결제 환경 — PRODUCTION/SANDBOX. 결제 이력엔 둘 다 남기되 매출 집계는 production 만.
  const environment = String(event.environment || '').toUpperCase() === 'SANDBOX' ? 'sandbox' : 'production';

  // 로그인 유저(Supabase uid)만 동기화. 익명/비정상 id 는 200 으로 흡수(재시도 폭주 방지).
  if (!UUID_RE.test(appUserId)) {
    return NextResponse.json({ ok: true, skipped: 'non-user app_user_id' });
  }

  // 우리가 다루는 엔타이틀먼트(plus)와 무관한 이벤트는 무시.
  const entitlementIds: string[] = Array.isArray(event.entitlement_ids)
    ? (event.entitlement_ids as unknown[]).map(String)
    : event.entitlement_id ? [String(event.entitlement_id)] : [];
  if (entitlementIds.length > 0 && !entitlementIds.includes(ENTITLEMENT_ID)) {
    return NextResponse.json({ ok: true, skipped: 'other entitlement' });
  }

  const eventAt = eventAtMs ? new Date(eventAtMs) : new Date();
  const periodEnd = expirationMs ? new Date(expirationMs) : null;

  try {
    // 결제내역 기록 — ⚠️ stale 가드보다 먼저 실행(순서 꼬인 갱신 결제도 누락 없이 기록).
    // 멱등: provider_payment_id 유니크 인덱스 → 재전송 중복은 23505 로 무시.
    // 샌드박스도 이력엔 남기되 environment 로 구분(매출 집계에선 production 만 합산).
    if (PAYMENT_TYPES.has(type) && priceAmount > 0) {
      const providerPaymentId = `rc_${eventTxId || txId || 'na'}_${eventAtMs}`;
      const { error: payErr } = await supabaseAdmin.from('payment_history').insert({
        user_id: appUserId,
        amount: Math.round(priceAmount),
        status: 'done',
        store,
        environment,
        provider_payment_id: providerPaymentId,
      });
      if (payErr && payErr.code !== '23505') {
        Sentry.captureException(new Error(`payment_history insert failed: ${payErr.message}`), {
          tags: { feature: 'payment', action: 'revenuecat-webhook-payment' },
          extra: { type, appUserId, providerPaymentId },
        });
      }
    }

    // 멱등성 — 저장된 last_event_at 보다 오래된 이벤트면 (구독 상태 갱신만) 무시.
    const { data: existing } = await supabaseAdmin
      .from('subscriptions')
      .select('last_event_at, store')
      .eq('user_id', appUserId)
      .maybeSingle();
    if (existing?.last_event_at && new Date(existing.last_event_at) > eventAt) {
      return NextResponse.json({ ok: true, skipped: 'stale event (payment recorded)' });
    }

    if (GRANT_TYPES.has(type)) {
      const { error: upsertErr } = await supabaseAdmin.from('subscriptions').upsert({
        user_id: appUserId,
        plan: 'plus',
        product_id: productId,
        status: 'active',
        store,
        provider_subscription_id: txId,
        provider_customer_id: appUserId,
        entitlement_id: ENTITLEMENT_ID,
        billing_type: 'recurring',
        period_start: new Date().toISOString(),
        period_end: periodEnd ? periodEnd.toISOString() : new Date(Date.now() + 31 * 864e5).toISOString(),
        next_billing_at: periodEnd ? periodEnd.toISOString() : null,
        canceled_at: null,
        last_event_at: eventAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      // supabase-js 는 DB 에러 시 throw 하지 않으므로 명시적으로 잡아 가시화한다.
      if (upsertErr) {
        Sentry.captureException(new Error(`subscriptions upsert failed: ${upsertErr.message}`), {
          tags: { feature: 'payment', action: 'revenuecat-webhook-upsert' },
          extra: { type, appUserId, productId },
        });
      }
      await supabaseAdmin.from('profiles').update({ plan: 'plus' }).eq('id', appUserId);
      // (결제내역 insert 는 위에서 stale 가드 이전에 이미 처리함)
    } else if (REVOKE_TYPES.has(type)) {
      await supabaseAdmin.from('subscriptions').update({
        status: 'expired',
        store,
        last_event_at: eventAt.toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', appUserId);
      await supabaseAdmin.from('profiles').update({ plan: 'free' }).eq('id', appUserId);
    } else if (type === 'CANCELLATION') {
      // 자동갱신 해지 — 만료(period_end)까지는 plus 유지. 표시용 canceled_at 만 기록.
      await supabaseAdmin.from('subscriptions').update({
        canceled_at: new Date().toISOString(),
        store,
        last_event_at: eventAt.toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', appUserId);
    } else {
      // BILLING_ISSUE / TRANSFER / SUBSCRIPTION_PAUSED 등 — 다운그레이드 없이 기록만.
      await supabaseAdmin.from('subscriptions').update({
        last_event_at: eventAt.toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', appUserId);
    }

    // 구독 이벤트 로그 (유효 type 만). BILLING_ISSUE/TRANSFER 등은 로깅 생략.
    const evt = type === 'RENEWAL' ? 'renew'
      : GRANT_TYPES.has(type) ? 'purchase'
      : type === 'EXPIRATION' ? 'expired'
      : type === 'REFUND' ? 'refund'
      : type === 'CANCELLATION' ? 'cancel'
      : null;
    if (evt) {
      const { logSubscriptionEvent } = await import('@/lib/subscriptionEvents');
      await logSubscriptionEvent(
        appUserId,
        evt,
        REVOKE_TYPES.has(type) ? 'free' : 'plus',
        undefined,
        `RevenueCat: ${type}`,
      ).catch(() => {});

      // activity_logs 에도 기록 — 어드민 활동로그(필터)에서 RC(구글/애플) 구독 이벤트도 보이게.
      // (토스는 결제 라우트에서 이미 기록 / RC 는 그동안 누락이었음)
      const activityAction = evt === 'purchase' ? 'subscription.purchase'
        : evt === 'cancel' ? 'subscription.cancel'
        : evt === 'expired' ? 'subscription.expired'
        : evt === 'refund' ? 'subscription.refund'
        : evt === 'renew' ? 'subscription.auto_billed'
        : null;
      if (activityAction) {
        const { logActivityServer } = await import('@/lib/activityLogServer');
        await logActivityServer(appUserId, activityAction, {
          resourceType: 'subscription',
          details: { store, source: 'revenuecat', type },
        }).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, type });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'payment', action: 'revenuecat-webhook' },
      extra: { type, appUserId },
    });
    return NextResponse.json({ error: 'sync failed' }, { status: 500 });
  }
}
