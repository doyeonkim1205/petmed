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

const FCM_TOKEN_KEY = 'pawdex_fcm_token';
const NOTI_ICON = 'ic_stat_pawdex';
const NOTI_COLOR = '#2563EB';

let localNotifId = 1;
let listenersReady = false;

/** 네이티브 FCM 등록: 권한 요청 → 토큰 수신 → /api/push/fcm/register 저장. */
export async function registerNativePush(): Promise<boolean> {
  const { PushNotifications } = await import('@capacitor/push-notifications');

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive !== 'granted') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') return false;

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
