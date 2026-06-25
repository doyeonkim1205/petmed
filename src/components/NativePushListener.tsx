'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { isNativeApp, setupNativePushListeners } from '@/lib/platform';
import { useAuth } from '@/contexts/AuthContext';

/**
 * 네이티브 앱 시작 시 푸시 리스너 1회 등록 (포그라운드 표시 + 알림 탭 라우팅).
 * 웹/TWA 에선 아무것도 안 함.
 */
export function NativePushListener() {
  const router = useRouter();
  const { loading } = useAuth();
  const splashHidden = useRef(false);

  // 스플래시는 단 한 번만 숨긴다 (중복 호출 가드).
  const hideSplash = useCallback(() => {
    if (splashHidden.current) return;
    splashHidden.current = true;
    import('@capacitor/splash-screen').then(({ SplashScreen }) => SplashScreen.hide());
  }, []);

  // 네이티브 리스너(푸시/뒤로가기/키보드) 1회 등록.
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
    // 안전장치 — 네트워크 지연 등으로 loading 이 안 풀려도 5초 후엔 무조건 숨겨 갇힘 방지.
    const safety = setTimeout(hideSplash, 5000);
    return () => clearTimeout(safety);
  }, [router, hideSplash]);

  // 스플래시 숨김 = "앱이 실제로 준비된 다음" (페인트 기준).
  //   기존엔 마운트 직후 첫 페인트에 숨겨서, 아직 AuthContext loading 중인 "로딩화면"이
  //   잠깐 노출돼 깜박였음. 이제 loading 이 끝난 뒤 다음 페인트 프레임에 fadeOut →
  //   스플래시 밑에서 홈이 준비되어 스플래시→홈으로 부드럽게 전환.
  useEffect(() => {
    if (!isNativeApp()) return;
    if (loading) return; // 아직 준비 전 — 스플래시 유지
    requestAnimationFrame(() => requestAnimationFrame(hideSplash));
  }, [loading, hideSplash]);

  return null;
}
