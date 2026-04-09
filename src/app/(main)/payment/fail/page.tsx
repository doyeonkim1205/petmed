'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { XCircle, Loader2 } from 'lucide-react';

function FailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const errorCode = searchParams.get('code') || '';
  const errorMessage = searchParams.get('message') || '결제가 취소되었거나 실패했습니다.';

  return (
    <div className="max-w-sm mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <XCircle size={32} className="text-red-400" />
      </div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">결제 실패</h2>
      <p className="text-sm text-gray-500 mb-2">{errorMessage}</p>
      {errorCode && (
        <p className="text-xs text-gray-400 mb-8">오류 코드: {errorCode}</p>
      )}
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => router.push('/profile/subscription')}
          className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-full text-sm font-medium"
        >
          요금제 보기
        </button>
        <button
          onClick={() => router.push('/profile/subscription')}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium"
        >
          다시 시도
        </button>
      </div>
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
