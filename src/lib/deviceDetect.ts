/**
 * Client-side device / browser detection utilities.
 *
 * Key distinctions we care about:
 *   - isIos:                iPhone/iPad/iPod including iPadOS 13+ desktop mode
 *   - isIosSafari:          Real Safari on iOS (not Chrome/Firefox/WebViews)
 *   - isStandalone:         Running as a home-screen PWA (both iOS and Android)
 *   - needsSafariTransition: iOS user currently in a non-Safari browser
 *                            (in-app browsers like KakaoTalk, iOS Chrome, etc.)
 *
 * All reads are synchronous but should be called from useEffect — during SSR
 * `window` is undefined, so the entry point returns null.
 */

export interface DeviceInfo {
  isIos: boolean;
  isIosSafari: boolean;
  isStandalone: boolean;
  needsSafariTransition: boolean;
}

export function detectDevice(): DeviceInfo | null {
  if (typeof window === 'undefined') return null;

  const ua = navigator.userAgent;

  // iPadOS 13+ reports as Mac. Distinguish via maxTouchPoints.
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.maxTouchPoints > 1 && /Mac/.test(ua));

  // Real Safari on iOS. Every iOS browser is WebKit-based and includes
  // "Safari" in UA, but only real Safari lacks CriOS/FxiOS/etc. markers.
  // Including Whale to exclude its iOS version too.
  const isIosSafari =
    isIos && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Whale|DuckDuckGo/.test(ua);

  // Installed as home-screen PWA. iOS exposes navigator.standalone only in
  // Safari-installed webapps; other browsers need the display-mode check.
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true;

  // Fallback strategy: any iOS non-Safari context needs to move to Safari
  // before the "Add to Home Screen" flow is available. Covers future in-app
  // browsers we don't explicitly enumerate.
  const needsSafariTransition = isIos && !isIosSafari;

  return { isIos, isIosSafari, isStandalone, needsSafariTransition };
}
