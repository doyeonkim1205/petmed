'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  // TWA(Trusted Web Activity) and PWA standalone mode → not in-app browser
  if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) return false;
  if (typeof document !== 'undefined' && document.referrer.startsWith('android-app://')) return false;
  const ua = navigator.userAgent || '';
  return /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|Snapchat|Twitter/.test(ua);
}

export default function LoginPage() {
  const [error, setError] = useState('');
  const [inApp, setInApp] = useState(false);
  const { signInWithGoogle, signInWithKakao } = useAuth();

  useEffect(() => {
    setInApp(isInAppBrowser());
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'session_evicted') {
      setError('다른 기기에서 로그인하여 이 기기는 자동 로그아웃됐어요. 다시 로그인해주세요.');
    }
  }, []);

  const handleGoogleLogin = async () => {
    if (inApp) {
      const loginUrl = `${window.location.origin}/login`;
      window.location.href = `intent://${window.location.host}/login#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(loginUrl)};end`;
      setTimeout(() => { window.open(loginUrl, '_system'); }, 500);
      return;
    }
    setError('');
    const { error } = await signInWithGoogle();
    if (error) setError(error.message);
  };

  const handleKakaoLogin = async () => {
    setError('');
    const { error } = await signInWithKakao();
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-200 to-blue-50 px-5 py-8">
      <main className="flex-1 flex flex-col items-stretch max-w-sm mx-auto w-full">
        {/* 흰 카드 — 콘텐츠는 중앙 묶음, 약관만 하단 */}
        <div className="w-full bg-white rounded-3xl shadow-lg px-7 py-10 flex-1 min-h-[680px] flex flex-col">
          {/* 콘텐츠 그룹 — PawDex + 카피 + 버튼 (카드 중앙에 묶임) */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight">PawDex</h1>
            <p className="text-base text-gray-700 mt-9 text-center leading-relaxed font-medium">
              반려동물 건강 케어,<br />
              <span className="text-blue-600 font-bold">더 똑똑하게</span>
            </p>
            <p className="text-sm text-gray-500 mt-3 text-center leading-relaxed">
              AI 증상 분석부터 24시 병원까지<br />
              한 번에 보호자 곁에서
            </p>

            {error && (
              <div className="w-full mt-7 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <div className="w-full space-y-3 mt-10">
              <button
                onClick={handleKakaoLogin}
                className="w-full h-12 flex items-center justify-center gap-3 rounded-xl font-semibold transition-transform active:scale-[0.98] shadow-sm"
                style={{ backgroundColor: '#FEE500', color: '#191919' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919">
                  <path d="M12 3C6.48 3 2 6.36 2 10.44c0 2.62 1.75 4.93 4.38 6.24l-1.12 4.12a.3.3 0 00.46.33l4.66-3.08c.53.06 1.07.09 1.62.09 5.52 0 10-3.36 10-7.7S17.52 3 12 3z" />
                </svg>
                카카오로 시작하기
              </button>

              <button
                onClick={handleGoogleLogin}
                className="w-full h-12 flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-transform shadow-sm"
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google로 시작하기
              </button>
            </div>
          </div>

          {/* 약관 — 카드 하단 고정 */}
          <p className="text-[11px] text-gray-400 text-center leading-relaxed pt-6">
            시작하면 <a href="/terms" className="underline">이용약관</a> 및{' '}
            <a href="/privacy" className="underline">개인정보처리방침</a>에 동의하게 됩니다
          </p>
        </div>
      </main>
    </div>
  );
}
