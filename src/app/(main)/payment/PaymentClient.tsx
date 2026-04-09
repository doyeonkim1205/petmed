'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CreditCard, ArrowLeft, ShieldCheck, RefreshCw, Check } from 'lucide-react';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import type { PaymentProduct } from '@/lib/products';

// 결제위젯 클라이언트 키 — 환경별로 다른 값 (Preview=test, Production=live)
const clientKey = process.env.NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY!;

interface Props {
  product: PaymentProduct | null;
}

type BillingMode = 'recurring' | 'one_time';

export default function PaymentClient({ product }: Props) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [widgets, setWidgets] = useState<any>(null);

  // Monthly products default to recurring (better UX), yearly is always one-time.
  const supportsRecurring = product?.period === 'month';
  const [billingMode, setBillingMode] = useState<BillingMode>(
    supportsRecurring ? 'recurring' : 'one_time',
  );
  const [recurringConsent, setRecurringConsent] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!product) {
      router.push('/profile/subscription');
      return;
    }
  }, [user, product, authLoading, router]);

  // 1단계: SDK 초기화 (one-time only — recurring uses a different page)
  useEffect(() => {
    if (authLoading || !user || !product) return;
    if (billingMode !== 'one_time') return;

    async function fetchPaymentWidgets() {
      try {
        const tossPayments = await loadTossPayments(clientKey);
        const widgets = tossPayments.widgets({
          customerKey: user!.id,
        });
        setWidgets(widgets);
      } catch (err) {
        console.error('Error fetching payment widget:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setError(`결제 위젯 초기화 실패: ${msg}`);
      }
    }

    fetchPaymentWidgets();
  }, [user, authLoading, product, billingMode]);

  // 2단계: 위젯 렌더링
  useEffect(() => {
    if (widgets == null || !product) return;
    if (billingMode !== 'one_time') return;

    async function renderPaymentWidgets() {
      try {
        await widgets.setAmount({
          currency: 'KRW',
          value: product!.price,
        });

        await widgets.renderPaymentMethods({
          selector: '#payment-method',
          variantKey: 'DEFAULT',
        });

        await widgets.renderAgreement({
          selector: '#agreement',
          variantKey: 'AGREEMENT',
        });

        setReady(true);
      } catch (err) {
        console.error('Error rendering payment widgets:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setError(`결제 위젯 렌더링 실패: ${msg}`);
      }
    }

    renderPaymentWidgets();
  }, [widgets, product, billingMode]);

  // 결제 진행 중일 때 새로고침/탭 닫기/뒤로 가기 방지
  useEffect(() => {
    if (!processing) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.history.pushState({ paymentLock: true }, '');
    const handlePopState = () => {
      if (
        window.confirm('결제가 진행 중입니다. 정말로 페이지를 떠나시겠습니까?\n결제가 취소될 수 있습니다.')
      ) {
        setProcessing(false);
        router.push('/profile/subscription');
      } else {
        window.history.pushState({ paymentLock: true }, '');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [processing, router]);

  if (authLoading || !product) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  const periodLabel = product.period === 'year' ? '/년' : '/월';

  const handleOneTimePayment = async () => {
    if (!widgets || !user || processing) return;
    setProcessing(true);
    try {
      const orderId = `pawdex_${user.id.slice(0, 8)}_${product.id}_${Date.now()}`;
      await widgets.requestPayment({
        orderId,
        orderName: product.name,
        successUrl: window.location.origin + '/payment/success',
        failUrl: window.location.origin + '/payment/fail',
        customerEmail: user.email || undefined,
      });
      setProcessing(false);
    } catch (err) {
      console.error(err);
      setProcessing(false);
    }
  };

  const handleStartRecurring = () => {
    if (!recurringConsent) return;
    router.push(`/payment/billing-auth?productId=${product.id}`);
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <ArrowLeft size={16} /> 돌아가기
      </button>

      <div className="bg-gray-50 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard size={18} className="text-blue-500" />
          <h2 className="text-base font-bold text-gray-800">결제 정보</h2>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>{product.name}</span>
          <span className="font-bold">₩{product.price.toLocaleString()}{periodLabel}</span>
        </div>
        {product.description && (
          <p className="text-xs text-gray-400 mt-2">{product.description}</p>
        )}
      </div>

      {/* Billing mode toggle (monthly only) */}
      {supportsRecurring && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-gray-700">결제 방식</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setBillingMode('recurring')}
              className={`p-3 rounded-xl border text-left transition-colors ${
                billingMode === 'recurring'
                  ? 'border-blue-400 bg-blue-50/50 ring-1 ring-blue-200'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <RefreshCw size={12} className={billingMode === 'recurring' ? 'text-blue-500' : 'text-gray-400'} />
                <span className={`text-xs font-bold ${billingMode === 'recurring' ? 'text-blue-700' : 'text-gray-500'}`}>
                  자동 갱신
                </span>
              </div>
              <p className={`text-[10px] leading-relaxed ${billingMode === 'recurring' ? 'text-blue-600' : 'text-gray-400'}`}>
                매월 자동 결제<br />언제든 해지 가능
              </p>
            </button>
            <button
              onClick={() => setBillingMode('one_time')}
              className={`p-3 rounded-xl border text-left transition-colors ${
                billingMode === 'one_time'
                  ? 'border-blue-400 bg-blue-50/50 ring-1 ring-blue-200'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Check size={12} className={billingMode === 'one_time' ? 'text-blue-500' : 'text-gray-400'} />
                <span className={`text-xs font-bold ${billingMode === 'one_time' ? 'text-blue-700' : 'text-gray-500'}`}>
                  1회 결제
                </span>
              </div>
              <p className={`text-[10px] leading-relaxed ${billingMode === 'one_time' ? 'text-blue-600' : 'text-gray-400'}`}>
                30일 이용권<br />만료 후 자동 종료
              </p>
            </button>
          </div>
        </div>
      )}

      {error ? (
        <div className="text-center py-10">
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.push('/profile/subscription')}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium"
          >
            요금제 페이지로 이동
          </button>
        </div>
      ) : billingMode === 'recurring' ? (
        // ── Recurring (auto-renewal) flow ──
        <>
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 mb-4 text-xs text-gray-600 leading-relaxed">
            <p className="font-semibold text-blue-700 mb-1.5">자동 결제 안내</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>다음 단계에서 카드 정보를 등록하면 즉시 ₩{product.price.toLocaleString()}이 결제됩니다.</li>
              <li>이후 매월 같은 날 자동으로 ₩{product.price.toLocaleString()}이 결제됩니다.</li>
              <li>요금제 페이지에서 언제든지 자동 갱신을 끌 수 있습니다.</li>
            </ul>
          </div>

          <label className="flex items-start gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={recurringConsent}
              onChange={(e) => setRecurringConsent(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-blue-600"
            />
            <span className="text-xs text-gray-600 leading-relaxed">
              매월 자동 결제 진행에 동의합니다. (필수)
            </span>
          </label>

          <button
            onClick={handleStartRecurring}
            disabled={!recurringConsent}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
          >
            카드 등록하고 시작하기
          </button>
        </>
      ) : (
        // ── One-time payment flow (existing widget) ──
        <>
          {!ready && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="animate-spin text-blue-500 mr-2" size={20} />
              <span className="text-sm text-gray-500">결제 위젯 로딩 중...</span>
            </div>
          )}

          <div id="payment-method" className="mb-4" />
          <div id="agreement" className="mb-6" />

          {ready && (
            <button
              disabled={!ready || processing}
              onClick={handleOneTimePayment}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  결제 진행 중...
                </>
              ) : (
                `₩${product.price.toLocaleString()} 결제하기`
              )}
            </button>
          )}
        </>
      )}

      {/* 결제 진행 중 전체 화면 락 오버레이 */}
      {processing && (
        <div
          className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center px-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-xl text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
              <ShieldCheck className="text-blue-500" size={24} />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">결제 진행 중</h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              결제가 완료될 때까지 페이지를 이동하거나<br />
              새로고침하지 마세요.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-blue-500">
              <Loader2 size={14} className="animate-spin" />
              <span>토스 결제창을 확인해 주세요</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
