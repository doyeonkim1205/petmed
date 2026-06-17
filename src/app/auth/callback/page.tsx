'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { BrandLoading } from '@/components/BrandLoading';

export default function AuthCallbackPage() {
  const router = useRouter();
  const t = useTranslations('auth');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for error in URL params (Google returns error=403 etc.)
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    if (errorParam) {
      const errorDesc = params.get('error_description');
      setError(errorParam === 'access_denied'
        ? t('loginCancelled')
        : errorDesc || t('loginError', { error: errorParam }));
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
        setError(t('loginTimeout'));
        setTimeout(() => router.replace('/login'), 2000);
      }
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router, t]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white px-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-512x512.png" alt="PawDex" className="w-16 h-16 rounded-[22%] mb-4 opacity-80" />
        <p className="text-red-500 mb-2 text-sm">{error}</p>
        <p className="text-xs text-gray-400">{t('redirectingToLogin')}</p>
      </div>
    );
  }

  // 로딩 화면 — (main) 가드와 동일한 BrandLoading 으로 통일(로그인 시 깜박임 제거).
  return <BrandLoading />;
}
