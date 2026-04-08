import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Disable auto-renewal: keeps the user on Plus until period_end, but no
 * future automatic charges happen. The current period stays valid; after
 * period_end the expire-subscriptions cron will downgrade them to free.
 *
 * NOTE: This is intentionally NOT the same as cancellation/refund.
 * Cancellation goes through /api/payments/cancel.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  try {
    const { data: sub, error: fetchErr } = await supabaseAdmin
      .from('subscriptions')
      .select('id, billing_type, status')
      .eq('user_id', userId)
      .single();

    if (fetchErr || !sub) {
      return NextResponse.json({ error: '구독 정보를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (sub.billing_type !== 'recurring') {
      return NextResponse.json({ error: '자동 갱신이 활성화되어 있지 않습니다.' }, { status: 400 });
    }
    if (sub.status !== 'active') {
      return NextResponse.json({ error: '활성 구독이 아닙니다.' }, { status: 400 });
    }

    // Drop billing key and switch to one_time so the auto-billing cron
    // never picks this row up again. period_end stays as-is.
    await supabaseAdmin
      .from('subscriptions')
      .update({
        billing_type: 'one_time',
        toss_billing_key: null,
        next_billing_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id);

    const { logActivity } = await import('@/lib/activityLog');
    logActivity(userId, 'subscription.auto_renew_disabled', {});

    return NextResponse.json({
      success: true,
      message: '자동 갱신이 해제되었습니다. 현재 결제 주기 만료일까지 계속 이용하실 수 있습니다.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '처리에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
