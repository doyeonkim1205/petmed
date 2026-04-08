'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CreditCard, ArrowLeft, ShieldCheck } from 'lucide-react';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import type { PaymentProduct } from '@/lib/products';

// 결제위젯 연동 키 (개발자센터 > 결제위젯 연동 키 > 클라이언트 키)
const clientKey = 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';

interface Props {
  product: PaymentProduct | null;
}

export default function PaymentClient({ product }: Props) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [widgets, setWidgets] = useState<any>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!product) {
      router.push('/pricing');
      return;
    }
  }, [user, product, authLoading, router]);

  // 1단계: SDK 초기화
  useEffect(() => {
    if (authLoading || !user || !product) return;

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
  }, [user, authLoading, product]);

  // 2단계: 위젯 렌더링
  useEffect(() => {
    if (widgets == null || !product) return;

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
  }, [widgets, product]);

  // 결제 진행 중일 때 새로고침/탭 닫기/뒤로 가기 방지
  useEffect(() => {
    if (!processing) return;

    // 1) 새로고침/탭 닫기 차단 → 브라우저 기본 경고 다이얼로그 표시
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // 일부 브라우저는 returnValue 가 채워져 있어야 동작함
      e.returnValue = '';
    };

    // 2) 뒤로 가기 차단 (Android 백버튼 포함)
    //    history 에 더미 상태를 하나 push 한 뒤, popstate 가 발생하면 다시 push 하여 복구
    window.history.pushState({ paymentLock: true }, '');
    const handlePopState = () => {
      if (
        window.confirm('결제가 진행 중입니다. 정말로 페이지를 떠나시겠습니까?\n결제가 취소될 수 있습니다.')
      ) {
        setProcessing(false);
        router.push('/pricing');
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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  const periodLabel = product?.period === 'year' ? '/년' : '/월';

  const handlePayment = async () => {
    if (!widgets || !user || !product || processing) return;
    setProcessing(true);
    try {
      // orderId format: pawdex_{userIdShort}_{productId}_{timestamp}
      const orderId = `pawdex_${user.id.slice(0, 8)}_${product.id}_${Date.now()}`;
      await widgets.requestPayment({
        orderId,
        orderName: product.name,
        successUrl: window.location.origin + '/payment/success',
        failUrl: window.location.origin + '/payment/fail',
        customerEmail: user.email || undefined,
      });
      // requestPayment 가 정상적으로 successUrl 로 이동하면 이 코드는 실행되지 않음.
      // 사용자가 결제창을 닫거나 실패하면 catch 또는 여기서 락 해제.
      setProcessing(false);
    } catch (err) {
      console.error(err);
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <ArrowLeft size={16} /> 돌아가기
      </button>

      {product && (
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

          <div id="payment-method" className="mb-4" />
          <div id="agreement" className="mb-6" />

          {ready && product && (
            <button
              disabled={!ready || processing}
              onClick={handlePayment}
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
          // 백그라운드 클릭으로 닫히지 않도록 (이벤트 차단)
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
