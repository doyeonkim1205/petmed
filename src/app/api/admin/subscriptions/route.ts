import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let subQuery = supabase
    .from('subscriptions')
    .select('*, profiles!inner(email, nickname)', { count: 'exact' });

  if (status) {
    subQuery = subQuery.eq('status', status);
  }

  const { data: subscriptions, count } = await subQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  let payQuery = supabase
    .from('payment_history')
    .select('*, profiles!inner(email, nickname)', { count: 'exact' });

  const { data: payments, count: paymentCount } = await payQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return NextResponse.json({
    subscriptions: subscriptions || [],
    subscriptionTotal: count || 0,
    payments: payments || [],
    paymentTotal: paymentCount || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
