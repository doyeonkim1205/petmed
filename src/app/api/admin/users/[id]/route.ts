import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile, error: dbError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (dbError || !profile) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
  }

  const [{ data: subscription }, { count: searchCount }, { data: payments }] = await Promise.all([
    supabase.from('subscriptions').select('*').eq('user_id', id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('search_logs').select('*', { count: 'exact', head: true }).eq('user_id', id),
    supabase.from('payment_history').select('id, amount, status, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
  ]);

  return NextResponse.json({ profile, subscription, searchCount: searchCount || 0, payments: payments || [] });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, string> = {};

  if (body.plan) updates.plan = body.plan;
  if (body.role) updates.role = body.role;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '변경할 항목이 없습니다.' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Update profile
  const { data, error: dbError } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // When admin changes plan to a paid plan, ensure a subscription row exists
  // so the subscription management page works correctly.
  if (updates.plan && updates.plan !== 'free') {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await supabase.from('subscriptions').upsert(
      {
        user_id: id,
        plan: updates.plan,
        product_id: `${updates.plan}_monthly`,
        status: 'active',
        billing_type: 'one_time',
        period_start: now.toISOString(),
        period_end: periodEnd.toISOString(),
        canceled_at: null,
        updated_at: now.toISOString(),
      },
      { onConflict: 'user_id' },
    );
  }

  // When admin downgrades to free, expire the subscription
  if (updates.plan === 'free') {
    await supabase
      .from('subscriptions')
      .update({
        status: 'expired',
        billing_type: 'one_time',
        toss_billing_key: null,
        next_billing_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', id)
      .in('status', ['active', 'canceled']);
  }

  return NextResponse.json(data);
}
