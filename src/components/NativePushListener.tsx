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
    setupNativePushListeners((url) => router.push(url));
    // 안드로이드 뒤로가기: 히스토리 있으면 뒤로, 루트면 앱 종료 (기본 핸들러는 항상 종료라 버그)
    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else App.exitApp();
      });
    });
    // 네이티브 키보드 ON/OFF → body.keyboard-open 토글 (웹 visualViewport 가 WebView 에선
    // 안 먹어서, 기존 .keyboard-hide-on-open CSS 를 네이티브 이벤트로 재활용 → 하단 탭바 숨김).
    import('@capacitor/keyboard').then(({ Keyboard }) => {
      Keyboard.addListener('keyboardWillShow', () => document.body.classList.add('keyboard-open'));
      Keyboard.addListener('keyboardWillHide', () => document.body.classList.remove('keyboard-open'));
    });
    // 스플래시 숨김 — 마운트 후 다음 페인트 프레임에 끔 (타이머 아님). 5초 안전장치.
    import('@capacitor/splash-screen').then(({ SplashScreen }) => {
      let hidden = false;
      const hide = () => { if (!hidden) { hidden = true; SplashScreen.hide(); } };
      requestAnimationFrame(() => requestAnimationFrame(hide));
      setTimeout(hide, 5000);
    });
  }, [router]);
  return null;
}
