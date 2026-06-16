/**
 * 위치 어댑터 — 웹은 navigator.geolocation, 네이티브는 @capacitor/geolocation.
 *
 * Capacitor WebView 에서는 navigator.geolocation 이 권한 팝업을 못 띄우고 조용히
 * 실패하므로, 네이티브에서는 플러그인으로 권한 요청 + 위치 조회를 한다.
 * 시그니처는 navigator.geolocation.getCurrentPosition 과 동일하게 맞춰 호출부 변경 최소화.
 */
import { isNativeApp } from './env';

type GeoSuccess = (pos: { coords: { latitude: number; longitude: number; accuracy?: number } }) => void;
type GeoError = (err?: unknown) => void;
type GeoOptions = { timeout?: number; enableHighAccuracy?: boolean };

/** 위치 기능 사용 가능 여부 (네이티브는 항상 true — 플러그인이 처리). */
export function isGeolocationAvailable(): boolean {
  if (isNativeApp()) return true;
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}

/** navigator.geolocation.getCurrentPosition 호환 — 네이티브면 Capacitor Geolocation 사용. */
export function getCurrentPosition(success: GeoSuccess, error: GeoError, options?: GeoOptions): void {
  if (isNativeApp()) {
    (async () => {
      try {
        const { Geolocation } = await import('@capacitor/geolocation');
        let perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          perm = await Geolocation.requestPermissions();
        }
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          error(new Error('location-permission-denied'));
          return;
        }
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeout ?? 10000,
        });
        success({
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
        });
      } catch (e) {
        error(e);
      }
    })();
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      success as PositionCallback,
      error as PositionErrorCallback,
      options,
    );
  } else {
    error(new Error('geolocation-unavailable'));
  }
}
