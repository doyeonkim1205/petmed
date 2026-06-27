import { supabase } from './supabase';
import { getDeviceId } from './deviceId';
import { isInClaimWindow } from './deviceClaimState';

/**
 * fetch wrapper that automatically adds Supabase Authorization header
 * and X-Device-Id header for session tracking.
 *
 * 기기 세션 403(session_evicted) 자동 처리:
 *  - 기본: signOut + /login?reason=session_evicted (24개 device-check 라우트용 서버 방어선)
 *  - opts.skipAutoEviction: 자동 처리 끔 → 호출부가 직접 DEVICE_EVICTED 처리 (verify 용)
 *  - claim 윈도우(로그인 직후 claim 진행중/grace) 동안엔 자동 처리 스킵
 *    → 방금 로그인한 자기 자신을 조기 로그아웃하지 않음(더블 로그인 방지)
 */
export async function authFetch(
  url: string,
  options: RequestInit = {},
  opts: { skipAutoEviction?: boolean } = {},
): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const deviceId = getDeviceId();
  if (deviceId) {
    headers.set('X-Device-Id', deviceId);
  }

  const response = await fetch(url, { ...options, headers });

  // Handle session eviction (자동) — verify 는 skipAutoEviction 으로 끄고,
  // claim 윈도우 중에는 조기 로그아웃 방지를 위해 스킵.
  if (response.status === 403 && !opts.skipAutoEviction && !isInClaimWindow()) {
    try {
      const clone = response.clone();
      const data = await clone.json();
      if (data.error === 'session_evicted') {
        await supabase.auth.signOut({ scope: 'local' });
        window.location.href = '/login?reason=session_evicted';
      }
    } catch {}
  }

  return response;
}
