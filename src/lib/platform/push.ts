/**
 * 푸시 어댑터 — 네이티브(Capacitor) FCM 등록/해제.
 *
 * 웹/TWA 는 기존 Service Worker + Web Push(usePushNotification)를 그대로 쓰고,
 * 네이티브 앱에서만 @capacitor/push-notifications(FCM) 로 토큰을 받아 서버에 등록한다.
 * 발송 시 서버는 web-push 구독과 FCM 토큰 양쪽으로 보낸다(Phase 2).
 *
 * 네이티브 구현은 동적 import 되어 웹/TWA 번들엔 포함되지 않는다.
 */
import { authFetch } from '@/lib/authFetch';

const FCM_TOKEN_KEY = 'pawdex_fcm_token';

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
    const finish = (ok: boolean) => {
      if (!done) {
        done = true;
        resolve(ok);
      }
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
    });
    PushNotifications.addListener('registrationError', () => finish(false));

    PushNotifications.register();
    // 토큰 수신이 지연/실패해도 UI 가 무한 대기하지 않도록 가드.
    setTimeout(() => finish(false), 15000);
  });
}

/** 네이티브 FCM 해제: 저장된 토큰 삭제 + 리스너 정리. */
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

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.removeAllListeners();
  } catch {}
  return true;
}

/** 네이티브 FCM 등록 여부(로컬 토큰 존재 기준 — 토글 UI 표시용). */
export function isNativePushRegistered(): boolean {
  try { return !!localStorage.getItem(FCM_TOKEN_KEY); } catch { return false; }
}
