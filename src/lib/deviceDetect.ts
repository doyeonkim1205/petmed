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
  isAndroid: boolean;
  isAndroidInAppBrowser: boolean;
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

  const isAndroid = /Android/i.test(ua) && !isIos;

  // Android 인앱 WebView 감지.
  // Chrome / Samsung Internet / Firefox / Edge / Opera 등 "정상" 브라우저는
  // 제외하고 나머지를 인앱으로 간주. 알려진 인앱 마커 (KAKAOTALK, FB_IAB,
  // Instagram, NAVER, Line, EverytimeApp, DaumApps 등) + 범용 fallback
  // (wv = WebView flag) 조합.
  //
  // 왜 인앱 감지가 필요한가:
  //   - beforeinstallprompt 이벤트가 인앱 WebView 에선 발동 안 함 → PWA
  //     설치 배너 안 뜸.
  //   - getInstalledRelatedApps() 도 작동 안 함.
  //   - 유저는 좁은 WebView 에서 PWA 혜택 없이 이용하다 이탈하기 쉬움.
  //   - "Chrome 에서 열기" 안내를 띄워서 탈출 경로 제공.
  const hasInAppMarker =
    /(KAKAOTALK|FB_IAB|FBAN|FBAV|Instagram|NAVER|Line|EverytimeApp|DaumApps|Twitter)/i.test(
      ua,
    );
  const isKnownBrowser = /(Chrome|SamsungBrowser|Firefox|Edg|OPR|Whale)/i.test(ua);
  // "wv" 토큰은 Android WebView 의 표준 마커. 정상 브라우저엔 없음.
  const hasWebViewMarker = /;\s*wv\)/.test(ua);
  const isAndroidInAppBrowser =
    isAndroid && !isStandalone && (hasInAppMarker || (hasWebViewMarker && !isKnownBrowser));

  return {
    isIos,
    isIosSafari,
    isStandalone,
    needsSafariTransition,
    isAndroid,
    isAndroidInAppBrowser,
  };
}
