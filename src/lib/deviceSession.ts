import { getDeviceId } from './deviceId';
import { getPlatform } from './platform/env';
import { beginClaim, endClaim, isInClaimWindow } from './deviceClaimState';
import { dlog } from './devlog';

/**
 * ⚠️ 진단 모드 — verify 가 절대 signOut/redirect 하지 않음(로그만). 원인 파악용.
 * 정상 동작은 verify 403 시 로그아웃이지만, 디버깅 중엔 로그인 깨짐 방지 위해 끈다.
 */

const GRACE_MS = 5_000;
const PENDING_CLAIM_KEY = 'pendingDeviceClaim';

export function markPendingClaim(): void {
  try { localStorage.setItem(PENDING_CLAIM_KEY, '1'); dlog('markPendingClaim() set'); } catch {}
}
export function clearPendingClaim(): void {
  try { localStorage.removeItem(PENDING_CLAIM_KEY); dlog('clearPendingClaim()'); } catch {}
}
function hasPendingClaim(): boolean {
  try { return localStorage.getItem(PENDING_CLAIM_KEY) === '1'; } catch { return false; }
}

export async function syncDeviceSession(user: { id: string } | null | undefined): Promise<void> {
  if (!user) { dlog('sync: no user → skip'); return; }
  const pending = hasPendingClaim();
  const inWin = isInClaimWindow();
  dlog(`sync: dev=${getDeviceId().slice(0, 8)} pending=${pending} claimWin=${inWin}`);
  if (pending) {
    beginClaim();        // 윈도우 먼저 켜고(verify 차단) 그다음 플래그 소비
    clearPendingClaim();
    try {
      await claimDevice();
    } finally {
      endClaim(GRACE_MS);
    }
    return;
  }
  if (inWin) { dlog('sync: in claim window → no-op'); return; }
  await verifyDevice();
}

export async function claimDevice(): Promise<void> {
  try {
    const { authFetch } = await import('./authFetch');
    const res = await authFetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), platform: getPlatform() }),
    });
    let body = '';
    try { body = JSON.stringify(await res.clone().json()); } catch {}
    dlog(`claim POST → ${res.status} ${body.slice(0, 120)}`);
  } catch (e) {
    dlog(`claim POST ERROR ${(e as Error)?.message || e}`);
  }
}

/**
 * ⚠️ 진단 모드: 403(밀려남)이어도 signOut/redirect 안 함 — 결과만 로그.
 */
export async function verifyDevice(): Promise<void> {
  // claim 예정(pendingClaim) 또는 진행중/grace(claimWindow) 면 verify 보류.
  //   로그인 직후 DeviceGuard 가 claim 보다 먼저 verify 를 쏴 not-yet-claimed 기기를
  //   403 으로 쫓아내던 레이스 차단.
  if (hasPendingClaim()) { dlog('verify: pendingClaim → skip'); return; }
  if (isInClaimWindow()) { dlog('verify: in claim window → skip'); return; }
  try {
    const { authFetch } = await import('./authFetch');
    const res = await authFetch('/api/sessions/verify', { method: 'GET' }, { skipAutoEviction: true });
    let body = '';
    try { body = JSON.stringify(await res.clone().json()); } catch {}
    dlog(`verify GET → ${res.status} ${body.slice(0, 120)}${res.status === 403 ? '  [정상모드면 여기서 로그아웃]' : ''}`);
  } catch (e) {
    dlog(`verify GET ERROR ${(e as Error)?.message || e}`);
  }
}
