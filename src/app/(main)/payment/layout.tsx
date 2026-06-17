'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isNativeApp } from '@/lib/platform';

/**
 * 토스 결제 라우트(/payment/*) 진입 가드.
 *
 * Play 정책상 네이티브 앱에선 토스 결제 페이지에 접근하면 안 된다(UI 숨김만으로는
 * WebView 에서 직접 URL 진입이 가능). 앱이면 구독 관리 페이지로 리다이렉트해 차단한다.
 * 웹은 그대로 통과 → 기존 토스 결제 플로우 유지.
 *
 * SSR/hydration: 서버는 isNativeApp()=false 라 children 을 렌더 → 첫 클라 렌더도 동일(children)
 * 후 useEffect 에서 앱이면 차단. (조건부 첫 렌더로 인한 hydration mismatch 회피)
 */
export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (isNativeApp()) {
      setBlocked(true);
      router.replace('/profile/subscription');
    }
  }, [router]);

  if (blocked) return null;
  return <>{children}</>;
}
