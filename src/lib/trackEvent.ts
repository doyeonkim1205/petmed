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
