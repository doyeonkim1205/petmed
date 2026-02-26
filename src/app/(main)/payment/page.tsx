'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PLANS, PlanType } from '@/lib/plans';
import { Loader2, CreditCard, ArrowLeft } from 'lucide-react';
import Script from 'next/script';

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_Z1aOwX7K8mjPg65gpkeQ3yQxzvNP';

function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const plan = searchParams.get('plan') as PlanType;
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  const handleCheckout = async () => {
    if (!user || !plan || paying) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const TossPayments = (window as any).TossPayments;
    if (!TossPayments) {
      setError('결제 모듈을 불러오지 못했습니다. 페이지를 새로고침해주세요.');
      return;
    }

    setPaying(true);
    setError(null);

    const orderId = `pawdex_${user.id.slice(0, 8)}_${plan}_${Date.now()}`;
    const amount = PLANS[plan].price;

    try {
      const tossPayments = TossPayments(CLIENT_KEY);
      await tossPayments.requestPayment('카드', {
        amount,
        orderId,
        orderName: `PawDex ${PLANS[plan].name} 구독`,
        customerName: user.user_metadata?.nickname || user.email?.split('@')[0] || '고객',
        customerEmail: user.email || undefined,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      if (e?.code === 'USER_CANCEL') {
        setPaying(false);
        return;
      }
      console.error('Payment error:', err);
      setError(e?.message || '결제 요청 중 오류가 발생했습니다.');
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

  if (!user) {
    router.push('/login');
    return null;
  }

  if (!plan || !(plan in PLANS) || plan === 'free') {
    router.push('/pricing');
    return null;
  }

  const planConfig = PLANS[plan];

  return (
    <>
      <Script
        src="https://js.tosspayments.com/v1/payment"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setError('결제 스크립트를 불러오는데 실패했습니다.')}
      />
      <div className="max-w-sm mx-auto px-4 py-6">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 mb-6">
          <ArrowLeft size={16} /> 돌아가기
        </button>

        <div className="bg-gray-50 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={18} className="text-blue-500" />
            <h2 className="text-base font-bold text-gray-800">결제 정보</h2>
          </div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>상품명</span>
            <span className="font-medium text-gray-800">PawDex {planConfig.name} 구독</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>결제 금액</span>
            <span className="font-bold text-blue-600">₩{planConfig.price.toLocaleString()}/월</span>
          </div>
        </div>

        {/* Plan features summary */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6">
          <h3 className="text-xs font-bold text-gray-500 mb-3">포함 기능</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>건강 기록장 {planConfig.maxRecords === 0 ? '무제한' : `${planConfig.maxRecords}개`}</li>
            <li>논문 검색 {planConfig.searchPerDay}회/일</li>
            <li>AI 분석 {planConfig.aiAnalysis === 'full' ? '상세 분석' : '미리보기'}</li>
            <li>반려동물 {planConfig.maxPets === 0 ? '무제한' : `${planConfig.maxPets}마리`}</li>
          </ul>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleCheckout}
          disabled={paying || !scriptReady}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {paying ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              결제 진행 중...
            </>
          ) : !scriptReady ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              결제 모듈 로딩 중...
            </>
          ) : (
            `₩${planConfig.price.toLocaleString()} 결제하기`
          )}
        </button>

        <p className="text-[11px] text-gray-400 text-center mt-3">
          결제하기 버튼을 누르면 토스페이먼츠 결제창으로 이동합니다.
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
