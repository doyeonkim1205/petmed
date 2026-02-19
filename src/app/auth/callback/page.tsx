'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for error in URL params (Google returns error=403 etc.)
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    if (errorParam) {
      const errorDesc = params.get('error_description');
      setError(errorParam === 'access_denied'
        ? '로그인이 취소되었습니다.'
        : errorDesc || `로그인 오류: ${errorParam}`);
      setTimeout(() => router.replace('/login'), 2000);
      return;
    }

    // The Supabase client automatically handles PKCE code exchange
    // via detectSessionInUrl: true during initialization.
    // DO NOT call exchangeCodeForSession manually — OnboardingGate
    // delays this page's mount, so AuthContext's init() triggers
    // _initialize() first and consumes the code_verifier.
    let redirected = false;
    const doRedirect = () => {
      if (redirected) return;
      redirected = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
      router.replace('/');
    };

    // Listen for auth state change (catches SIGNED_IN after subscription)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
          doRedirect();
        }
      }
    );

    // Fallback: session may already exist if exchange completed before mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) doRedirect();
    });

    // Safety timeout
    const timeout = setTimeout(() => {
      if (!redirected) {
        subscription.unsubscribe();
        setError('로그인 처리 시간이 초과되었습니다. 다시 시도해주세요.');
        setTimeout(() => router.replace('/login'), 2000);
      }
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
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
