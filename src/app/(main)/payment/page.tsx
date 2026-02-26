'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PLANS, PlanType } from '@/lib/plans';
import { Loader2, CreditCard, ArrowLeft } from 'lucide-react';
import Script from 'next/script';

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';

function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const plan = searchParams.get('plan') as PlanType;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentWidgetRef = useRef<any>(null);

  useEffect(() => {
    if (authLoading || !scriptReady) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!plan || !(plan in PLANS) || plan === 'free') {
      router.push('/pricing');
      return;
    }

    const initWidget = () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const PaymentWidget = (window as any).PaymentWidget;
        if (!PaymentWidget) {
          setError('결제 위젯 스크립트를 불러오지 못했습니다.');
          setLoading(false);
          return;
        }

        const customerKey = user.id;
        const paymentWidget = PaymentWidget(CLIENT_KEY, customerKey);
        const amount = PLANS[plan].price;

        paymentWidget.renderPaymentMethods('#payment-method', amount);
        paymentWidget.renderAgreement('#agreement');

        paymentWidgetRef.current = paymentWidget;
        setLoading(false);
      } catch (err: unknown) {
        console.error('Toss widget init error:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setError(`결제 위젯을 불러오는데 실패했습니다. (${msg})`);
        setLoading(false);
      }
    };

    const timer = setTimeout(initWidget, 200);
    return () => clearTimeout(timer);
  }, [user, plan, authLoading, router, scriptReady]);

  const handleCheckout = async () => {
    const paymentWidget = paymentWidgetRef.current;
    if (!paymentWidget || !user) return;

    const orderId = `pawdex_${user.id.slice(0, 8)}_${plan}_${Date.now()}`;

    try {
      await paymentWidget.requestPayment({
        orderId,
        orderName: `PawDex ${PLANS[plan].name} 구독`,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: user.email || undefined,
      });
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code === 'USER_CANCEL') return;
      console.error('Payment request error:', err);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  const planConfig = plan && plan in PLANS ? PLANS[plan] : null;

  return (
    <>
      <Script
        src="https://js.tosspayments.com/v1/payment-widget"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => {
          setError('결제 스크립트를 불러오는데 실패했습니다.');
          setLoading(false);
        }}
      />
      <div className="max-w-sm mx-auto px-4 py-6">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 mb-6">
          <ArrowLeft size={16} /> 돌아가기
        </button>

        {planConfig && (
          <div className="bg-gray-50 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard size={18} className="text-blue-500" />
              <h2 className="text-base font-bold text-gray-800">결제 정보</h2>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>PawDex {planConfig.name} 구독</span>
              <span className="font-bold">₩{planConfig.price.toLocaleString()}/월</span>
            </div>
          </div>
        )}

        {error ? (
          <div className="text-center py-10">
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <button
              onClick={() => router.push('/pricing')}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium"
            >
              요금제 페이지로 이동
            </button>
          </div>
        ) : (
          <>
            {loading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="animate-spin text-blue-500 mr-2" size={20} />
                <span className="text-sm text-gray-500">결제 위젯 로딩 중...</span>
              </div>
            )}

            <div id="payment-method" className="mb-4" />
            <div id="agreement" className="mb-6" />

            {!loading && (
              <button
                onClick={handleCheckout}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {planConfig ? `₩${planConfig.price.toLocaleString()} 결제하기` : '결제하기'}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-gray-400" size={24} /></div>}>
      <PaymentContent />
    </Suspense>
  );
}
