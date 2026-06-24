/**
 * 결제 어댑터.
 *   - 웹/TWA   : 토스 결제 (구독 페이지가 /payment 로 라우팅 — 이 어댑터를 쓰지 않음)
 *   - 네이티브 앱 : Google Play Billing — PawDex 전용 NativeBilling 브릿지 경유.
 *
 * ⚠️ @revenuecat/purchases-capacitor 의 JS(getProducts/getOfferings/purchasePackage)는 쓰지 않는다.
 *    그 플러그인은 CustomerInfo·StoreProduct 같은 복잡 중첩 객체를 JS Promise 로 resolve 하는데,
 *    이 앱의 원격(server.url) WebView 조합에서 복잡객체가 JS 로 돌아오지 않고 멈춘다(진단 확인).
 *    → 네이티브 NativeBilling 플러그인이 RC Native SDK 를 직접 호출하고, JS 로는 문자열/boolean
 *      중심의 "평평한 JSON" 만 반환한다.
 *
 * 엔타이틀먼트('plus') 활성 여부는 보조 신호일 뿐, 권한의 진실원은 profiles.plan.
 * 실제 plan 갱신은 RevenueCat 웹훅(/api/payments/revenuecat-webhook)이 담당.
 */
import { isNativeApp, isIOS } from './env';
import { registerPlugin } from '@capacitor/core';

const RC_GOOGLE_API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_GOOGLE_API_KEY || '';
const RC_APPLE_API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_APPLE_API_KEY || '';

/** 현재 플랫폼에 맞는 RevenueCat Public API 키 (iOS=Apple / 그 외=Google). */
function activeApiKey(): string {
  return isIOS() ? RC_APPLE_API_KEY : RC_GOOGLE_API_KEY;
}

/** 네이티브에서 돌려주는 평평한 결과(문자열/boolean 중심). 복잡 객체는 절대 넘기지 않는다. */
interface FlatResult {
  ok: boolean;
  active?: boolean;
  cancelled?: boolean;
  productId?: string;
  entitlement?: string;
  error?: string;
  count?: number;
  monthly?: string;
  monthlyId?: string;
  annual?: string;
  annualId?: string;
}

interface ConfigOpts {
  apiKey: string;
  appUserId?: string;
}

const NativeBilling = registerPlugin<{
  configure(o: ConfigOpts): Promise<FlatResult>;
  getPrices(o: ConfigOpts): Promise<FlatResult>;
  purchaseMonthly(o: ConfigOpts): Promise<FlatResult>;
  purchaseAnnual(o: ConfigOpts): Promise<FlatResult>;
  restorePurchases(o: ConfigOpts): Promise<FlatResult>;
  getCustomerStatus(o: ConfigOpts): Promise<FlatResult>;
}>('NativeBilling');

/** 네이티브 호출이 혹시라도 멈춰도 UI 가 영구 대기하지 않도록 타임아웃으로 감싼다. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}_timeout_${ms}ms`)), ms);
  });
  return Promise.race([p.finally(() => clearTimeout(timer)), timeout]);
}

export interface PurchaseResult {
  ok: boolean;
  active: boolean;   // 구매 후 'plus' 엔타이틀먼트 활성 여부
  canceled?: boolean; // 사용자가 결제창에서 취소
  error?: string;
}

// ── iOS 결제: RevenueCat Capacitor JS 경로 ─────────────────────────────────
//    Android 는 NativeBilling 브릿지 유지. iOS 는 RC 공식 Capacitor 플러그인 직접 사용.
//    ⚠️ RC JS 의 복잡객체(CustomerInfo/Offerings)가 원격(server.url) WebView 에서 JS 로
//    안 돌아올 위험이 있다(Android 에서 그래서 NativeBilling 으로 우회). iOS(WKWebView)는
//    실기기 검증 필요 — 여기서 멈추면 NativeStoreKitBridge.swift(평평 JSON)로 전환.
//    (현재는 "RC JS 먼저 시도" 단계. withTimeout 으로 영구대기 방지.)
const RC_ENTITLEMENT = 'plus';
let rcConfigured = false;

async function rcConfigure(userId: string) {
  const { Purchases } = await import('@revenuecat/purchases-capacitor');
  if (!rcConfigured) {
    await Purchases.configure({ apiKey: activeApiKey(), appUserID: userId });
    rcConfigured = true;
  }
  return Purchases;
}

async function iosPurchase(userId: string, productId: string): Promise<PurchaseResult> {
  try {
    const Purchases = await rcConfigure(userId);
    const offerings = await withTimeout(Purchases.getOfferings(), 20000, 'offerings');
    const cur = offerings.current;
    if (!cur) return { ok: false, active: false, error: 'no current offering' };
    const wantsYear = /year|annual/i.test(productId);
    const aPackage =
      cur.availablePackages.find((p) => p.product.identifier === productId) ??
      (wantsYear ? cur.annual : cur.monthly) ??
      null;
    if (!aPackage) return { ok: false, active: false, error: 'package not found' };
    const res = await withTimeout(Purchases.purchasePackage({ aPackage }), 180000, 'purchase');
    return { ok: true, active: !!res.customerInfo.entitlements.active[RC_ENTITLEMENT] };
  } catch (e) {
    const err = e as { code?: string; message?: string; userCancelled?: boolean };
    if (err.userCancelled || /cancel/i.test(err.message || '')) {
      return { ok: false, active: false, canceled: true };
    }
    return { ok: false, active: false, error: err.message || 'purchase failed' };
  }
}

async function iosRestore(userId: string): Promise<PurchaseResult> {
  try {
    const Purchases = await rcConfigure(userId);
    const res = await withTimeout(Purchases.restorePurchases(), 30000, 'restore');
    return { ok: true, active: !!res.customerInfo.entitlements.active[RC_ENTITLEMENT] };
  } catch (e) {
    return { ok: false, active: false, error: (e as Error).message };
  }
}

async function iosHasEntitlement(userId: string): Promise<boolean> {
  try {
    const Purchases = await rcConfigure(userId);
    const res = await withTimeout(Purchases.getCustomerInfo(), 15000, 'status');
    return !!res.customerInfo.entitlements.active[RC_ENTITLEMENT];
  } catch {
    return false;
  }
}

let rcDiagShown = false;
async function iosGetPrice(userId: string, productId: string): Promise<string | null> {
  try {
    const Purchases = await rcConfigure(userId);
    const offerings = await withTimeout(Purchases.getOfferings(), 15000, 'offerings');
    // ── TEMP 진단(1회): getOfferings 실제 결과 확인. 원인 확정 후 제거.
    if (!rcDiagShown) {
      rcDiagShown = true;
      const cur = offerings.current;
      const pkgs = cur?.availablePackages ?? [];
      const desc = pkgs.map((p) => `${p.identifier}=${p.product.identifier}:${p.product.priceString}`).join(' | ');
      alert(`[RC진단]\ncurrent=${cur ? cur.identifier : 'NULL'}\npkgs=${pkgs.length}\nallOfferings=${Object.keys(offerings.all).join(',') || '(none)'}\n${desc || '(빈 패키지)'}`);
    }
    const aPackage = offerings.current?.availablePackages.find((p) => p.product.identifier === productId);
    return aPackage?.product.priceString ?? null;
  } catch (e) {
    if (!rcDiagShown) {
      rcDiagShown = true;
      alert('[RC진단] getOfferings 에러: ' + (e as Error).message);
    }
    return null;
  }
}

export const platformPayments = {
  /** RC 키 설정 여부 (현재 플랫폼 기준). 앱에서 결제 UI 를 띄울지 판단에 쓴다. */
  isRevenueCatReady(): boolean {
    return !!activeApiKey();
  },

  /**
   * 앱에서 실제 구매를 띄울 수 있는 상태 (네이티브 앱 + 플랫폼 RC 키 존재).
   * ⚠️ UI 분기에서 "이게 false 면 토스"로 쓰면 안 됨 — 앱+키없음도 false.
   *    토스 노출은 반드시 isNativeApp()===false(웹) 로만 판단할 것.
   * iOS=RC Capacitor JS / Android=NativeBilling 브릿지로 실제 구매 실행.
   *    (iOS RC JS 가 원격 WebView 에서 막히면 Swift StoreKit 브릿지로 전환 — 실기기 검증)
   */
  isNativeBilling(): boolean {
    return isNativeApp() && !!activeApiKey();
  },

  /** 구독 관리(해지) 딥링크 — iOS=App Store / 그 외=Google Play. 서버 강제해지 불가. */
  manageSubscriptionsUrl(): string {
    return isIOS()
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
  },

  /** productId(plus_monthly/plus_yearly) 구매. 네이티브 전용. */
  async purchase(userId: string, productId: string): Promise<PurchaseResult> {
    if (!this.isNativeBilling()) return { ok: false, active: false, error: 'native billing unavailable' };
    if (isIOS()) return iosPurchase(userId, productId); // iOS=RC JS / Android=NativeBilling
    try {
      const opts: ConfigOpts = { apiKey: activeApiKey(), appUserId: userId };
      const wantsYear = /year|annual/i.test(productId);
      const res = await withTimeout(
        wantsYear ? NativeBilling.purchaseAnnual(opts) : NativeBilling.purchaseMonthly(opts),
        180000,
        'purchase',
      );
      if (res.cancelled) return { ok: false, active: false, canceled: true };
      if (res.ok) return { ok: true, active: !!res.active };
      return { ok: false, active: false, error: res.error || 'purchase failed' };
    } catch (e) {
      return { ok: false, active: false, error: (e as Error).message };
    }
  },

  /** 구매 복원 (기기 변경·재설치). 'plus' 활성 여부 반환. */
  async restore(userId: string): Promise<PurchaseResult> {
    if (!this.isNativeBilling()) return { ok: false, active: false };
    if (isIOS()) return iosRestore(userId);
    try {
      const res = await withTimeout(
        NativeBilling.restorePurchases({ apiKey: activeApiKey(), appUserId: userId }),
        30000,
        'restore',
      );
      return { ok: !!res.ok, active: !!res.active, error: res.error };
    } catch (e) {
      return { ok: false, active: false, error: (e as Error).message };
    }
  },

  /** productId 의 로컬라이즈 가격 문자열(예: '₩3,900') — 스토어 실제가. 없으면 null. */
  async getPriceString(userId: string, productId: string): Promise<string | null> {
    if (!this.isNativeBilling()) return null;
    if (isIOS()) return iosGetPrice(userId, productId);
    try {
      const res = await withTimeout(
        NativeBilling.getPrices({ apiKey: activeApiKey(), appUserId: userId }),
        15000,
        'getPrices',
      );
      if (!res.ok) return null;
      return /year|annual/i.test(productId) ? res.annual ?? null : res.monthly ?? null;
    } catch {
      return null;
    }
  },

  /** 현재 'plus' 엔타이틀먼트 활성 여부 조회 (로그인 후 동기화 보조용). */
  async hasActiveEntitlement(userId: string): Promise<boolean> {
    if (!this.isNativeBilling()) return false;
    if (isIOS()) return iosHasEntitlement(userId);
    try {
      const res = await withTimeout(
        NativeBilling.getCustomerStatus({ apiKey: activeApiKey(), appUserId: userId }),
        15000,
        'status',
      );
      return !!res.active;
    } catch {
      return false;
    }
  },
};
