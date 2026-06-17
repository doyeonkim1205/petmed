'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isNativeApp } from '@/lib/platform';

/**
 * 토스 결제 라우트(/payment/*) 진입 가드.
 *
 * Play 정책상 네이티브 앱에선 토스 결제 플로우가 "실제로 시작되면" 안 된다.
 * UI 숨김만으론 WebView 직접 URL 진입이 가능하고, 단순 redirect-after-render 가드는
 * React effect 가 자식→부모 순으로 실행돼 자식 payment 페이지의 Toss SDK init useEffect 가
 * redirect 보다 먼저 탈 수 있다.
 *
 * → 그래서 앱/웹 판별이 끝날 때까지 children 을 아예 마운트하지 않는다.
 *   - 'pending'(SSR·첫 클라 렌더): null → hydration 일치 + 자식 미마운트(토스 effect 실행 0)
 *   - 'web' 확인: children 마운트 (기존 토스 결제 그대로)
 *   - 'app' 확인: /profile/subscription 리다이렉트 (children 영원히 미마운트 → 토스 SDK 미초기화)
 */
export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<'pending' | 'web' | 'app'>('pending');

  useEffect(() => {
    if (isNativeApp()) {
      setStatus('app');
      router.replace('/profile/subscription');
    } else {
      setStatus('web');
    }
  }, [router]);

  if (status !== 'web') return null; // pending/app 동안 자식 미마운트 → 토스 코드 진입 차단
  return <>{children}</>;
}
