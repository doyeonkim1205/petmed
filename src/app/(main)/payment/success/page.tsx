'use client';

import { useEffect, useState, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, Loader2 } from 'lucide-react';

function SuccessContent() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const confirm = async () => {
      const paymentKey = searchParams.get('paymentKey');
      const orderId = searchParams.get('orderId');
      const amount = searchParams.get('amount');

      if (!paymentKey || !orderId || !amount) {
        setStatus('error');
        setMessage(t('payment.invalidInfo'));
        return;
      }

      try {
        const { authFetch } = await import('@/lib/authFetch');
        const res = await authFetch('/api/payments/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: Number(amount),
          }),
        });

        const data = await res.json();

        if (res.ok) {
          setStatus('success');
          setMessage(t('payment.subStarted'));
          // Refresh profile to get updated plan
          await refreshProfile();
        } else {
          setStatus('error');
          setMessage(data.error || t('payment.confirmFail'));
        }
      } catch {
        setStatus('error');
        setMessage(t('payment.processError'));
      }
    };

    confirm();
  }, [searchParams, refreshProfile]);

  return (
    <div className="max-w-sm mx-auto px-4 py-16 text-center">
      {status === 'loading' && (
        <>
          <Loader2 className="animate-spin text-blue-500 mx-auto mb-4" size={48} />
          <h2 className="text-lg font-bold text-gray-800 mb-2">{t('payment.approving')}</h2>
          <p className="text-sm text-gray-400">{t('payment.pleaseWait')}</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">{t('payment.complete')}</h2>
          <p className="text-sm text-gray-500 mb-8">{message}</p>
          <button
            onClick={() => router.push('/profile')}
            className="px-8 py-3 bg-blue-600 text-white rounded-full text-sm font-medium"
          >
            {t('payment.toProfile')}
          </button>
        </>
      )}

      {status === 'error' && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/Robotics-pana.svg" alt={t('payment.failAlt')} width={180} height={180} className="mx-auto mb-4" />
          <h2 className="text-base font-bold text-gray-900 mb-2">{t('payment.failTitle')}</h2>
          <p className="text-xs text-gray-500 mb-6">{message}</p>
          <button
            onClick={() => router.push('/profile/subscription')}
            className="px-8 py-3 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {t('common.retry')}
          </button>
        </>
      )}
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-gray-400" size={24} /></div>}>
      <SuccessContent />
    </Suspense>
  );
}
