'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PLANS, PlanType } from '@/lib/plans';
import { Loader2, CreditCard, ArrowLeft } from 'lucide-react';
import { loadPaymentWidget, PaymentWidgetInstance } from '@tosspayments/payment-widget-sdk';

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq';

function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const plan = searchParams.get('plan') as PlanType;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paymentWidgetRef = useRef<PaymentWidgetInstance | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!plan || !(plan in PLANS) || plan === 'free') {
      router.push('/pricing');
      return;
    }

    const initWidget = async () => {
      try {
        const paymentWidget = await loadPaymentWidget(CLIENT_KEY, user.id);

        const amount = PLANS[plan].price;

        paymentWidget.renderPaymentMethods('#payment-method', amount);
        paymentWidget.renderAgreement('#agreement');

        paymentWidgetRef.current = paymentWidget;
        setLoading(false);
      } catch (err: any) {
        console.error('Toss widget load error:', err);
        const msg = err?.message || String(err);
        setError(`결제 위젯을 불러오는데 실패했습니다. (${msg})`);
        setLoading(false);
      }
    };

    // Small delay for DOM mount
    const timer = setTimeout(initWidget, 100);
    return () => clearTimeout(timer);
  }, [user, plan, authLoading, router]);

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
    } catch (err: any) {
      if (err?.code === 'USER_CANCEL') return;
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
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-gray-400" size={24} /></div>}>
      <PaymentContent />
    </Suspense>
  );
}
