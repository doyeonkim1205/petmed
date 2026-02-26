import { supabase } from '@/lib/supabase';

interface LogOptions {
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

/**
 * Fire-and-forget activity logger (client-side, uses anon key with RLS).
 * Never throws — failures are silently logged to console.
 */
export function logActivity(
  userId: string,
  action: string,
  opts?: LogOptions,
): void {
  supabase
    .from('activity_logs')
    .insert({
      user_id: userId,
      action,
      resource_type: opts?.resourceType ?? null,
      resource_id: opts?.resourceId ?? null,
      details: opts?.details ?? {},
    })
    .then(({ error }) => {
      if (error) console.error('activity log failed:', error.message);
    });
}
