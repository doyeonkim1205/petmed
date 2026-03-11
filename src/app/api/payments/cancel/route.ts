import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  try {
    const body = await request.json().catch(() => ({}));
    const cancelReason = body.reason || '';

    // Get current subscription
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!subscription) {
      return NextResponse.json({ error: '활성 구독이 없습니다.' }, { status: 404 });
    }

    // Mark subscription as canceled (access continues until period_end)
    await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'active');

    const { logActivity } = await import('@/lib/activityLog');
    logActivity(userId, 'subscription.cancel', { details: { plan: subscription.plan } });

    const { logSubscriptionEvent } = await import('@/lib/subscriptionEvents');
    await logSubscriptionEvent(userId, 'cancel', subscription.plan, undefined, cancelReason || '사용자 해지 요청');

    return NextResponse.json({
      success: true,
      message: `구독이 해지되었습니다. ${new Date(subscription.period_end).toLocaleDateString('ko-KR')}까지 이용 가능합니다.`,
      periodEnd: subscription.period_end,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '구독 해지에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
