'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldCheck, ArrowLeft, AlertCircle } from 'lucide-react';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import type { PaymentProduct } from '@/lib/products';

const billingClientKey = process.env.NEXT_PUBLIC_TOSS_BILLING_CLIENT_KEY!;

interface Props {
  product: PaymentProduct | null;
}

export default function BillingAuthClient({ product }: Props) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

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

  const handleStart = async () => {
    if (!user || !product || processing) return;
    setProcessing(true);
    setError(null);
    try {
      const tossPayments = await loadTossPayments(billingClientKey);
      // For billing auth we use the payment instance, not the widget
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payment = (tossPayments as any).payment({ customerKey: user.id });
      await payment.requestBillingAuth({
        method: 'CARD',
        successUrl: `${window.location.origin}/payment/billing-auth/success?productId=${product.id}`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: user.email || undefined,
      });
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`카드 등록창 호출에 실패했습니다: ${msg}`);
      setProcessing(false);
    }
  };

  if (authLoading || !product) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <ArrowLeft size={16} /> 돌아가기
      </button>

      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
          <ShieldCheck className="text-blue-500" size={28} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">자동 갱신 등록</h1>
        <p className="text-sm text-gray-500">
          카드 정보를 등록하면 매월 자동으로 결제됩니다
        </p>
      </div>

      <div className="bg-gray-50 rounded-2xl p-5 mb-6 text-sm">
        <div className="flex justify-between mb-2">
          <span className="text-gray-500">상품</span>
          <span className="font-semibold text-gray-900">{product.name}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-gray-500">결제 금액</span>
          <span className="font-bold text-gray-900">
            ₩{product.price.toLocaleString()} / 월
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">첫 결제</span>
          <span className="text-gray-700">즉시</span>
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 mb-6 text-xs text-gray-600 leading-relaxed">
        <p className="font-semibold text-blue-700 mb-1">자동 결제 안내</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>오늘 ₩{product.price.toLocaleString()}이 즉시 결제됩니다.</li>
          <li>이후 매월 같은 날 자동으로 ₩{product.price.toLocaleString()}이 결제됩니다.</li>
          <li>요금제 페이지에서 언제든지 자동 갱신을 끌 수 있습니다.</li>
          <li>해지 시에도 결제 주기 만료일까지 이용 가능합니다.</li>
        </ul>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 mb-4">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={processing}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            카드 등록창 여는 중...
          </>
        ) : (
          '카드 등록하고 시작하기'
        )}
      </button>

      <p className="text-[11px] text-gray-400 mt-4 text-center leading-relaxed">
        카드 등록을 진행하면 <a href="/terms" className="underline">이용약관</a> 및{' '}
        <a href="/refund" className="underline">환불 정책</a>에 동의하는 것으로 간주됩니다.
      </p>
    </div>
  );
}
