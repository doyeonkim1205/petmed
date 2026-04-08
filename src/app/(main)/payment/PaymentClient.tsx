'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CreditCard, ArrowLeft } from 'lucide-react';
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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  const periodLabel = product?.period === 'year' ? '/년' : '/월';

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
              disabled={!ready}
              onClick={async () => {
                if (!widgets || !user) return;
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
                } catch (err) {
                  console.error(err);
                }
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              ₩{product.price.toLocaleString()} 결제하기
            </button>
          )}
        </>
      )}
    </div>
  );
}
