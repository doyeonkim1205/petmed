import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface LogOptions {
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

/**
 * Server-side activity logger using service role (bypasses RLS).
 * Use this in API routes and cron jobs where no user session exists
 * or where we need to log with elevated permissions.
 *
 * For client-side code, use logActivity from @/lib/activityLog instead.
 */
export async function logActivityServer(
  userId: string | null,
  action: string,
  opts?: LogOptions,
): Promise<void> {
  const { error } = await supabaseAdmin.from('activity_logs').insert({
    user_id: userId,
    action,
    resource_type: opts?.resourceType ?? null,
    resource_id: opts?.resourceId ?? null,
    details: opts?.details ?? {},
  });
  if (error) console.error('server activity log failed:', error.message);
}
