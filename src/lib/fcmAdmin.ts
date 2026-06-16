/**
 * FCM(네이티브 앱) 발송 — firebase-admin (모듈러 API v12).
 *
 * web-push 와 병행: 발송 지점(cron, admin send)에서 push_subscriptions(web) 외에
 * fcm_tokens(native) 로도 보낸다. 서비스 계정 키는 Vercel 환경변수
 * FIREBASE_SERVICE_ACCOUNT (JSON 전체 문자열) 에서 읽는다.
 *
 * 무효 토큰(앱 삭제/만료)은 발송 결과로 감지해 자동 삭제한다.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { SupabaseClient } from '@supabase/supabase-js';

let initialized = false;

/** FIREBASE_SERVICE_ACCOUNT 로 admin 앱 초기화. 키 없거나 파싱 실패면 false. */
function ensureApp(): boolean {
  if (initialized) return true;
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) return false;
  try {
    const cred = JSON.parse(svc);
    if (!getApps().length) {
      initializeApp({ credential: cert(cred) });
    }
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

export type FcmNotification = {
  title: string;
  body: string;
  url: string;
  category?: string;
  tag?: string;
};

/**
 * 한 유저의 모든 FCM 토큰으로 발송. 무효 토큰은 자동 삭제. {sent, failed} 반환.
 * FIREBASE_SERVICE_ACCOUNT 미설정이면 조용히 {0,0} (web-push 만 동작).
 */
export async function sendFcmToUser(
  supabase: SupabaseClient,
  userId: string,
  notification: FcmNotification,
): Promise<{ sent: number; failed: number }> {
  if (!ensureApp()) return { sent: 0, failed: 0 };

  const { data: rows } = await supabase.from('fcm_tokens').select('token').eq('user_id', userId);
  const tokens = (rows || []).map((r) => r.token as string).filter(Boolean);
  if (tokens.length === 0) return { sent: 0, failed: 0 };

  let res;
  try {
    res = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: notification.title, body: notification.body },
      data: {
        url: notification.url || '/',
        category: notification.category || '',
      },
      android: {
        priority: 'high',
        notification: {
          ...(notification.tag ? { tag: notification.tag } : {}),
          channelId: 'default',
          sound: 'default',
          icon: 'ic_stat_pawdex',
          color: '#2563EB',
        },
      },
    });
  } catch {
    return { sent: 0, failed: tokens.length };
  }

  // 무효 토큰 정리 (앱 삭제/재설치로 토큰 폐기).
  const toDelete: string[] = [];
  res.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/invalid-argument'
      ) {
        toDelete.push(tokens[i]);
      }
    }
  });
  if (toDelete.length > 0) {
    await supabase.from('fcm_tokens').delete().in('token', toDelete);
  }

  return { sent: res.successCount, failed: res.failureCount };
}
