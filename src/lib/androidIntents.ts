/**
 * Android intent helpers for the TWA context.
 *
 * Some system intents (e.g. opening default-apps settings) cannot be
 * fired directly from web content because browsers filter those URLs.
 * We route through the TWA's native SettingsLauncherActivity via the
 * pawdex:// deep link scheme. Outside the TWA the deep link has no
 * handler, so we fall back to the best-effort web intent URL.
 */

function isInTwa(): boolean {
  if (typeof document === 'undefined') return false;
  return document.referrer.startsWith('android-app://');
}

/** Android 기본 앱 설정 화면 열기 (유저가 브라우저 앱 → Chrome 선택) */
export function openDefaultAppsSettings() {
  if (isInTwa()) {
    // TWA 네이티브에서 intent 실행
    window.location.href = 'pawdex://open-settings';
  } else {
    // 웹 컨텍스트: intent URL 시도 (대부분 차단되지만 최선책)
    window.location.href = 'intent:#Intent;action=android.settings.MANAGE_DEFAULT_APPS_SETTINGS;end';
  }
}

/** 삼성 인터넷 앱 정보 페이지 열기 (저장공간 → 데이터 삭제 유도) */
export function openSamsungInternetAppInfo() {
  if (isInTwa()) {
    window.location.href = 'pawdex://open-settings-samsung';
  } else {
    // 웹: 앱 정보 페이지 intent URL
    window.location.href =
      'intent:package:com.sec.android.app.sbrowser#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;end';
  }
}

/** Chrome 으로 pawdex.store 열기 (Chrome 없으면 현재 브라우저 유지) */
export function openInChrome() {
  if (isInTwa()) {
    // TWA 안에서는 외부 Chrome 을 별도 태스크로 띄움
    window.location.href = 'pawdex://open-chrome';
  } else {
    const host = window.location.host;
    const path = window.location.pathname + window.location.search;
    const fallback = encodeURIComponent(window.location.href);
    window.location.href =
      `intent://${host}${path}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
  }
}
