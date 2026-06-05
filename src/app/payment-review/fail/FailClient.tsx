'use client';

import { useSearchParams } from 'next/navigation';
import { XCircle } from 'lucide-react';
import Link from 'next/link';

export default function FailClient() {
  const params = useSearchParams();
  const code = params.get('code');
  const message = params.get('message');
  const orderId = params.get('orderId');

  return (
    <div className="max-w-sm mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
          <XCircle className="text-red-500" size={32} />
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">결제 시연 실패</h1>
        <p className="text-xs text-gray-500 leading-relaxed">
          토스페이먼츠 결제창에서 결제가 실패했거나 취소되었습니다.
        </p>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">code</span>
          <span className="text-gray-800 font-mono break-all text-right ml-2">{code || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">message</span>
          <span className="text-gray-800 text-right ml-2 break-all">{message || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">orderId</span>
          <span className="text-gray-800 font-mono break-all text-right ml-2">{orderId || '-'}</span>
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
