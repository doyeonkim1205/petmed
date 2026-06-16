'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isNativeApp, setupNativePushListeners } from '@/lib/platform';

/**
 * 네이티브 앱 시작 시 푸시 리스너 1회 등록 (포그라운드 표시 + 알림 탭 라우팅).
 * 웹/TWA 에선 아무것도 안 함.
 */
export function NativePushListener() {
  const router = useRouter();
  useEffect(() => {
    if (!isNativeApp()) return;
    // [임시 진단] 축소 원인 — WebView 뷰포트 폭 확인
    setTimeout(() => {
      let ls = '(none)';
      try { ls = String(localStorage.getItem('fontSize')); } catch {}
      alert(
        'rootFont=' + getComputedStyle(document.documentElement).fontSize +
        ' bodyFont=' + getComputedStyle(document.body).fontSize +
        ' lsFontSize=' + ls +
        ' htmlClass=' + document.documentElement.className,
      );
    }, 1500);
    setupNativePushListeners((url) => router.push(url));
  }, [router]);
  return null;
}
