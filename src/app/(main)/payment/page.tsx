'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PLANS, PlanType } from '@/lib/plans';
import { Loader2, CreditCard, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Script from 'next/script';

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_Z1aOwX7K8mjPg65gpkeQ3yQxzvNP';

function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const plan = searchParams.get('plan') as PlanType;
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

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

  const handleCheckout = async () => {
    if (!user || !plan || paying) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const TossPayments = (window as any).TossPayments;
    if (!TossPayments) {
      setError('결제 모듈을 불러오지 못했습니다. 새로고침 해주세요.');
      return;
    }

    setPaying(true);
    setError(null);

    try {
      const tossPayments = TossPayments(CLIENT_KEY);
      const orderId = `pawdex_${user.id.slice(0, 8)}_${plan}_${Date.now()}`;
      const amount = PLANS[plan].price;

      await tossPayments.requestPayment('카드', {
        amount,
        orderId,
        orderName: `PawDex ${PLANS[plan].name} 구독`,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: user.email || undefined,
      });
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code === 'USER_CANCEL') {
        setPaying(false);
        return;
      }
      console.error('Payment request error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`결제 요청에 실패했습니다. (${msg})`);
      setPaying(false);
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
        src="https://js.tosspayments.com/v1/payment"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
        onError={() => setError('결제 스크립트를 불러오는데 실패했습니다.')}
      />
      <div className="max-w-sm mx-auto px-4 py-6">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 mb-6">
          <ArrowLeft size={16} /> 돌아가기
        </button>

        {planConfig && (
          <div className="bg-gray-50 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard size={18} className="text-blue-500" />
              <h2 className="text-base font-bold text-gray-800">주문 정보</h2>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">상품</span>
                <span className="text-gray-800 font-medium">PawDex {planConfig.name} 구독</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">결제 금액</span>
                <span className="text-gray-800 font-bold">₩{planConfig.price.toLocaleString()}/월</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200 space-y-1.5">
              {[
                `건강기록 ${planConfig.maxRecords === Infinity ? '무제한' : planConfig.maxRecords + '개'}`,
                `논문 검색 ${planConfig.searchPerDay}회/일`,
                `AI 분석 ${planConfig.aiAnalysis === 'full' ? '상세' : '미리보기'}`,
                `반려동물 ${planConfig.maxPets === Infinity ? '무제한' : planConfig.maxPets + '마리'}`,
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          onClick={handleCheckout}
          disabled={paying || !planConfig || !scriptLoaded}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {paying ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              결제 진행 중...
            </>
          ) : (
            planConfig ? `₩${planConfig.price.toLocaleString()} 결제하기` : '결제하기'
          )}
        </button>

        <p className="text-[11px] text-gray-400 text-center mt-3">
          결제하기 버튼을 누르면 토스페이먼츠 결제창이 열립니다.
        </p>
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
