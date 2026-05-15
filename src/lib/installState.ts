/**
 * PWA / TWA 설치 상태 감지 유틸.
 *
 * 배경:
 *   - PWA (홈 화면 추가) 와 TWA (플레이 스토어 com.dylabs.pawdex) 는 서로
 *     독립적으로 설치될 수 있다. 한쪽이 이미 있는데 다른 쪽 "설치" UI 를
 *     띄우면 유저가 같은 서비스를 두 번 깐다.
 *   - TWA 안에서는 iOS "홈 화면 추가" 힌트 같은 게 새어나오면 안 된다.
 *
 * 컨텍스트 감지 기준:
 *   - TWA (Chrome Custom Tab 안) → document.referrer 가
 *     android-app://{패키지명}/ 로 시작. 첫 진입 한정이라 세션 캐시.
 *   - PWA (standalone) → display-mode: standalone 또는 iOS Safari 의
 *     navigator.standalone === true.
 *
 * 디바이스에 TWA 가 "설치되어 있는지" 는 비동기 API 필요:
 *   - navigator.getInstalledRelatedApps() — Chromium on Android 한정.
 *   - manifest.json 의 related_applications 에 선언된 앱과 Digital Asset
 *     Links 로 연결돼 있어야 true 를 돌려준다 (assetlinks.json 필수).
 */

const CACHE_KEY = 'pawdex_install_ctx';
const TWA_PACKAGE = 'com.dylabs.pawdex';

export type InstallContext = 'twa' | 'pwa' | 'browser';

/**
 * 현재 런타임 컨텍스트 감지 (동기).
 * 첫 감지 결과는 sessionStorage 에 캐시해서, 내부 링크 탐색으로
 * document.referrer 가 바뀌어도 세션 내내 일관된 결과 유지.
 */
export function detectInstallContext(): InstallContext {
  if (typeof window === 'undefined') return 'browser';

  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached === 'twa' || cached === 'pwa' || cached === 'browser') return cached;
  } catch {
    /* sessionStorage 접근 실패 (privacy 모드 등) — 매번 새로 감지 */
  }

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true;
  const isTwaReferrer =
    typeof document !== 'undefined' &&
    document.referrer.startsWith(`android-app://${TWA_PACKAGE}`);

  // TWA 판정이 PWA 판정보다 우선 (TWA 도 standalone 으로 잡히므로).
  const ctx: InstallContext = isTwaReferrer ? 'twa' : isStandalone ? 'pwa' : 'browser';

  try {
    sessionStorage.setItem(CACHE_KEY, ctx);
  } catch {
    /* noop */
  }
  return ctx;
}

/**
 * 편의 함수: 현재 실행 환경이 "설치된 앱 컨텍스트" 인가?
 * (PWA 든 TWA 든 — 설치 UI 를 띄우지 말아야 하는 모든 경우)
 */
export function isRunningInInstalledApp(): boolean {
  const ctx = detectInstallContext();
  return ctx === 'twa' || ctx === 'pwa';
}

/**
 * 디바이스에 TWA 앱이 설치되어 있는지 비동기 검사.
 * - Chromium on Android 에서만 결과 반환. 그 외엔 false.
 * - Digital Asset Links (assetlinks.json) 검증 필요. 런칭 시 별도 세팅.
 * - 결과는 호출자가 state 로 관리 (여기서 캐시 X — 설치 상태가 바뀔 수 있으니)
 */
export async function isTwaAppInstalled(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  type Nav = Navigator & {
    getInstalledRelatedApps?: () => Promise<
      Array<{ id?: string; platform: string; url?: string }>
    >;
  };
  const nav = navigator as Nav;
  if (!nav.getInstalledRelatedApps) return false;
  try {
    const apps = await nav.getInstalledRelatedApps();
    return apps.some(a => a.platform === 'play' && a.id === TWA_PACKAGE);
  } catch {
    return false;
  }
}
