'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { InstallPrompt } from '@/components/InstallPrompt';
import { IosInstallPrompt } from '@/components/IosInstallPrompt';
import { InAppBrowserHint } from '@/components/InAppBrowserHint';
import { AndroidInAppBrowserHint } from '@/components/AndroidInAppBrowserHint';
import { BrandLoading } from '@/components/BrandLoading';
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
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  // 세션 확인 전 or 미인증 상태에선 컨텐츠 노출 막기.
  // - loading 중: OAuth 콜백(/auth/callback)과 '동일한' BrandLoading(로고+스피너)을 렌더한다.
  //   → 로그인 시 콜백 화면 → (main) 가드 화면이 같은 모습이라 "두 로딩이 번갈아 깜박이는"
  //     현상이 사라지고, 네이티브 스플래시(흰 배경+로고)와도 자연스럽게 이어진다.
  // - 미인증 (loading 끝났는데 user 없음): 위 useEffect 가 /login 으로 리다이렉트
  //   중이므로 깜빡임 방지 차 빈 흰 화면 유지
  if (loading) {
    return <BrandLoading />;
  }
  if (!user) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-md bg-white shadow-sm min-h-screen flex flex-col">
        <Header />
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
