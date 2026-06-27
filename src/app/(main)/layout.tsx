'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { InstallPrompt } from '@/components/InstallPrompt';
import { IosInstallPrompt } from '@/components/IosInstallPrompt';
import { InAppBrowserHint } from '@/components/InAppBrowserHint';
import { AndroidInAppBrowserHint } from '@/components/AndroidInAppBrowserHint';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/contexts/AuthContext';
import { verifyDevice } from '@/lib/deviceSession';

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
  const pathname = usePathname();
  const { user, loading } = useAuth();
  // verify 과도 호출 방지용 쓰로틀 — 직전 검증 후 일정 시간 내 재호출 스킵.
  const lastVerifyRef = useRef(0);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  // DeviceGuard — 밀려난 기기 즉시 차단(읽기 전용 검증).
  //   홈·기록 등 핵심 화면은 supabase 직접(RLS)이라 서버 기기체크를 안 타므로,
  //   여기서 진입(마운트) + 탭 이동(라우트 변경) + 포그라운드 복귀 때 verify 를 호출해
  //   막힌 기기를 끊는다. 클라 네비게이션은 레이아웃을 리마운트하지 않으므로
  //   pathname 변경을 별도로 감지해야 "탭 누르면 로그아웃"이 동작한다.
  //   verify 가 밀려남을 감지하면 authFetch 가 signOut + /login?reason=session_evicted.
  //   (claim 은 하지 않음 — 핑퐁 방지. 네트워크 오류 시엔 로그아웃 안 함.)
  useEffect(() => {
    if (loading || !user) return;
    const run = () => {
      const now = Date.now();
      if (now - lastVerifyRef.current < 4000) return; // 4s 쓰로틀
      lastVerifyRef.current = now;
      verifyDevice();
    };
    run(); // 마운트 + 라우트 변경(pathname dep)
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loading, user, pathname]);

  // 세션 확인 전 or 미인증 상태에선 컨텐츠 노출 막기.
  // - loading 중: OAuth 콜백(/auth/callback)과 '동일한' 풀스크린 LoadingScreen(스피너만).
  //   → 콜백 스피너와 위치·모양이 같아 로그인 시 한 번만 뜬 것처럼 보임(깜박임 제거).
  //     이전엔 콜백은 풀스크린 스피너, 여긴 Header+inMain 스피너라 위치가 달라
  //     "두 번 뜨고 깜박이는" 것처럼 보였음.
  // - 미인증 (loading 끝났는데 user 없음): 위 useEffect 가 /login 으로 리다이렉트
  //   중이므로 깜빡임 방지 차 빈 흰 화면 유지
  if (loading) {
    return <LoadingScreen />;
  }
  if (!user) {
    return <div className="min-h-screen bg-white" />;
  }

  // 자체 헤더(뒤로가기+제목)가 있는 페이지에선 전역 헤더(로고+종) 숨김 → 이중 헤더 제거.
  //   /records/*(목록 /records 제외), /profile/*(메인 제외), /search/*(메인 제외), /announcements.
  //   홈·records목록·profile메인·search메인·map·payment 는 자체 헤더가 없어 전역 헤더 유지.
  const hideGlobalHeader =
    pathname.startsWith('/records/') ||
    pathname.startsWith('/profile/') ||
    pathname.startsWith('/search/') ||
    pathname.startsWith('/announcements');

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-md bg-white shadow-sm min-h-screen flex flex-col">
        {!hideGlobalHeader && <Header />}
        <main className="flex-1" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
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
