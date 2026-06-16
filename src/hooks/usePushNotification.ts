'use client';

import { useState, useEffect, useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import { authFetch } from '@/lib/authFetch';
import { isNativeApp, registerNativePush, unregisterNativePush, isNativePushRegistered } from '@/lib/platform';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function usePushNotification() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 네이티브 앱: FCM 사용 → Service Worker 경로 건너뜀.
    if (isNativeApp()) {
      setIsSupported(true);
      setIsSubscribed(isNativePushRegistered());
      return;
    }
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      });
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) return false;
    setLoading(true);

    try {
      // 네이티브: FCM 등록 (권한 → 토큰 → 서버 저장).
      if (isNativeApp()) {
        const ok = await registerNativePush();
        setIsSubscribed(ok);
        return ok;
      }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error('VAPID public key not configured');
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = sub.toJSON();
      await authFetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys_p256dh: json.keys?.p256dh,
          keys_auth: json.keys?.auth,
        }),
      });

      setIsSubscribed(true);
      return true;
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'push', action: 'subscribe' },
      });
      console.error('Push subscribe failed:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false;
    setLoading(true);

    try {
      // 네이티브: FCM 토큰 해제.
      if (isNativeApp()) {
        await unregisterNativePush();
        setIsSubscribed(false);
        return true;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await authFetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
      return true;
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'push', action: 'unsubscribe' },
      });
      console.error('Push unsubscribe failed:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  return { isSupported, isSubscribed, loading, subscribe, unsubscribe };
}
