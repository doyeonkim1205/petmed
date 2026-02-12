'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');

    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) {
            console.error('Auth callback error:', error);
            setError(error.message);
            setTimeout(() => router.replace('/profile'), 2000);
            return;
          }
          // Session is now stored in localStorage by supabase-js
          // onAuthStateChange in AuthContext will fire with SIGNED_IN
          router.replace('/profile');
        });
    } else {
      // No code param, just redirect
      router.replace('/profile');
    }
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <p className="text-red-500 mb-2 text-sm">로그인 오류: {error}</p>
        <p className="text-xs text-gray-400">프로필 페이지로 이동합니다...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <Loader2 className="animate-spin text-blue-500 mb-3" size={32} />
      <p className="text-sm text-gray-600">로그인 처리 중...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen bg-white">
          <Loader2 className="animate-spin text-blue-500 mb-3" size={32} />
          <p className="text-sm text-gray-600">로그인 처리 중...</p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
