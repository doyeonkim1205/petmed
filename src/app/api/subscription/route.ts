import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();

  // Only return fields the client needs — exclude sensitive fields
  // (toss_billing_key, toss_customer_key, etc.)
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status, billing_type, product_id, period_start, period_end, next_billing_at, canceled_at, card_company, card_number, billing_failed_count')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    plan: profile?.plan || 'free',
    subscription: subscription || null,
  });
}
