'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import Image from 'next/image';
import * as Sentry from '@sentry/nextjs';

export default function LegalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  useEffect(() => {
    Sentry.captureException(error);
    console.error('Legal page error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center max-w-xs">
        <Image
          src="/icons/error-illustration.svg"
          alt={t('illustAlt')}
          width={200}
          height={200}
          className="mx-auto mb-4"
        />
        <h2 className="text-base font-bold text-gray-900 mb-2">{t('title')}</h2>
        <p className="text-xs text-gray-500 leading-relaxed mb-6">
          {t.rich('body', { br: () => <br /> })}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-full text-xs font-medium"
        >
          <RefreshCw size={14} />
          {t('retry')}
        </button>
      </div>
    </div>
  );
}
