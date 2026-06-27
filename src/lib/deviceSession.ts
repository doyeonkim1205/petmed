import type { User } from '@supabase/supabase-js';
import { getDeviceId } from './deviceId';
import { getPlatform } from './platform/env';

/**
 * 기기 세션(active_sessions) 관리 — claim / verify 분리.
 *
 * 정책: 마지막 로그인 우선(last-login-wins). 무료/Plus 허용 대수는
 * plans.ts 의 maxDevices 로 결정(서버). 클라는 호출 타이밍만 책임진다.
 *
 * - claimDevice: "이 기기가 슬롯을 차지" — 진짜 새 로그인 직후에만 호출.
 *   서버(POST /api/sessions)가 등록 + maxDevices 초과 시 오래된 기기 evict.
 * - verifyDevice: "내 기기가 아직 유효한지만 확인" — 앱 실행/복귀/가드에서 호출.
 *   읽기 전용. 밀려났으면 GET /api/sessions/verify 가 403(session_evicted)을
 *   반환하고 authFetch 가 자동으로 signOut + /login?reason=session_evicted 이동.
 *
 * ⚠️ verify 는 절대 슬롯을 차지/갱신/evict 하지 않는다 (핑퐁 방지).
 */

/** last_sign_in_at 이 방금(<90s)이면 "진짜 새 로그인" — claim 대상. 아니면 복원/갱신 → verify. */
export function isFreshLogin(user: User | null | undefined): boolean {
  const ts = user?.last_sign_in_at;
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() < 90_000;
}

export async function claimDevice(): Promise<void> {
  try {
    const { authFetch } = await import('./authFetch');
    await authFetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), platform: getPlatform() }),
    });
  } catch {
    // 네트워크 오류 — 다음 verify/호출에서 자연 복구. 로그아웃하지 않음.
  }
}

/**
 * 현재 기기가 active 인지 검증(읽기 전용).
 * 밀려난 경우 authFetch 가 403 을 받아 자동 로그아웃 + 리다이렉트 처리하므로
 * 호출부는 보통 결과를 따로 처리할 필요가 없다.
 * 네트워크 오류 시엔 로그아웃하지 않음(낙관적 유지).
 */
export async function verifyDevice(): Promise<void> {
  try {
    const { authFetch } = await import('./authFetch');
    await authFetch('/api/sessions/verify', { method: 'GET' });
  } catch {
    // 네트워크 오류 — 무시(로그아웃 X).
  }
}
