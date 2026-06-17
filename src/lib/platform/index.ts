/**
 * 플랫폼 어댑터 레이어 배럴.
 * 화면/컨텍스트는 여기서만 import 한다: `import { isNativeApp, platformAuth } from '@/lib/platform'`.
 * 기능 추가 시 push/location/billing/browser 어댑터도 여기에 re-export.
 */
export { isNativeApp, isInstalledApp } from './env';
export { platformAuth } from './auth';
export { registerNativePush, unregisterNativePush, isNativePushRegistered, setupNativePushListeners } from './push';
export { getCurrentPosition, isGeolocationAvailable } from './location';
export { platformPayments, type PurchaseResult } from './payments';
