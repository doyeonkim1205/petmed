'use client';

import { useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function SuccessClient() {
  const params = useSearchParams();
  // 토스 success URL 에 자동 추가되는 쿼리 파라미터
  const paymentKey = params.get('paymentKey');
  const orderId = params.get('orderId');
  const amount = params.get('amount');

  return (
    <div className="max-w-sm mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 className="text-green-500" size={32} />
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">결제 시연 완료</h1>
        <p className="text-xs text-gray-500 leading-relaxed">
          토스페이먼츠 결제 플로우가 정상적으로 동작했습니다.<br />
          심사용 시연이므로 실제 결제 확정(plan 활성화)은 진행되지 않습니다.
        </p>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">paymentKey</span>
          <span className="text-gray-800 font-mono break-all text-right ml-2">{paymentKey || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">orderId</span>
          <span className="text-gray-800 font-mono break-all text-right ml-2">{orderId || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">amount</span>
          <span className="text-gray-800 font-bold">₩{amount ? Number(amount).toLocaleString() : '-'}</span>
        </div>
      </div>

      <Link
        href="/payment-review"
        className="block w-full text-center py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium"
      >
        다시 시연하기
      </Link>
    </div>
  );
}
