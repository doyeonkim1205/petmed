import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { verifyAuth } from '@/lib/apiAuth';
import { isRcPlatform, rcPublicKeyFor } from '@/lib/revenuecat';

/**
 * 구매 직후 즉시 동기화 — 웹훅(비동기) 지연을 기다리지 않고 서버가 RevenueCat 을 직접 확인해
 * profiles.plan / subscriptions 를 갱신한다.
 *
 * 보안: 클라이언트는 "나 plus야"라고 주장하지 않는다. 서버가 RC Public(SDK) API Key 로
 *       GET /v1/subscribers/{app_user_id} 를 호출해 entitlement 를 직접 검증한다.
 *       app_user_id 는 로그인 유저의 Supabase id(= RC 초기화 시 지정한 appUserID).
 *       ⚠️ V1 조회는 Public 키로 인증한다 (Secret `sk_`/V2 는 V1 비호환 → 403/7723).
 *       플랫폼(ios/android)에 맞는 Public 키를 고른다 — 자세한 근거는 lib/revenuecat.ts.
 *
 * 웹훅은 갱신/취소/만료/환불 등 지속 동기화 역할로 그대로 둔다(이건 "구매 직후 즉시 반영"용).
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ENTITLEMENT_ID = 'plus';

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  // 플랫폼 판별 (클라가 body 로 전달) → 대응하는 RC Public 키 선택.
  // 입력검증: 지원 플랫폼('ios'|'android')이 아니면 400 (조작/누락 방어).
  const body = await request.json().catch(() => null);
  const platform = body?.platform;
  if (!isRcPlatform(platform)) {
    return NextResponse.json({ ok: false, error: 'invalid platform' }, { status: 400 });
  }

  const rcKey = rcPublicKeyFor(platform);
  if (!rcKey) {
    // 키 미설정 → dormant (웹훅 폴백). 클라는 낙관적 표시 + 웹훅 반영을 기다리면 됨.
    return NextResponse.json({ ok: false, error: 'not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${rcKey}`, 'Content-Type': 'application/json' },
    });

    // 구매 이력이 전혀 없으면 RC 가 404 (또는 빈 subscriber). active 아님으로 처리.
    if (res.status === 404) return NextResponse.json({ ok: true, active: false });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      Sentry.captureException(new Error(`RC subscriber fetch ${res.status}: ${txt.slice(0, 200)}`), {
        tags: { feature: 'payment', action: 'subscription-sync' },
        extra: { userId },
      });
      return NextResponse.json({ ok: false, error: 'rc fetch failed' }, { status: 502 });
    }

    const data = await res.json();
    const ent = data?.subscriber?.entitlements?.[ENTITLEMENT_ID];
    const expiresMs = ent?.expires_date ? Date.parse(ent.expires_date) : null;
    const active = !!ent && (expiresMs === null || (expiresMs && expiresMs > Date.now()));

    if (!active) {
      // 활성 아님 — 여기서 강등하지 않는다(환불/만료는 웹훅이 진실원). 단순히 결과만 반환.
      return NextResponse.json({ ok: true, active: false });
    }

    const rawProduct = ent.product_identifier ? String(ent.product_identifier) : null;
    // subscriptions.product_id 는 payment_products(plus_monthly/plus_yearly) FK → 베이스플랜 접미사 제거.
    const productId = rawProduct ? rawProduct.split(':')[0] : null;
    const subInfo = rawProduct ? data?.subscriber?.subscriptions?.[rawProduct] : null;
    const storeRaw = String(subInfo?.store || 'play_store');
    const store = storeRaw.includes('app') ? 'apple' : 'play';
    const canceled = !!subInfo?.unsubscribe_detected_at; // 자동갱신 OFF(해지 예약) — 만료 전까진 active
    const periodEnd = expiresMs ? new Date(expiresMs).toISOString() : new Date(Date.now() + 31 * 864e5).toISOString();

    const { error: upErr } = await supabaseAdmin.from('subscriptions').upsert({
      user_id: userId,
      plan: 'plus',
      product_id: productId,
      status: canceled ? 'canceled' : 'active',
      store,
      provider_customer_id: userId,
      entitlement_id: ENTITLEMENT_ID,
      billing_type: 'recurring',
      period_start: new Date().toISOString(),
      period_end: periodEnd,
      next_billing_at: canceled ? null : periodEnd,
      canceled_at: canceled ? new Date().toISOString() : null,
      last_event_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (upErr) {
      Sentry.captureException(new Error(`sync subscriptions upsert: ${upErr.message}`), {
        tags: { feature: 'payment', action: 'subscription-sync-upsert' },
        extra: { userId, productId },
      });
    }
    await supabaseAdmin.from('profiles').update({ plan: 'plus' }).eq('id', userId);

    return NextResponse.json({ ok: true, active: true, plan: 'plus', status: canceled ? 'canceled' : 'active' });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'payment', action: 'subscription-sync' },
      extra: { userId },
    });
    return NextResponse.json({ ok: false, error: 'sync failed' }, { status: 500 });
  }
}
