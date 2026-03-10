import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';
import { getPlanConfig } from '@/lib/plans';

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

  const plan = profile?.plan || 'free';
  const config = getPlanConfig(plan);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [searchCount, refineCount] = await Promise.all([
    supabaseAdmin
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', 'symptom.search')
      .gte('created_at', startOfDay.toISOString()),
    supabaseAdmin
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', 'symptom.refine')
      .gte('created_at', startOfDay.toISOString()),
  ]);

  return NextResponse.json({
    plan,
    search: {
      used: searchCount.count || 0,
      limit: config.symptomSearchPerDay,
    },
    refine: {
      used: refineCount.count || 0,
      limit: config.symptomRefinePerDay,
    },
  });
}
