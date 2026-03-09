'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, ExternalLink } from 'lucide-react';

function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // KakaoTalk, Instagram, Facebook, LINE, Naver, Twitter, Snapchat, Android WebView
  return /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|Snapchat|Twitter|Android.*wv\)/.test(ua);
}

export default function LoginPage() {
  const [error, setError] = useState('');
  const [inApp, setInApp] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const { signIn, signInWithGoogle, signInWithKakao } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setInApp(isInAppBrowser());
    // Show session eviction message
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'session_evicted') {
      setError('다른 기기에서 로그인하여 현재 세션이 종료되었습니다.');
    }
  }, []);

  const handleGoogleLogin = async () => {
    if (inApp) {
      // In-app browser: can't use Google OAuth, guide to external browser
      try {
        // Try to open in external browser (Android)
        window.location.href = `intent://${window.location.host}${window.location.pathname}#Intent;scheme=https;end`;
      } catch {
        setError('Google 로그인은 외부 브라우저(Chrome, Safari)에서만 가능합니다. 주소를 복사하여 브라우저에서 열어주세요.');
      }
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

  const handleCopyUrl = () => {
    navigator.clipboard?.writeText(window.location.origin + '/login').then(() => {
      setError('URL이 복사되었습니다. 브라우저에 붙여넣기 해주세요.');
    });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center px-4 py-3 border-b">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold pr-8">로그인</h1>
      </header>

      <div className="flex-1 px-6 py-8 flex flex-col items-center justify-center">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">환영합니다!</h2>
          <p className="text-gray-500">SNS 계정으로 간편하게 로그인하세요</p>
        </div>

        {error && (
          <div className="w-full max-w-sm p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-6">
            {error}
          </div>
        )}

        {/* In-app browser warning for Google */}
        {inApp && (
          <div className="w-full max-w-sm p-4 bg-orange-50 border border-orange-200 rounded-lg mb-4">
            <p className="text-sm font-medium text-orange-700 mb-2">
              인앱 브라우저에서는 Google 로그인이 제한됩니다.
            </p>
            <p className="text-xs text-orange-600 mb-3">
              Google 정책으로 인해 카카오톡, 인스타그램 등의 앱 내 브라우저에서는 Google 로그인을 사용할 수 없습니다.
              외부 브라우저(Chrome, Safari)에서 열어주세요.
            </p>
            <button
              onClick={handleCopyUrl}
              className="w-full h-9 flex items-center justify-center gap-2 bg-white border border-orange-300 rounded-lg text-sm font-medium text-orange-700"
            >
              <ExternalLink size={14} /> URL 복사하기
            </button>
          </div>
        )}

        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={handleGoogleLogin}
            className={`w-full h-12 flex items-center justify-center gap-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors ${inApp ? 'opacity-50' : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google로 로그인
          </button>

          <button
            onClick={handleKakaoLogin}
            className="w-full h-12 flex items-center justify-center gap-3 rounded-lg font-medium transition-colors"
            style={{ backgroundColor: '#FEE500', color: '#191919' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919">
              <path d="M12 3C6.48 3 2 6.36 2 10.44c0 2.62 1.75 4.93 4.38 6.24l-1.12 4.12a.3.3 0 00.46.33l4.66-3.08c.53.06 1.07.09 1.62.09 5.52 0 10-3.36 10-7.7S17.52 3 12 3z"/>
            </svg>
            카카오로 로그인
          </button>

          {/* Email login (for Toss review) */}
          {!showEmail ? (
            <button
              onClick={() => setShowEmail(true)}
              className="w-full text-center text-xs text-gray-400 mt-2"
            >
              이메일로 로그인
            </button>
          ) : (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
              <input
                type="email"
                placeholder="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-4 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={async () => {
                  setEmailLoading(true);
                  setError('');
                  const { error } = await signIn(email, password);
                  if (error) setError(error.message);
                  else router.push('/');
                  setEmailLoading(false);
                }}
                disabled={emailLoading || !email || !password}
                className="w-full h-11 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {emailLoading ? '로그인 중...' : '로그인'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
