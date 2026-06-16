/**
 * 푸시 구독 보장 헬퍼.
 *
 * 호출 시 다음을 보장:
 *   1) 브라우저 pushManager 에 구독 있음 (없으면 생성)
 *   2) DB push_subscriptions 에 endpoint upsert
 *   3) profiles.is_push_enabled = true 갱신
 *
 * **반드시 user-gesture 콜스택에서 호출** (iOS Safari 가
 * pushManager.subscribe() 를 user gesture 안에서만 허용).
 *
 * 호출 지점:
 *   - records/add, records/[id]/edit: 약 알림 토글 ON / soft-prompt 수락
 *   - profile: 마이페이지 알림 토글 ON
 *   - AuthContext: auto-resub (gesture 없지만 기존 구독은 유지)
 *
 * 멱등성:
 *   - 이미 구독 있으면 재생성 안 함 (기존 endpoint 그대로 upsert)
 *   - POST /api/push/subscribe 는 (user_id, endpoint) upsert
 *   - 반복 호출 안전
 */

import { supabase } from './supabase';
import { authFetch } from './authFetch';
import { isNativeApp } from './platform/env';
import { registerNativePush } from './platform/push';

export type EnsurePushResult =
  | { ok: true; endpoint: string; created: boolean }
  | { ok: false; reason: 'no-permission' | 'no-vapid' | 'sw-not-ready' | 'subscribe-failed' | 'server-failed'; error?: unknown };

export async function ensurePushSubscribed(userId: string): Promise<EnsurePushResult> {
  if (typeof window === 'undefined') return { ok: false, reason: 'sw-not-ready' };

  // 네이티브 앱: web-push 대신 FCM 등록 (권한+토큰→서버 저장).
  if (isNativeApp()) {
    const ok = await registerNativePush();
    if (!ok) return { ok: false, reason: 'no-permission' };
    try {
      await supabase.from('profiles').update({ is_push_enabled: true }).eq('id', userId);
    } catch {}
    return { ok: true, endpoint: 'fcm', created: true };
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return { ok: false, reason: 'no-permission' };
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'sw-not-ready' };
  }
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return { ok: false, reason: 'no-vapid' };

  let reg: ServiceWorkerRegistration;
  try {
    reg = await navigator.serviceWorker.ready;
  } catch (err) {
    return { ok: false, reason: 'sw-not-ready', error: err };
  }

  let sub = await reg.pushManager.getSubscription();
  let created = false;
  if (!sub) {
    try {
      const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
      const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
      const raw = atob(base64);
      const arr = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: arr,
      });
      created = true;
    } catch (err) {
      return { ok: false, reason: 'subscribe-failed', error: err };
    }
  }

  const json = sub.toJSON();
  try {
    const res = await authFetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys_p256dh: json.keys?.p256dh,
        keys_auth: json.keys?.auth,
      }),
    });
    if (!res.ok) return { ok: false, reason: 'server-failed' };
  } catch (err) {
    return { ok: false, reason: 'server-failed', error: err };
  }

  // is_push_enabled = true (사용자 의사 재표명).
  // 실패해도 구독은 이미 됐으므로 ok 로 반환 (이건 부수 효과).
  try {
    await supabase.from('profiles').update({ is_push_enabled: true }).eq('id', userId);
  } catch {
    // 무시 — 다음 mypage 진입 시 재동기화됨
  }

  return { ok: true, endpoint: json.endpoint || '', created };
}
