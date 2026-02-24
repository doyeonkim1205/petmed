'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

function SuccessContent() {
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
        setMessage('결제 정보가 올바르지 않습니다.');
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
          setMessage(`${data.plan === 'premium' ? 'Premium' : 'Basic'} 구독이 시작되었습니다!`);
          // Refresh profile to get updated plan
          await refreshProfile();
        } else {
          setStatus('error');
          setMessage(data.error || '결제 승인에 실패했습니다.');
        }
      } catch {
        setStatus('error');
        setMessage('결제 처리 중 오류가 발생했습니다.');
      }
    };

    confirm();
  }, [searchParams, refreshProfile]);

  return (
    <div className="max-w-sm mx-auto px-4 py-16 text-center">
      {status === 'loading' && (
        <>
          <Loader2 className="animate-spin text-blue-500 mx-auto mb-4" size={48} />
          <h2 className="text-lg font-bold text-gray-800 mb-2">결제 승인 중...</h2>
          <p className="text-sm text-gray-400">잠시만 기다려주세요.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">결제 완료!</h2>
          <p className="text-sm text-gray-500 mb-8">{message}</p>
          <button
            onClick={() => router.push('/profile')}
            className="px-8 py-3 bg-blue-600 text-white rounded-full text-sm font-medium"
          >
            프로필로 이동
          </button>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle size={32} className="text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">결제 실패</h2>
          <p className="text-sm text-gray-500 mb-8">{message}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/pricing')}
              className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-full text-sm font-medium"
            >
              요금제 보기
            </button>
            <button
              onClick={() => router.back()}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium"
            >
              다시 시도
            </button>
          </div>
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
