/**
 * 플랫폼(웹/네이티브) 환경 감지.
 *
 * pawdex.store 를 원격 로드하는 Capacitor 셸 안에서는 `window.Capacitor` 가 주입된다.
 * 일반 웹 브라우저 / TWA 에서는 주입되지 않으므로 false.
 *
 * ⚠️ @capacitor/core 를 static import 하지 않는다 — 모든 사용자(웹 포함)가 로드하는
 *    코드라 웹 번들을 가볍게 유지하기 위해 window 객체만 직접 확인한다.
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/**
 * "설치된 앱"(알림 등 기능 게이트용) 판정.
 * PWA standalone/fullscreen + Capacitor 네이티브를 모두 "설치됨"으로 본다.
 * 알림 화면들의 isPWA 체크(standalone 만)가 Capacitor 를 놓치던 문제를 한 곳에서 해결.
 */
export function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    isNativeApp()
  );
}
