/**
 * RevenueCat REST API v1 (서버측) — 구독자 조회용 인증 키 선택 헬퍼.
 *
 * ⚠️ GET /v1/subscribers/{app_user_id} 조회는 RC 공식 예제상 **Public(SDK) API 키**로 인증한다
 *    (조회는 non-potent 작업). Secret 키(`sk_`/V2)는 이 V1 엔드포인트와 호환되지 않아
 *    403(code 7723: "secret API key incompatible with RevenueCat API V1")이 난다.
 *
 * RC 지원 권장: "호출이 이뤄지는 플랫폼에 맞는 Public 키"를 사용할 것 → 플랫폼별로 키를 고른다.
 *    (app_user_id·entitlement 는 프로젝트 단위라 단일 키로도 조회될 여지가 크지만,
 *     iOS/Android 를 모두 운영하므로 권장을 따라 플랫폼 일치 키를 쓰는 게 안전하다.)
 *
 * 두 키 모두 Public(SDK) 키이므로, 클라이언트가 platform 값을 조작해도 Secret 노출 위험은 없다
 * (Public 키는 원래 앱 번들에 포함되도록 설계된 키다).
 */

export const RC_PLATFORMS = ['ios', 'android'] as const;
export type RcPlatform = (typeof RC_PLATFORMS)[number];

/** 요청 body 의 platform 값이 지원 플랫폼('ios'|'android')인지 검증 (서버 입력검증용). */
export function isRcPlatform(value: unknown): value is RcPlatform {
  return value === 'ios' || value === 'android';
}

/**
 * 플랫폼에 대응하는 RevenueCat Public API 키를 돌려준다.
 *   ios     → NEXT_PUBLIC_REVENUECAT_APPLE_API_KEY  (appl_...)
 *   android → NEXT_PUBLIC_REVENUECAT_GOOGLE_API_KEY (goog_...)
 * env 에 키가 없으면 undefined (호출부에서 503 dormant → 웹훅 폴백 처리).
 */
export function rcPublicKeyFor(platform: RcPlatform): string | undefined {
  return platform === 'ios'
    ? process.env.NEXT_PUBLIC_REVENUECAT_APPLE_API_KEY
    : process.env.NEXT_PUBLIC_REVENUECAT_GOOGLE_API_KEY;
}
