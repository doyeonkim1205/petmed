'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CreditCard, ArrowLeft, ShieldCheck } from 'lucide-react';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import * as Sentry from '@sentry/nextjs';
import type { PaymentProduct } from '@/lib/products';

const clientKey = process.env.NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY!;

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
    if (!user) { router.push('/login'); return; }
    if (!product) { router.push('/profile/subscription'); return; }
  }, [user, product, authLoading, router]);

  // SDK 초기화
  useEffect(() => {
    if (authLoading || !user || !product) return;
    async function init() {
      try {
        const toss = await loadTossPayments(clientKey);
        setWidgets(toss.widgets({ customerKey: user!.id }));
      } catch (err) {
        Sentry.captureException(err, {
          tags: { feature: 'payment', action: 'widget-init' },
          extra: { userId: user?.id, productId: product?.id },
        });
        setError(`결제 위젯 초기화 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    init();
  }, [user, authLoading, product]);

  // 위젯 렌더링
  useEffect(() => {
    if (!widgets || !product) return;
    async function render() {
      try {
        await widgets.setAmount({ currency: 'KRW', value: product!.price });
        await widgets.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' });
        await widgets.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' });
        setReady(true);
      } catch (err) {
        Sentry.captureException(err, {
          tags: { feature: 'payment', action: 'widget-render' },
          extra: { productId: product?.id },
        });
        setError(`결제 위젯 렌더링 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    render();
  }, [widgets, product]);

  // 뒤로 가기 방지
  useEffect(() => {
    if (!processing) return;
    window.history.pushState({ paymentLock: true }, '');
    const handlePopState = () => {
      if (window.confirm('결제가 진행 중입니다. 정말로 페이지를 떠나시겠습니까?')) {
        setProcessing(false);
        router.push('/profile/subscription');
      } else {
        window.history.pushState({ paymentLock: true }, '');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [processing, router]);

  if (authLoading || !product) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;
  }

  const periodLabel = product.period === 'year' ? '/년' : '/월';

  const handlePayment = async () => {
    if (!widgets || !user || processing) return;
    setProcessing(true);
    try {
      await widgets.requestPayment({
        orderId: `pawdex_${user.id.slice(0, 8)}_${product.id}_${Date.now()}`,
        orderName: product.name,
        successUrl: window.location.origin + '/payment/success',
        failUrl: window.location.origin + '/payment/fail',
        customerEmail: user.email || undefined,
      });
      setProcessing(false);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'payment', action: 'request-payment' },
        extra: { userId: user.id, productId: product.id, amount: product.price },
      });
      console.error(err);
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-6">
      <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-500 mb-4">
        <ArrowLeft className="w-5 h-5" />
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

      {error ? (
        <div className="text-center py-10">
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button onClick={() => router.push('/profile/subscription')}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium">
            돌아가기
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

          {ready && (
            <button disabled={!ready || processing} onClick={handlePayment}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
              {processing ? (
                <><Loader2 size={16} className="animate-spin" /> 결제 진행 중...</>
              ) : (
                `₩${product.price.toLocaleString()} 결제하기`
              )}
            </button>
          )}
        </>
      )}

      {processing && (
        <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center px-6"
          onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-xl text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
              <ShieldCheck className="text-blue-500" size={24} />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">결제 진행 중</h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              결제가 완료될 때까지 페이지를 이동하거나<br />새로고침하지 마세요.
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
