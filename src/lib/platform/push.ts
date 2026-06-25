/**
 * 푸시 어댑터 — 네이티브(Capacitor) FCM 등록/해제 + 포그라운드 표시.
 *
 * 웹/TWA 는 기존 Service Worker + Web Push 를 쓰고, 네이티브 앱에서만
 * @capacitor/push-notifications(FCM) 로 토큰을 받아 서버에 등록한다.
 * 포그라운드 수신은 @capacitor/local-notifications 로 직접 띄운다
 * (FCM notification 은 앱이 켜져 있으면 시스템이 자동 표시하지 않음).
 *
 * 네이티브 구현은 동적 import 되어 웹/TWA 번들엔 포함되지 않는다.
 */
import { authFetch } from '@/lib/authFetch';
import { isIOS } from './env';

const FCM_TOKEN_KEY = 'pawdex_fcm_token';
const NOTI_ICON = 'ic_stat_pawdex';
const NOTI_COLOR = '#2563EB';

let localNotifId = 1;
let listenersReady = false;

/**
 * iOS FCM 등록.
 * ⚠️ @capacitor/push-notifications 의 registration 토큰은 iOS 에선 APNs 토큰이라
 *    firebase-admin(FCM) 으로 발송 불가. → APNs 등록(register)으로 Firebase 가 apnsToken 을
 *    잡게 한 뒤, 네이티브 Firebase Messaging 브릿지('PushToken')로 진짜 FCM 토큰을 받아 등록한다.
 */
async function registerIosFcm(
  PushNotifications: typeof import('@capacitor/push-notifications').PushNotifications,
): Promise<boolean> {
  // APNs 등록 (Firebase 가 apnsToken 을 잡도록). registration 리스너는 iOS 에선 쓰지 않음(APNs 토큰이라).
  await PushNotifications.register();

  const { registerPlugin } = await import('@capacitor/core');
  const PushToken = registerPlugin<{
    getFcmToken(): Promise<{ ok: boolean; token?: string; error?: string }>;
  }>('PushToken');

  try {
    const res = await PushToken.getFcmToken();
    if (!res.ok || !res.token) return false;
    await authFetch('/api/push/fcm/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: res.token, platform: 'ios' }),
    });
    try { localStorage.setItem(FCM_TOKEN_KEY, res.token); } catch {}
    return true;
  } catch {
    return false;
  }
}

/**
 * 네이티브 FCM 등록: 권한 → 토큰 수신 → /api/push/fcm/register 저장.
 * opts.prompt=false 면 권한 미허용 시 팝업 없이 종료 (로그인 시 자동 토큰 재귀속용 —
 *   이미 허용된 기기에서만 조용히 재등록, 임의 권한 팝업 방지).
 */
export async function registerNativePush(opts?: { prompt?: boolean }): Promise<boolean> {
  const prompt = opts?.prompt !== false;
  const { PushNotifications } = await import('@capacitor/push-notifications');

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive !== 'granted') {
    if (!prompt) return false;
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') return false;

  // iOS 는 FCM 토큰을 네이티브 브릿지로 받는다(위 설명). Android 는 기존 흐름.
  if (isIOS()) return registerIosFcm(PushNotifications);

  return new Promise<boolean>((resolve) => {
    let done = false;
    let regHandle: { remove: () => void } | undefined;
    let errHandle: { remove: () => void } | undefined;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      regHandle?.remove();
      errHandle?.remove();
      resolve(ok);
    };

    PushNotifications.addListener('registration', async (token) => {
      try {
        await authFetch('/api/push/fcm/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token.value, platform: 'android' }),
        });
        try { localStorage.setItem(FCM_TOKEN_KEY, token.value); } catch {}
        finish(true);
      } catch {
        finish(false);
      }
    }).then((h) => {
      regHandle = h;
    });
    PushNotifications.addListener('registrationError', () => finish(false)).then((h) => {
      errHandle = h;
    });

    PushNotifications.register();
    setTimeout(() => finish(false), 15000);
  });
}

/** 네이티브 FCM 해제: 저장된 토큰 삭제 (포그라운드 리스너는 유지). */
export async function unregisterNativePush(): Promise<boolean> {
  let token: string | null = null;
  try { token = localStorage.getItem(FCM_TOKEN_KEY); } catch {}

  if (token) {
    try {
      await authFetch('/api/push/fcm/register', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch {}
    try { localStorage.removeItem(FCM_TOKEN_KEY); } catch {}
  }
  return true;
}

/** 네이티브 FCM 등록 여부(로컬 토큰 존재 기준 — 토글 UI 표시용). */
export function isNativePushRegistered(): boolean {
  try { return !!localStorage.getItem(FCM_TOKEN_KEY); } catch { return false; }
}

/**
 * 앱 시작 시 1회 등록하는 영구 리스너:
 *   - 포그라운드 푸시 수신 → 로컬 알림으로 표시
 *   - 알림 탭(백그라운드/포그라운드) → 해당 url 로 이동
 */
export async function setupNativePushListeners(navigate: (url: string) => void): Promise<void> {
  if (listenersReady) return;
  listenersReady = true;

  const [{ PushNotifications }, { LocalNotifications }] = await Promise.all([
    import('@capacitor/push-notifications'),
    import('@capacitor/local-notifications'),
  ]);

  // 포그라운드 수신 → 로컬 알림으로 직접 표시.
  await PushNotifications.addListener('pushNotificationReceived', async (notif) => {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: localNotifId++,
            title: notif.title || 'PawDex',
            body: notif.body || '',
            smallIcon: NOTI_ICON,
            iconColor: NOTI_COLOR,
            extra: { url: (notif.data && notif.data.url) || '/' },
          },
        ],
      });
    } catch {}
  });

  // 백그라운드 알림 탭 → 이동.
  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = (action.notification?.data?.url as string) || '/';
    navigate(url);
  });

  // 포그라운드 로컬 알림 탭 → 이동.
  await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const extra = action.notification?.extra as { url?: string } | undefined;
    navigate(extra?.url || '/');
  });
}
