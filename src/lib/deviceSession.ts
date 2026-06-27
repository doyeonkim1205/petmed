import { getDeviceId } from './deviceId';
import { getPlatform } from './platform/env';
import { beginClaim, endClaim, isInClaimWindow } from './deviceClaimState';

/**
 * 기기 세션(active_sessions) 관리 — claim / verify 분리.
 *
 * 정책: 마지막 로그인 우선(last-login-wins). 허용 대수는 plans.maxDevices(서버).
 *
 * claim 시점을 last_sign_in_at(시각)으로 추정하던 방식은 앱 네이티브 로그인에서
 * 그 값이 갱신되지 않아(로그아웃→재로그인 시) claim 을 건너뛰고 verify 가 삭제된
 * 기기 행을 보고 튕기는 버그가 있었다. → "사용자가 로그인을 시도했다"는 명시적
 * 신호(pendingClaim 플래그)로 전환. 웹 OAuth 리다이렉트도 넘어 유지되도록 localStorage 사용.
 *
 * - markPendingClaim(): 로그인 시도 직전 호출(각 signIn 진입점). 다음 SIGNED_IN 에서 claim.
 * - syncDeviceSession(): SIGNED_IN/init 에서 호출. pendingClaim 이면 claim, 아니면 verify.
 * - claimDevice: 슬롯 차지 + maxDevices 초과 시 오래된 기기 evict (POST).
 * - verifyDevice: 읽기 전용 검증. 밀려났으면 403 → 호출부가 직접 signOut + 리다이렉트.
 *
 * 핑퐁/조기로그아웃 방지: claim 은 "로그인 시도" 때만(복원/갱신엔 안 함) + claimState
 * 모듈의 claim 윈도우(진행중+grace) 동안 verify·기기체크 403 무시.
 */

const GRACE_MS = 5_000;
const PENDING_CLAIM_KEY = 'pendingDeviceClaim';

/** 로그인 시도 직전 호출 — 다음 SIGNED_IN 에서 claim 하도록 표시(웹 리다이렉트 넘어 유지). */
export function markPendingClaim(): void {
  try { localStorage.setItem(PENDING_CLAIM_KEY, '1'); } catch {}
}
/** 로그인 실패/로그아웃 시 표시 해제. */
export function clearPendingClaim(): void {
  try { localStorage.removeItem(PENDING_CLAIM_KEY); } catch {}
}
function hasPendingClaim(): boolean {
  try { return localStorage.getItem(PENDING_CLAIM_KEY) === '1'; } catch { return false; }
}

/**
 * 로그인/복원/갱신 시 호출 — claim 할지 verify 할지 결정.
 *   ① pendingClaim(사용자가 방금 로그인 시도) → claim (1회 소비)
 *   ② claim 윈도우(진행중/grace) → no-op (조기 로그아웃 방지)
 *   ③ 그 외(앱 복원·토큰 갱신) → verify
 */
export async function syncDeviceSession(user: { id: string } | null | undefined): Promise<void> {
  if (!user) return;
  if (hasPendingClaim()) {
    beginClaim();        // 윈도우 먼저 켜고(동시 verify 차단) 그다음 플래그 소비
    clearPendingClaim();
    try {
      await claimDevice();
    } finally {
      endClaim(GRACE_MS);
    }
    return;
  }
  if (isInClaimWindow()) return;
  await verifyDevice();
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
    // 네트워크 오류 — 다음 호출에서 자연 복구. 로그아웃하지 않음.
  }
}

/**
 * 현재 기기가 active 인지 검증(읽기 전용).
 * - claim 진행중/직후 grace 동안엔 no-op (자기 자신 조기 로그아웃 방지)
 * - 403(밀려남)이면 skipAutoEviction 으로 받아 여기서 직접 signOut + 리다이렉트
 * - 네트워크 오류 시엔 로그아웃하지 않음(낙관적 유지)
 */
export async function verifyDevice(): Promise<void> {
  // claim 예정(pendingClaim) 또는 진행중/grace(claimWindow) 면 보류.
  //   로그인 직후(특히 앱: 무세션 init 로 loading 이 이미 false) DeviceGuard 가
  //   claim 보다 먼저 verify 를 쏴 not-yet-claimed 기기를 403 으로 쫓아내던 레이스 차단.
  if (hasPendingClaim()) return;
  if (isInClaimWindow()) return;
  try {
    const { authFetch } = await import('./authFetch');
    const res = await authFetch('/api/sessions/verify', { method: 'GET' }, { skipAutoEviction: true });
    if (res.status === 403) {
      const { supabase } = await import('./supabase');
      await supabase.auth.signOut({ scope: 'local' });
      window.location.href = '/login?reason=session_evicted';
    }
  } catch {
    // 네트워크 오류 — 무시(로그아웃 X)
  }
}
