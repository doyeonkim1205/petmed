'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import { Loader2, CreditCard, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// TEST 키 — 토스 대시보드의 "테스트 클라이언트 키". 일반 결제 LIVE 키와 별개.
const TEST_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_TEST_CLIENT_KEY || '';

// 심사용 3가지 결제 옵션. 실제 LIVE product 와 amount 동일하게 맞춤.
const REVIEW_PRODUCTS = [
  { id: 'plus_onetime', name: 'Plus 30일 (단건)', price: 3900,  period: 'month' },
  { id: 'plus_monthly', name: 'Plus 월간 정기',   price: 3500,  period: 'month' },
  { id: 'plus_yearly',  name: 'Plus 연간',         price: 40000, period: 'year'  },
] as const;

type ReviewProduct = (typeof REVIEW_PRODUCTS)[number];

export default function PaymentReviewClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [selected, setSelected] = useState<ReviewProduct>(REVIEW_PRODUCTS[0]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [widgets, setWidgets] = useState<any>(null);

  // 로그인 필수 — 심사관에게 테스트 계정 (toss-test@toss.com / toss1234!) 제공
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent('/payment-review')}`);
    }
  }, [user, authLoading, router]);

  // SDK 초기화 — TEST 키
  useEffect(() => {
    if (!user) return;
    if (!TEST_CLIENT_KEY) {
      setError('NEXT_PUBLIC_TOSS_TEST_CLIENT_KEY 환경변수가 설정되지 않았습니다.');
      return;
    }
    (async () => {
      try {
        const toss = await loadTossPayments(TEST_CLIENT_KEY);
        setWidgets(toss.widgets({ customerKey: user.id }));
      } catch (err) {
        setError(`결제 위젯 초기화 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
  }, [user]);

  // 선택 상품 변경 시 위젯 재렌더
  useEffect(() => {
    if (!widgets) return;
    (async () => {
      try {
        await widgets.setAmount({ currency: 'KRW', value: selected.price });
        await widgets.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' });
        await widgets.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' });
        setReady(true);
      } catch (err) {
        setError(`위젯 렌더링 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
  }, [widgets, selected]);

  const handlePayment = async () => {
    if (!widgets || !user || processing) return;
    setProcessing(true);
    try {
      await widgets.requestPayment({
        orderId: `review_${user.id.slice(0, 8)}_${selected.id}_${Date.now()}`,
        orderName: `[심사용] ${selected.name}`,
        successUrl: window.location.origin + '/payment-review/success',
        failUrl: window.location.origin + '/payment-review/fail',
        customerEmail: user.email || undefined,
      });
      setProcessing(false);
    } catch (err) {
      console.error(err);
      setProcessing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-6">
        <p className="text-xs font-bold text-yellow-800 mb-1">⚠️ 심사 전용 페이지</p>
        <p className="text-[11px] text-yellow-700 leading-relaxed">
          토스페이먼츠 심사용 결제 시연 페이지입니다. TEST 키를 사용하므로 실제 결제는 발생하지 않습니다.
          결제 성공 후 DB plan 활성화는 진행하지 않습니다 (시연만).
        </p>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <CreditCard size={18} className="text-blue-500" />
        <h2 className="text-base font-bold text-gray-800">결제 상품 선택</h2>
      </div>

      <div className="space-y-2 mb-6">
        {REVIEW_PRODUCTS.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p)}
            className={`w-full text-left rounded-xl border p-3 transition-colors ${
              selected.id === p.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800">{p.name}</span>
              <span className="text-sm font-bold text-gray-900">
                ₩{p.price.toLocaleString()}
              </span>
            </div>
          </button>
        ))}
      </div>

      {error ? (
        <div className="text-center py-10">
          <p className="text-sm text-red-500 mb-4">{error}</p>
        </div>
      ) : (
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
              onClick={handlePayment}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {processing ? (
                <><Loader2 size={16} className="animate-spin" /> 결제 진행 중...</>
              ) : (
                `₩${selected.price.toLocaleString()} 결제 (시연)`
              )}
            </button>
          )}
        </>
      )}

      {processing && (
        <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-xl text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
              <ShieldCheck className="text-blue-500" size={24} />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">결제 진행 중</h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              토스 결제창에서 테스트 카드 정보를 입력해 주세요.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-blue-500">
              <Loader2 size={14} className="animate-spin" />
              <span>토스 결제창 확인 중</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
