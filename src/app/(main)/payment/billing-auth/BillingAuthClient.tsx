'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import * as Sentry from '@sentry/nextjs';
import type { PaymentProduct } from '@/lib/products';

const billingClientKey = process.env.NEXT_PUBLIC_TOSS_BILLING_CLIENT_KEY!;

interface Props {
  product: PaymentProduct | null;
  mode?: string; // 'enable' = upgrade to recurring (no charge), default = new subscription
}

export default function BillingAuthClient({ product, mode = 'register' }: Props) {
  const t = useTranslations();
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
      router.push('/profile/subscription');
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
        successUrl: `${window.location.origin}/payment/billing-auth/success?productId=${product.id}&mode=${mode}`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: user.email || undefined,
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'billing', action: 'request-billing-auth' },
        extra: { userId: user.id, productId: product.id, mode },
      });
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(t('payment.authFail', { msg }));
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
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
          <ShieldCheck className="text-blue-500" size={28} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">{t('payment.authTitle')}</h1>
        <p className="text-sm text-gray-500">
          {t('payment.authSubtitle')}
        </p>
      </div>

      <div className="bg-gray-50 rounded-2xl p-5 mb-6 text-sm">
        <div className="flex justify-between mb-2">
          <span className="text-gray-500">{t('payment.product')}</span>
          <span className="font-semibold text-gray-900">{product.name}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-gray-500">{t('payment.amount')}</span>
          <span className="font-bold text-gray-900">
            {t('payment.pricePerMonth', { price: product.price.toLocaleString() })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{t('payment.firstCharge')}</span>
          <span className="text-gray-700">{t('payment.immediately')}</span>
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 mb-6 text-xs text-gray-600 leading-relaxed">
        <p className="font-semibold text-blue-700 mb-1">{t('payment.autoInfoTitle')}</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>{t('payment.autoInfo1', { price: product.price.toLocaleString() })}</li>
          <li>{t('payment.autoInfo2', { price: product.price.toLocaleString() })}</li>
          <li>{t('payment.autoInfo3')}</li>
          <li>{t('payment.autoInfo4')}</li>
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
            {t('payment.authOpening')}
          </>
        ) : (
          t('payment.authCta')
        )}
      </button>

      <p className="text-[11px] text-gray-400 mt-4 text-center leading-relaxed">
        {t.rich('payment.agreement', {
          terms: (c) => <a href="/terms" className="underline">{c}</a>,
          refund: (c) => <a href="/refund" className="underline">{c}</a>,
        })}
      </p>
    </div>
  );
}
