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

/**
 * "이 로그인에 대해 아직 claim 안 했나" — fresh(<90s) AND 이 last_sign_in_at 값으로
 * 아직 claim 한 적 없을 때만 true.
 *
 * ⚠️ 핑퐁 방지의 핵심. fresh 만 보면 last_sign_in_at 이 90초간 계속 true 라,
 * 그 사이 포그라운드 복귀/SIGNED_IN 재발생마다 다시 claim 해서 두 기기가 서로
 * 슬롯을 뺏는다. last_sign_in_at "값"으로 dedup 해 로그인 1회당 claim 1회만 보장.
 */
function isUnclaimedLogin(user: User | null | undefined): boolean {
  const ts = user?.last_sign_in_at;
  if (!ts) return false;
  if (Date.now() - new Date(ts).getTime() >= 90_000) return false;
  try {
    return localStorage.getItem(`deviceClaimedSignIn_${user!.id}`) !== ts;
  } catch {
    return false;
  }
}

/**
 * 기기 세션 동기화 — claim/verify 자동 선택.
 *   진짜 새 로그인(아직 claim 안 함) → claimDevice (슬롯 차지)
 *   그 외(앱 복원·토큰 갱신·탭 포커스·이미 claim한 로그인) → verifyDevice (읽기전용)
 * init·onAuthStateChange 양쪽에서 이걸 쓰면 규칙이 한 곳에 통일되고 핑퐁이 없다.
 */
export async function syncDeviceSession(user: User | null | undefined): Promise<void> {
  if (!user) return;
  if (isUnclaimedLogin(user)) {
    // claim 전에 먼저 마킹(동시 이벤트 중복 claim 차단). 값=이번 로그인 timestamp.
    try { localStorage.setItem(`deviceClaimedSignIn_${user.id}`, user.last_sign_in_at!); } catch {}
    await claimDevice();
  } else {
    await verifyDevice();
  }
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
