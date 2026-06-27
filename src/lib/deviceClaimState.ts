/**
 * 기기 claim 진행 상태 — authFetch 와 deviceSession 이 함께 보는 공유 플래그.
 * (두 모듈 간 순환 import 를 피하려고 상태만 별도 모듈로 분리)
 *
 * 로그인 직후 claim(POST /api/sessions) 이 끝나기 전·직후 짧은 grace 동안에는
 * verify·기기체크 403 으로 "방금 로그인한 자기 자신"을 쫓아내지 않게 한다
 * (조기 로그아웃 = 더블 로그인 버그 방지). 윈도우가 지나면 정상 차단 재개.
 */
let claimInFlight = false;
let graceUntil = 0;

export function beginClaim(): void {
  claimInFlight = true;
}

export function endClaim(graceMs = 5000): void {
  claimInFlight = false;
  graceUntil = Date.now() + graceMs;
}

/** claim 진행 중이거나 직후 grace 안이면 true — 이때 verify/기기체크 403 무시. */
export function isInClaimWindow(): boolean {
  return claimInFlight || Date.now() < graceUntil;
}
