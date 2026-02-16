'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // With flowType: 'pkce' + detectSessionInUrl: true,
    // supabase-js _initialize() automatically detects ?code= in the URL
    // and exchanges it for a session. We just wait for the result.

    // Safety timeout: if nothing happens in 10s, show error
    const timeout = setTimeout(() => {
      setError('로그인 처리 시간이 초과되었습니다. 다시 시도해주세요.');
      setTimeout(() => router.replace('/login'), 2000);
    }, 10000);

    // Listen for auth state change (SIGNED_IN event)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          clearTimeout(timeout);
          router.replace('/profile');
        }
      }
    );

    // Also check if session already exists (event may have fired before listener)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        clearTimeout(timeout);
        router.replace('/profile');
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <p className="text-red-500 mb-2 text-sm">{error}</p>
        <p className="text-xs text-gray-400">로그인 페이지로 이동합니다...</p>
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
