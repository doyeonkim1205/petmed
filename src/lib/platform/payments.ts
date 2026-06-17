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
  const { Purchases } = await import('@revenuecat/purchases-capacitor');
  if (configuredFor !== userId) {
    await Purchases.configure({ apiKey: RC_GOOGLE_API_KEY, appUserID: userId });
    configuredFor = userId;
  }
  return Purchases;
}

export interface PurchaseResult {
  ok: boolean;
  active: boolean;   // 구매 후 'plus' 엔타이틀먼트 활성 여부
  canceled?: boolean; // 사용자가 결제창에서 취소
  error?: string;
}

export const platformPayments = {
  /** 앱(네이티브)에서 Play Billing 사용 가능 여부. 웹은 항상 false(토스 사용), 키 미설정도 false. */
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
      const pkgs = offerings.current?.availablePackages ?? [];
      // RC product.identifier 가 'plus_monthly' 또는 'plus_monthly:base-plan' 형태일 수 있어 prefix 매칭.
      const pkg = pkgs.find(
        (p) => p.product.identifier === productId || p.product.identifier.startsWith(`${productId}:`),
      ) ?? pkgs[0];
      if (!pkg) return { ok: false, active: false, error: 'no package' };
      const res = await Purchases.purchasePackage({ aPackage: pkg });
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
