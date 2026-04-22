'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { InstallPrompt } from '@/components/InstallPrompt';
import { IosInstallPrompt } from '@/components/IosInstallPrompt';
import { InAppBrowserHint } from '@/components/InAppBrowserHint';
import { AndroidInAppBrowserHint } from '@/components/AndroidInAppBrowserHint';
import { useAuth } from '@/contexts/AuthContext';

/**
 * (main) route group 공통 레이아웃.
 *
 * 강제 로그인 guard 를 여기서 처리한다.
 * - AuthContext 가 loading === false 인 시점에
 * - user 가 없으면 /login 으로 리다이렉트
 *
 * Supabase 세션을 localStorage 에 저장하기 때문에 Next.js middleware 로
 * 서버 측에서 판정할 수 없고, 클라이언트 레이아웃에서 가드.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideHeader = pathname === '/';
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  // 세션 확인 전 or 미인증 상태 — 빈 화면에 legal 푸터만 표시.
  // Google OAuth 검증 봇이 pawdex.store/ 루트 방문 시 privacy 링크를 발견할 수
  // 있어야 홈페이지 요구사항 (개인정보처리방침으로의 링크) 통과. 클라이언트에서
  // useEffect 가 /login 으로 리다이렉트하지만 SSR 단계 HTML 에 링크가 있어야
  // 스크래퍼가 인식.
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex-1" />
        <footer className="text-center text-[11px] text-gray-400 py-6 px-4 space-x-2">
          <a href="/privacy" className="underline hover:text-gray-600">개인정보처리방침</a>
          <span>·</span>
          <a href="/terms" className="underline hover:text-gray-600">이용약관</a>
          <span>·</span>
          <a href="/business" className="underline hover:text-gray-600">사업자 정보</a>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-md bg-white shadow-sm min-h-screen flex flex-col">
        {!hideHeader && <Header />}
        <main className="flex-1 pb-16">
          {children}
        </main>
        <Footer />
        <InstallPrompt />
        <IosInstallPrompt />
        <InAppBrowserHint />
        <AndroidInAppBrowserHint />
      </div>
    </div>
  );
}
