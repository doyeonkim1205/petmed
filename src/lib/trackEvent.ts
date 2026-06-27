import { authFetch } from '@/lib/authFetch';

/**
 * Track a key user event (page view, button click, etc.)
 * Fire-and-forget — never blocks UI.
 */
export function trackEvent(action: string, details?: Record<string, unknown>) {
  // Don't track in SSR
  if (typeof window === 'undefined') return;

  authFetch('/api/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, details }),
  }).catch(() => {}); // fire and forget
}

/**
 * 페이지 조회를 "기기당 하루 1회"로만 기록 (노이즈/로그폭증 방지).
 * 매 방문이 아니라 "그날 이 기능을 썼다" 신호만 남겨 참여도 파악에 충분.
 * localStorage 로 날짜 키 dedup, 다른 날짜 키는 정리.
 */
export function trackPageViewDaily(action: string) {
  if (typeof window === 'undefined') return;
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `pv_${action}_${today}`;
    if (localStorage.getItem(key)) return; // 오늘 이미 기록함
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(`pv_${action}_`) && k !== key) localStorage.removeItem(k); // 옛 날짜 키 정리
    }
    localStorage.setItem(key, '1');
    trackEvent(action);
  } catch {
    trackEvent(action); // localStorage 불가(프라이버시 모드 등) → 기존대로 기록
  }
}
