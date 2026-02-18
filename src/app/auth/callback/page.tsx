'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for error in URL params (Google returns error=403 etc.)
        const params = new URLSearchParams(window.location.search);
        const errorParam = params.get('error');
        const errorDesc = params.get('error_description');
        if (errorParam) {
          setError(errorDesc || `로그인 오류: ${errorParam}`);
          setTimeout(() => router.replace('/login'), 2000);
          return;
        }

        // Explicit PKCE code exchange for mobile compatibility
        const code = params.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('Code exchange error:', exchangeError);
            setError('로그인 처리에 실패했습니다. 다시 시도해주세요.');
            setTimeout(() => router.replace('/login'), 2000);
            return;
          }
          router.replace('/profile');
          return;
        }

        // Fallback: check if session already exists (hash-based flow)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          router.replace('/profile');
          return;
        }

        // Listen for auth state change as last resort
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              clearTimeout(timeout);
              subscription.unsubscribe();
              router.replace('/profile');
            }
          }
        );

        // Safety timeout
        const timeout = setTimeout(() => {
          subscription.unsubscribe();
          setError('로그인 처리 시간이 초과되었습니다. 다시 시도해주세요.');
          setTimeout(() => router.replace('/login'), 2000);
        }, 10000);
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('로그인 처리 중 오류가 발생했습니다.');
        setTimeout(() => router.replace('/login'), 2000);
      }
    };

    handleCallback();
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
