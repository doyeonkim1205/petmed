'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import Image from 'next/image';

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center max-w-xs">
        <Image
          src="/icons/error-illustration.svg"
          alt="에러 일러스트"
          width={200}
          height={200}
          className="mx-auto mb-4"
        />
        <h2 className="text-base font-bold text-gray-900 mb-1">앗, 문제가 발생했어요!</h2>
        <p className="text-xs text-gray-500 mb-6 leading-relaxed">
          일시적인 오류예요. 다시 시도해주세요.<br />
          문제가 계속되면 앱을 새로고침해주세요.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-full text-xs font-medium hover:bg-blue-700 transition-colors"
        >
          <RefreshCw size={14} />
          다시 시도
        </button>
      </div>
    </div>
  );
}
