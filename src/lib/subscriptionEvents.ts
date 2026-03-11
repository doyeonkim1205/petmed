import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export type SubscriptionEventType = 'purchase' | 'renew' | 'cancel' | 'refund' | 'expired' | 'downgrade' | 'upgrade';

export async function logSubscriptionEvent(
  userId: string,
  eventType: SubscriptionEventType,
  plan: string,
  amount?: number,
  reason?: string,
) {
  await supabaseAdmin.from('subscription_events').insert({
    user_id: userId,
    event_type: eventType,
    plan,
    amount: amount ?? null,
    reason: reason ?? null,
  });
}
