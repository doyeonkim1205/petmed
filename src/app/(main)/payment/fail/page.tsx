'use client';

import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

function FailContent() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const errorCode = searchParams.get('code') || '';
  const errorMessage = searchParams.get('message') || t('payment.failDefault');

  return (
    <div className="max-w-sm mx-auto px-4 py-12 text-center">
      <Image
        src="/icons/Robotics-pana.svg"
        alt={t('payment.failAlt')}
        width={180}
        height={180}
        className="mx-auto mb-4"
      />
      <h2 className="text-base font-bold text-gray-900 mb-2">{t('payment.failTitle')}</h2>
      <p className="text-xs text-gray-500 mb-1">{errorMessage}</p>
      {errorCode && (
        <p className="text-[10px] text-gray-400 mb-6">{t('payment.errorCode', { code: errorCode })}</p>
      )}
      {!errorCode && <div className="mb-6" />}
      <button
        onClick={() => router.push('/profile/subscription')}
        className="px-8 py-3 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        {t('common.retry')}
      </button>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-gray-400" size={24} /></div>}>
      <FailContent />
    </Suspense>
  );
}
