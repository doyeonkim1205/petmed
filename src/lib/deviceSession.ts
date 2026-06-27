import type { User } from '@supabase/supabase-js';
import { getDeviceId } from './deviceId';
import { getPlatform } from './platform/env';
import { beginClaim, endClaim, isInClaimWindow } from './deviceClaimState';

/**
 * 기기 세션(active_sessions) 관리 — claim / verify 분리.
 *
 * 정책: 마지막 로그인 우선(last-login-wins). 허용 대수는 plans.maxDevices(서버).
 *
 * - claimDevice: "이 기기가 슬롯 차지" — 진짜 새 로그인 때만. 서버가 등록 +
 *   maxDevices 초과 시 오래된 기기 evict.
 * - verifyDevice: "내 기기가 아직 active 인지만 확인"(읽기 전용). 밀려났으면
 *   403 → 호출부에서 직접 signOut + 리다이렉트.
 *
 * 핑퐁/조기로그아웃 방지 2중 장치:
 *  - localStorage deviceClaimedSignIn_{id}: 같은 로그인(signInKey)으로 재claim 금지
 *    (새로고침 넘어 유지 → 리로드 핑퐁 차단)
 *  - deviceClaimState(모듈): claim 진행중/직후 grace 동안 verify·기기체크 403 무시
 *    (같은 세션 내 다중 SIGNED_IN 레이스로 자기 자신 조기 로그아웃 차단)
 */

const FRESH_MS = 90_000;
const GRACE_MS = 5_000;

function getClaimedKey(userId: string): string | null {
  try { return localStorage.getItem(`deviceClaimedSignIn_${userId}`); } catch { return null; }
}
function markClaimed(userId: string, signInKey: string): void {
  try { localStorage.setItem(`deviceClaimedSignIn_${userId}`, signInKey); } catch {}
}

/**
 * 로그인/복원/갱신 시 호출 — claim 할지 verify 할지 자동 결정.
 *   ① fresh 새 로그인(이 기기가 이 signInKey 로 아직 claim 안 함) → claim
 *   ② claim 진행중/직후 grace → no-op (조기 로그아웃 방지)
 *   ③ 그 외(복원·갱신·이미 claim 한 로그인) → verify
 * init·onAuthStateChange 양쪽에서 이걸 쓴다.
 */
export async function syncDeviceSession(user: User | null | undefined): Promise<void> {
  if (!user) return;
  const signInKey = user.last_sign_in_at ?? null;
  if (!signInKey) { await verifyDevice(); return; }

  const fresh = Date.now() - new Date(signInKey).getTime() < FRESH_MS;

  // ① 새 로그인 claim
  if (fresh && getClaimedKey(user.id) !== signInKey && !isInClaimWindow()) {
    beginClaim();
    try {
      await claimDevice();
      markClaimed(user.id, signInKey);
    } finally {
      endClaim(GRACE_MS);
    }
    return;
  }

  // ② claim 윈도우(진행중/grace) → no-op
  if (isInClaimWindow()) return;

  // ③ verify
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
 * - claim 진행중/직후 grace 동안엔 호출 자체를 no-op (자기 자신 조기 로그아웃 방지)
 * - 403(밀려남)이면 authFetch 전역 핸들러에 맡기지 않고 여기서 직접 signOut + 리다이렉트
 *   (verify 는 skipAutoEviction 으로 호출 → DEVICE_EVICTED 를 호출부가 처리)
 * - 네트워크 오류 시엔 로그아웃하지 않음(낙관적 유지)
 */
export async function verifyDevice(): Promise<void> {
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
