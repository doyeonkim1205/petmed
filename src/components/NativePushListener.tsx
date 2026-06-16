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
    // 스플래시 숨김 — TWA 처럼 "앱이 실제로 그려진 다음" 끄기 (타이머가 아닌 페인트 기준).
    // launchAutoHide:false 로 원격 페이지 로드 동안 스플래시 유지 → 마운트+페인트 후 fadeOut.
    // 빈 프레임(깜박임) 없이 부드럽게 전환. 안전장치로 5초 후 무조건 숨김(네트워크 지연 시 갇힘 방지).
    import('@capacitor/splash-screen').then(({ SplashScreen }) => {
      let hidden = false;
      const hide = () => { if (!hidden) { hidden = true; SplashScreen.hide(); } };
      requestAnimationFrame(() => requestAnimationFrame(hide)); // 다음 페인트 프레임에 숨김
      setTimeout(hide, 5000); // 안전장치
    });
  }, [router]);
  return null;
}
