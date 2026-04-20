'use client';

import { useEffect } from 'react';
import { RefreshCw, Home } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center max-w-xs">
        <Image
          src="/icons/api_error_500.svg"
          alt="에러 일러스트"
          width={200}
          height={200}
          className="mx-auto mb-4"
        />
        <h2 className="text-base font-bold text-gray-900 mb-2">앗, 잠시 문제가 발생했어요!</h2>
        <p className="text-xs text-gray-500 leading-relaxed mb-6">
          데이터를 불러오는 중 오류가 발생했습니다.<br />
          잠시 후 다시 시도해 주세요.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-full text-xs font-medium hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={14} />
            다시 시도
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 border border-gray-200 text-gray-600 rounded-full text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            <Home size={14} />
            홈으로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
