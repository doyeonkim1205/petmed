'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isNativeApp } from '@/lib/platform';

function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  // TWA(Trusted Web Activity) and PWA standalone mode → not in-app browser
  if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) return false;
  if (typeof document !== 'undefined' && document.referrer.startsWith('android-app://')) return false;
  const ua = navigator.userAgent || '';
  return /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|Snapchat|Twitter/.test(ua);
}

// 개발자용 이메일/패스워드 로그인 UI 노출 조건.
// test.pawdex.store (Vercel Preview 도메인) 또는 localhost 에서만 표시.
// prod 도메인 (pawdex.store) 에선 hostname 분기로 자동 비활성 — 사용자 노출 0.
function isDevLoginEnv(): boolean {
  if (typeof window === 'undefined') return false;
  // 토스 심사 중 prod 에서도 임시 노출 (이메일/비밀번호 로그인 폼).
  // ENABLE_PAYMENT_REVIEW 와 같이 켜고, 심사 통과 후 둘 다 끔.
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === 'true') return true;
  const host = window.location.hostname;
  if (host === 'test.pawdex.store' || host === 'localhost' || host === '127.0.0.1') return true;
  // prod(pawdex.store): 토스 심사용으로 "웹 브라우저"에선 노출, "설치한 앱(TWA/PWA standalone)"
  // 에선 숨김 → 실사용자(앱)에겐 안 보이고 심사관(웹)에겐 보임.
  if (host === 'pawdex.store') {
    const installedApp =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true ||
      (typeof document !== 'undefined' && document.referrer.startsWith('android-app://')) ||
      isNativeApp(); // Capacitor 네이티브 앱도 설치앱으로 인정 (개발자 로그인 숨김)
    return !installedApp;
  }
  return false;
}

export default function LoginPage() {
  const [error, setError] = useState('');
  const [inApp, setInApp] = useState(false);
  const [devLogin, setDevLogin] = useState(false);
  const [devEmail, setDevEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [devLoading, setDevLoading] = useState(false);
  const [showDevToggle, setShowDevToggle] = useState(false);
  const router = useRouter();
  const { signIn, signInWithGoogle, signInWithKakao } = useAuth();

  useEffect(() => {
    setInApp(isInAppBrowser());
    setShowDevToggle(isDevLoginEnv());
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'session_evicted') {
      setError('다른 기기에서 로그인하여 이 기기는 자동 로그아웃됐어요. 다시 로그인해주세요.');
    }
  }, []);

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDevLoading(true);
    try {
      const { error } = await signIn(devEmail, devPassword);
      if (error) {
        setError(error.message);
        setDevLoading(false);
      } else {
        // 성공 — 메인으로 이동. OAuth 흐름은 /auth/callback 이 자동 라우팅하지만
        // email/password 는 redirect 없이 즉시 응답하므로 수동 push 필요.
        // setDevLoading 은 false 안 해줌 — 메인 이동 중 폼 활성화돼 보이지 않게.
        router.push('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패');
      setDevLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (inApp) {
      const loginUrl = `${window.location.origin}/login`;
      window.location.href = `intent://${window.location.host}/login#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(loginUrl)};end`;
      setTimeout(() => { window.open(loginUrl, '_system'); }, 500);
      return;
    }
    setError('');
    const { error } = await signInWithGoogle();
    if (error) { setError(error.message); return; }
    // 네이티브 구글 로그인은 리다이렉트가 없어 세션만 설정되므로 수동으로 홈 이동.
    // (웹 OAuth 는 /auth/callback 리다이렉트가 라우팅을 처리)
    if (isNativeApp()) router.push('/');
  };

  const handleKakaoLogin = async () => {
    setError('');
    const { error } = await signInWithKakao();
    if (error) { setError(error.message); return; }
    // 네이티브 카카오도 리다이렉트가 없어 수동으로 홈 이동 (웹은 콜백이 처리).
    if (isNativeApp()) router.push('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-200 to-blue-50 px-5 py-8">
      <main className="flex-1 flex flex-col items-stretch max-w-sm mx-auto w-full">
        {/* 흰 카드 — 2등분(상=텍스트, 하=버튼) + 약관 하단 */}
        <div className="w-full bg-white rounded-3xl shadow-lg px-7 py-10 flex-1 min-h-[680px] flex flex-col">
          {/* [상반부 2/3] PawDex + 카피 — 자기 영역 중앙 */}
          <div className="flex-[2] flex flex-col items-center justify-center">
            <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight">PawDex</h1>
            <p className="text-base text-gray-700 mt-4 text-center leading-relaxed font-medium">
              반려동물 건강 케어,<br />
              <span className="text-blue-600 font-bold">더 똑똑하게</span>
            </p>
          </div>

          {/* [하반부 1/3] 에러 + 로그인 버튼 — 위쪽 정렬 → 2/3 지점에서 시작 */}
          <div className="flex-[1] flex flex-col items-center justify-start w-full">
            {error && (
              <div className="w-full mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}
            <div className="w-full space-y-3">
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
            로그인 시 <a href="/terms" className="underline">이용약관</a> 및{' '}
            <a href="/privacy" className="underline">개인정보처리방침</a>에 동의하게 됩니다.
          </p>

          {/* 개발자 로그인 — test.pawdex.store / localhost 에서만 표시.
              prod (pawdex.store) 에선 hostname 분기로 안 보임. */}
          {showDevToggle && (
            <div className="pt-1 mt-auto border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDevLogin(v => !v)}
                className="text-[10px] text-gray-300 hover:text-gray-400 w-full text-center pt-3"
              >
                개발자 로그인 {devLogin ? '닫기' : '열기'}
              </button>
              {devLogin && (
                <form onSubmit={handleDevLogin} className="mt-3 space-y-2">
                  <input
                    type="email"
                    value={devEmail}
                    onChange={e => setDevEmail(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    autoComplete="email"
                    required
                  />
                  <input
                    type="password"
                    value={devPassword}
                    onChange={e => setDevPassword(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="submit"
                    disabled={devLoading}
                    className="w-full h-10 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium disabled:opacity-50 hover:bg-gray-200 transition-colors"
                  >
                    {devLoading ? '로그인 중...' : '로그인'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
