import { supabase } from './supabase';
import { getDeviceId } from './deviceId';

/**
 * fetch wrapper that automatically adds Supabase Authorization header
 * and X-Device-Id header for session tracking.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
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

  // Handle session eviction
  if (response.status === 403) {
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
