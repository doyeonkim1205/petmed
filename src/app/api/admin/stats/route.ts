import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date().toISOString().split('T')[0];

  const [
    { count: totalUsers },
    { count: todaySearches },
    { data: revenue },
    { count: activeSubscribers },
    { count: todaySignups },
    { data: profiles },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('search_logs').select('*', { count: 'exact', head: true }).gte('created_at', today),
    supabase.from('payment_history').select('amount').eq('status', 'done'),
    supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', today),
    supabase.from('profiles').select('plan'),
  ]);

  const counts: Record<string, number> = {};
  (profiles || []).forEach((p: { plan: string }) => {
    counts[p.plan] = (counts[p.plan] || 0) + 1;
  });
  const planDistribution = Object.entries(counts).map(([plan, count]) => ({ plan, count }));

  const totalRevenue = (revenue || []).reduce((sum: number, r: { amount: number }) => sum + r.amount, 0);

  return NextResponse.json({
    totalUsers: totalUsers || 0,
    todaySearches: todaySearches || 0,
    totalRevenue,
    activeSubscribers: activeSubscribers || 0,
    todaySignups: todaySignups || 0,
    planDistribution: planDistribution || [],
  });
}
