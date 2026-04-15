/**
 * App version displayed in UI (마이페이지 하단, 앱 정보 등).
 *
 * Convention: MAJOR.MINOR.PATCH
 * - MAJOR / MINOR: 우리가 수동 관리
 * - PATCH: TWA appVersionCode 와 맞춤 (Android 빌드 번호)
 *
 * 업데이트 타이밍:
 *   - TWA 빌드 올릴 때 PATCH 를 appVersionCode 와 동일하게 맞추기
 *   - 큰 기능 추가되면 MINOR 증가, 호환성 깨는 변경은 MAJOR 증가
 */
export const APP_VERSION = '1.0.16';
