'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props {
  authKey: string;
  customerKey: string;
  productId: string;
}

export default function BillingAuthSuccessClient({ authKey, customerKey, productId }: Props) {
  const router = useRouter();
  const calledRef = useRef(false); // prevent double-call in React StrictMode
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    if (!authKey || !customerKey || !productId) {
      setStatus('error');
      setError('필수 정보가 누락되었습니다.');
      return;
    }

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setStatus('error');
          setError('세션이 만료되었습니다. 다시 로그인해주세요.');
          return;
        }

        const res = await fetch('/api/payments/billing/register', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ authKey, customerKey, productId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '결제에 실패했습니다.');

        setStatus('success');
        // Brief delay so the user sees the success state
        setTimeout(() => router.push('/payment/success'), 1500);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : '결제 처리 중 오류가 발생했습니다.');
      }
    })();
  }, [authKey, customerKey, productId, router]);

  return (
    <div className="max-w-sm mx-auto px-4 py-12 text-center">
      {status === 'loading' && (
        <>
          <Loader2 className="animate-spin text-blue-500 mx-auto mb-4" size={36} />
          <h1 className="text-base font-bold text-gray-900 mb-1">결제 처리 중...</h1>
          <p className="text-sm text-gray-500">잠시만 기다려 주세요.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="text-green-500" size={32} />
          </div>
          <h1 className="text-base font-bold text-gray-900 mb-1">자동 갱신이 등록되었습니다</h1>
          <p className="text-sm text-gray-500">잠시 후 이동합니다...</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="text-red-500" size={32} />
          </div>
          <h1 className="text-base font-bold text-gray-900 mb-1">결제에 실패했습니다</h1>
          <p className="text-sm text-red-500 mb-6">{error}</p>
          <button
            onClick={() => router.push('/profile/subscription')}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium"
          >
            요금제 페이지로 돌아가기
          </button>
        </>
      )}
    </div>
  );
}
