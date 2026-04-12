'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props {
  authKey: string;
  customerKey: string;
  productId: string;
  mode: string; // 'register' = new subscription + charge, 'enable' = upgrade existing to recurring (no charge)
}

export default function BillingAuthSuccessClient({ authKey, customerKey, productId, mode }: Props) {
  const router = useRouter();
  const calledRef = useRef(false);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    if (!authKey || !customerKey) {
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

        // Choose API based on mode
        const apiUrl = mode === 'enable'
          ? '/api/payments/billing/enable'
          : '/api/payments/billing/register';

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ authKey, customerKey, productId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '처리에 실패했습니다.');

        setStatus('success');
        setSuccessMessage(data.message || (mode === 'enable' ? '자동 결제가 등록되었습니다' : '결제가 완료되었습니다'));

        // Always redirect to subscription page — payment is already confirmed
        // by the register/enable API. Don't go to /payment/success which
        // expects widget-style URL params (paymentKey, orderId, amount).
        setTimeout(() => router.push('/profile/subscription'), 1500);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
      }
    })();
  }, [authKey, customerKey, productId, mode, router]);

  return (
    <div className="max-w-sm mx-auto px-4 py-12 text-center">
      {status === 'loading' && (
        <>
          <Loader2 className="animate-spin text-blue-500 mx-auto mb-4" size={36} />
          <h1 className="text-base font-bold text-gray-900 mb-1">처리 중...</h1>
          <p className="text-sm text-gray-500">잠시만 기다려 주세요.</p>
        </>
      )}
      {status === 'success' && (
        <>
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="text-green-500" size={32} />
          </div>
          <h1 className="text-base font-bold text-gray-900 mb-1">{successMessage}</h1>
          <p className="text-sm text-gray-500">잠시 후 이동합니다...</p>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="text-red-500" size={32} />
          </div>
          <h1 className="text-base font-bold text-gray-900 mb-1">처리에 실패했습니다</h1>
          <p className="text-sm text-red-500 mb-6">{error}</p>
          <button onClick={() => router.push('/profile/subscription')}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium">
            돌아가기
          </button>
        </>
      )}
    </div>
  );
}
