'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PLANS, PlanType } from '@/lib/plans';
import { Loader2, CreditCard, ArrowLeft } from 'lucide-react';
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk';

// 결제위젯 연동 키 (개발자센터 > 결제위젯 연동 키 > 클라이언트 키)
const clientKey = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";

function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const plan = searchParams.get('plan') as PlanType;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [widgets, setWidgets] = useState<any>(null);

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
  }, [user, plan, authLoading, router]);

  // 1단계: SDK 초기화 (공식 샘플 코드와 동일)
  useEffect(() => {
    if (authLoading || !user || !plan || !(plan in PLANS) || plan === 'free') return;

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
  }, [user, authLoading, plan]);

  // 2단계: 위젯 렌더링 (공식 샘플 코드와 동일)
  useEffect(() => {
    if (widgets == null || !plan || !(plan in PLANS)) return;

    async function renderPaymentWidgets() {
      try {
        const amount = PLANS[plan].price;

        // 결제 금액 설정 (반드시 renderPaymentMethods보다 먼저)
        await widgets.setAmount({
          currency: 'KRW',
          value: amount,
        });

        // 결제 UI 렌더링
        await widgets.renderPaymentMethods({
          selector: '#payment-method',
          variantKey: 'DEFAULT',
        });

        // 이용약관 UI 렌더링
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
  }, [widgets, plan]);

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
          {!ready && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="animate-spin text-blue-500 mr-2" size={20} />
              <span className="text-sm text-gray-500">결제 위젯 로딩 중...</span>
            </div>
          )}

          {/* 결제 UI */}
          <div id="payment-method" className="mb-4" />
          {/* 이용약관 UI */}
          <div id="agreement" className="mb-6" />

          {ready && (
            <button
              disabled={!ready}
              onClick={async () => {
                if (!widgets || !user) return;
                try {
                  const orderId = `pawdex_${user.id.slice(0, 8)}_${plan}_${Date.now()}`;
                  await widgets.requestPayment({
                    orderId,
                    orderName: `PawDex ${PLANS[plan].name} 구독`,
                    successUrl: window.location.origin + '/payment/success',
                    failUrl: window.location.origin + '/payment/fail',
                    customerEmail: user.email || undefined,
                  });
                } catch (err) {
                  console.error(err);
                }
              }}
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
