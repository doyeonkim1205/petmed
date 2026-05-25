'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, FileSearch, Camera, MapPin } from 'lucide-react';

function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  // TWA(Trusted Web Activity) and PWA standalone mode → not in-app browser
  if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) return false;
  if (typeof document !== 'undefined' && document.referrer.startsWith('android-app://')) return false;
  const ua = navigator.userAgent || '';
  return /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|Snapchat|Twitter/.test(ua);
}

/**
 * 로그인 페이지 진입용 일러스트.
 * 온보딩의 IllustPaw 와 같은 톤 (200x200, blue 배경 원, 발바닥 + 하트 + sparkles).
 * 라이트하게 변형: 크기는 그대로지만 페이지에서 작게 (140x140).
 */
function LoginIllust() {
  return (
    <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
      <circle cx="100" cy="100" r="90" fill="#DBEAFE" />
      <circle cx="100" cy="100" r="70" fill="#BFDBFE" opacity="0.6" />
      {/* Paw pad */}
      <ellipse cx="100" cy="120" rx="28" ry="24" fill="#3B82F6" />
      <ellipse cx="72" cy="90" rx="14" ry="17" fill="#3B82F6" transform="rotate(-15, 72, 90)" />
      <ellipse cx="92" cy="78" rx="13" ry="16" fill="#3B82F6" transform="rotate(-5, 92, 78)" />
      <ellipse cx="112" cy="78" rx="13" ry="16" fill="#3B82F6" transform="rotate(5, 112, 78)" />
      <ellipse cx="130" cy="90" rx="14" ry="17" fill="#3B82F6" transform="rotate(15, 130, 90)" />
      <path d="M90 135 C90 130, 82 125, 82 130 C82 136, 90 142, 90 142 C90 142, 98 136, 98 130 C98 125, 90 130, 90 135Z" fill="#EF4444" opacity="0.8" transform="translate(12, -2) scale(1.2)" />
      <circle cx="45" cy="55" r="3" fill="#FBBF24" />
      <circle cx="155" cy="60" r="2.5" fill="#FBBF24" />
      <circle cx="50" cy="150" r="2" fill="#FBBF24" />
      <circle cx="160" cy="140" r="3" fill="#FBBF24" />
      <path d="M150 45 L152 40 L154 45 L159 47 L154 49 L152 54 L150 49 L145 47Z" fill="#F59E0B" opacity="0.7" />
      <path d="M38 120 L40 116 L42 120 L46 122 L42 124 L40 128 L38 124 L34 122Z" fill="#F59E0B" opacity="0.5" />
    </svg>
  );
}

const FEATURES = [
  { icon: MessageCircle, label: 'AI 증상 분석',     color: 'text-blue-500' },
  { icon: Camera,        label: 'AI 사진 분석',     color: 'text-purple-500' },
  { icon: FileSearch,    label: '수의학 논문 검색', color: 'text-emerald-500' },
  { icon: MapPin,        label: '24시 병원 찾기',   color: 'text-rose-500' },
];

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
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
      <main className="flex-1 px-6 py-10 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        {/* 일러스트 + 로고 */}
        <div className="w-32 h-32 mb-3">
          <LoginIllust />
        </div>
        <h1 className="text-2xl font-extrabold text-blue-600 tracking-tight">PawDex</h1>
        <p className="text-sm text-gray-500 mt-2 text-center leading-relaxed">
          반려동물 건강 케어,<br />
          <span className="text-gray-700 font-semibold">더 똑똑하게</span>
        </p>

        {/* 기능 카드 — 가입 동기 강화 */}
        <div className="w-full mt-8 mb-7 grid grid-cols-2 gap-2">
          {FEATURES.map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2.5 shadow-sm"
            >
              <Icon size={16} className={color} />
              <span className="text-xs font-medium text-gray-700">{label}</span>
            </div>
          ))}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="w-full p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">
            {error}
          </div>
        )}

        {/* 로그인 버튼 */}
        <div className="w-full space-y-2.5">
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

        {/* 약관 */}
        <p className="text-[11px] text-gray-400 mt-5 text-center leading-relaxed">
          시작하면 <a href="/terms" className="underline">이용약관</a> 및{' '}
          <a href="/privacy" className="underline">개인정보처리방침</a>에 동의하게 됩니다
        </p>
      </main>
    </div>
  );
}
