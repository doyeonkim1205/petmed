'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';

function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|Snapchat|Twitter|Android.*wv\)/.test(ua);
}

export default function LoginPage() {
  const [error, setError] = useState('');
  const [inApp, setInApp] = useState(false);
  const { signInWithGoogle, signInWithKakao } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setInApp(isInAppBrowser());
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'session_evicted') {
      setError('다른 기기에서 로그인하여 현재 세션이 종료되었습니다.');
    }
  }, []);

  const handleGoogleLogin = async () => {
    if (inApp) {
      const loginUrl = `${window.location.origin}/login`;
      window.location.href = `intent://${window.location.host}/login#Intent;scheme=https;end`;
      setTimeout(() => { window.open(loginUrl, '_system'); }, 500);
      return;
    }
    setError('');
    // 구글 로그인은 브라우저 OAuth라 시스템 다크모드 영향 받음 → 콜백 후 안내 트리거
    try { localStorage.setItem('darkModeHintTrigger', 'true'); } catch {}
    const { error } = await signInWithGoogle();
    if (error) setError(error.message);
  };

  const handleKakaoLogin = async () => {
    setError('');
    const { error } = await signInWithKakao();
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center px-4 py-3 border-b">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold pr-8">시작하기</h1>
      </header>

      <div className="flex-1 px-6 py-8 flex flex-col items-center justify-center">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">환영합니다!</h2>
          <p className="text-gray-500">SNS 계정으로 간편하게 시작하세요</p>
        </div>

        {error && (
          <div className="w-full max-w-sm p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-6">
            {error}
          </div>
        )}

        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={handleKakaoLogin}
            className="w-full h-12 flex items-center justify-center gap-3 rounded-lg font-medium transition-colors"
            style={{ backgroundColor: '#FEE500', color: '#191919' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919">
              <path d="M12 3C6.48 3 2 6.36 2 10.44c0 2.62 1.75 4.93 4.38 6.24l-1.12 4.12a.3.3 0 00.46.33l4.66-3.08c.53.06 1.07.09 1.62.09 5.52 0 10-3.36 10-7.7S17.52 3 12 3z"/>
            </svg>
            카카오로 시작하기
          </button>

          <button
            onClick={handleGoogleLogin}
            className="w-full h-12 flex items-center justify-center gap-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google로 시작하기
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-8 text-center">
          시작하기를 누르면 <a href="/terms" className="underline">이용약관</a> 및{' '}
          <a href="/privacy" className="underline">개인정보처리방침</a>에 동의하게 됩니다.
        </p>
      </div>
    </div>
  );
}
