/**
 * 결제 어댑터.
 *   - 웹/TWA   : 토스 결제 (구독 페이지가 /payment 로 라우팅 — 이 어댑터를 쓰지 않음)
 *   - 네이티브 앱 : Google Play Billing (RevenueCat). Play 정책상 디지털 구독은 Play Billing 필수라,
 *                 앱에선 토스 라우트를 절대 타지 않는다.
 *
 * RC SDK 는 isNativeApp() 가드 뒤에서 동적 import → 웹/TWA 번들엔 별도 청크로 분리, dormant.
 * NEXT_PUBLIC_REVENUECAT_GOOGLE_API_KEY 미설정이면 isNativeBilling()=false →
 * 구독 페이지가 네이티브 결제 CTA 를 숨긴다. (Play Billing 출시 전까지 안전 dormant)
 *
 * 엔타이틀먼트('plus') 활성 여부는 보조 신호일 뿐, 권한의 진실원은 profiles.plan.
 * 실제 plan 갱신은 RevenueCat 웹훅(/api/payments/revenuecat-webhook)이 담당.
 */
import { isNativeApp } from './env';

const RC_GOOGLE_API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_GOOGLE_API_KEY || '';
const PLUS_ENTITLEMENT = 'plus';

let configuredFor: string | null = null;

async function ensureConfigured(userId: string) {
  const { Purchases, LOG_LEVEL } = await import('@revenuecat/purchases-capacitor');
  if (configuredFor !== userId) {
    // 진단용 DEBUG 로그 — offerings 가 비는 원인(키/상품/권한)을 logcat 에 출력.
    // (안정화 후 LOG_LEVEL.WARN 으로 낮추거나 제거)
    try { await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG }); } catch { /* noop */ }
    await Purchases.configure({ apiKey: RC_GOOGLE_API_KEY, appUserID: userId });
    configuredFor = userId;
  }
  return Purchases;
}

/**
 * getOfferings() 결과에서 사용할 offering 결정.
 * current(=대시보드 Current 지정)가 우선이지만, Current 미지정/패키지가 다른 offering에
 * 들어있는 경우를 대비해 all 의 첫 offering 으로 fallback (앱이 빈 화면 되는 것 방지).
 */
function resolveOffering(offerings: {
  current?: { availablePackages?: unknown[] } | null;
  all?: Record<string, { availablePackages?: unknown[] }>;
}) {
  const cur = offerings.current;
  if (cur && (cur.availablePackages?.length ?? 0) > 0) return cur;
  const all = Object.values(offerings.all ?? {});
  return all.find((o) => (o.availablePackages?.length ?? 0) > 0) ?? cur ?? null;
}

/**
 * Offering 에서 월간/연간 package 선택.
 *  1순위: RC 표준 편의 접근자 current.monthly / current.annual ($rc_monthly / $rc_annual).
 *  2순위: (커스텀 package id 대비) product.identifier prefix 매칭 (plus_monthly / plus_monthly:베이스플랜).
 * ⚠️ productId 는 Play '구독 상품 ID'(plus_monthly/plus_yearly) — base plan id(monthly/yearly) 가 아님.
 */
function pickPackage(
  offering: { monthly?: unknown; annual?: unknown; availablePackages?: unknown[] } | null | undefined,
  productId: string,
) {
  if (!offering) return null;
  const wantsYear = /year|annual/i.test(productId);
  const byAccessor = (wantsYear ? offering.annual : offering.monthly) as
    | { product: { identifier: string; priceString: string } }
    | undefined;
  if (byAccessor) return byAccessor;
  const pkgs = (offering.availablePackages ?? []) as { product: { identifier: string; priceString: string } }[];
  return (
    pkgs.find((p) => p.product.identifier === productId || p.product.identifier.startsWith(`${productId}:`)) ??
    pkgs[0] ??
    null
  );
}

export interface PurchaseResult {
  ok: boolean;
  active: boolean;   // 구매 후 'plus' 엔타이틀먼트 활성 여부
  canceled?: boolean; // 사용자가 결제창에서 취소
  error?: string;
}

export const platformPayments = {
  /** RevenueCat SDK 키 설정 여부 (플랫폼 무관). 앱에서 RC 사용 가능 여부 판단에 쓴다. */
  isRevenueCatReady(): boolean {
    return !!RC_GOOGLE_API_KEY;
  },

  /**
   * 앱에서 실제 RC 구매를 띄울 수 있는 상태 (네이티브 앱 + RC 키 존재).
   * ⚠️ UI 분기에서 "이게 false 면 토스"로 쓰면 안 됨 — 앱+키없음도 false 라 토스로 샘.
   *    토스 노출은 반드시 isNativeApp()===false(웹) 로만 판단할 것.
   *    이 플래그는 purchase/restore 내부 가드 + "RC 구매 버튼을 띄울지"에만 사용.
   */
  isNativeBilling(): boolean {
    return isNativeApp() && !!RC_GOOGLE_API_KEY;
  },

  /** Google Play 구독 관리(해지) 딥링크 — 서버 강제해지 불가, 사용자가 여기서 해지. */
  manageSubscriptionsUrl(): string {
    return 'https://play.google.com/store/account/subscriptions';
  },

  /** productId(예: plus_monthly)에 해당하는 RC 패키지 구매. 네이티브 전용. */
  async purchase(userId: string, productId: string): Promise<PurchaseResult> {
    if (!this.isNativeBilling()) return { ok: false, active: false, error: 'native billing unavailable' };
    try {
      const Purchases = await ensureConfigured(userId);
      const offerings = await Purchases.getOfferings();
      const pkg = pickPackage(resolveOffering(offerings), productId);
      if (!pkg) return { ok: false, active: false, error: 'no package' };
      const res = await Purchases.purchasePackage({ aPackage: pkg as Parameters<typeof Purchases.purchasePackage>[0]['aPackage'] });
      return { ok: true, active: !!res.customerInfo.entitlements.active[PLUS_ENTITLEMENT] };
    } catch (e) {
      const err = e as { code?: string; userCancelled?: boolean; message?: string };
      // RC: 사용자 취소는 에러로 던져지지만 결제 실패가 아님.
      if (err.userCancelled || err.code === 'PURCHASE_CANCELLED' || err.code === '1') {
        return { ok: false, active: false, canceled: true };
      }
      return { ok: false, active: false, error: err.message || String(e) };
    }
  },

  /** 구매 복원 (기기 변경·재설치). 'plus' 활성 여부 반환. */
  async restore(userId: string): Promise<PurchaseResult> {
    if (!this.isNativeBilling()) return { ok: false, active: false };
    try {
      const Purchases = await ensureConfigured(userId);
      const { customerInfo } = await Purchases.restorePurchases();
      return { ok: true, active: !!customerInfo.entitlements.active[PLUS_ENTITLEMENT] };
    } catch (e) {
      return { ok: false, active: false, error: (e as Error).message };
    }
  },

  /** productId 의 RC 로컬라이즈 가격 문자열(예: '₩3,500') — 앱은 Play 실제가를 표시해야 함. 없으면 null. */
  async getPriceString(userId: string, productId: string): Promise<string | null> {
    if (!this.isNativeBilling()) return null;
    try {
      const Purchases = await ensureConfigured(userId);
      const offerings = await Purchases.getOfferings();
      const pkg = pickPackage(resolveOffering(offerings), productId);
      return pkg?.product.priceString ?? null;
    } catch {
      return null;
    }
  },

  /** 현재 'plus' 엔타이틀먼트 활성 여부 조회 (로그인 후 동기화 보조용). */
  async hasActiveEntitlement(userId: string): Promise<boolean> {
    if (!this.isNativeBilling()) return false;
    try {
      const Purchases = await ensureConfigured(userId);
      const { customerInfo } = await Purchases.getCustomerInfo();
      return !!customerInfo.entitlements.active[PLUS_ENTITLEMENT];
    } catch {
      return false;
    }
  },
};
