import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { startOfDayInTz, startOfWindowInTz } from '@/lib/dailyBoundary';

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
    .select('plan, quota_timezone')
    .eq('id', userId)
    .single();

  const plan = getEffectivePlan(profile?.plan);
  const config = getPlanConfig(plan);

  // 증상분석은 plan 창(무료=월), 재분석은 항상 일일.
  const quotaTz = profile?.quota_timezone || 'Asia/Seoul';
  const searchSince = startOfWindowInTz(config.limitWindow, quotaTz);
  const refineSince = startOfDayInTz(quotaTz);

  const [searchCount, refineCount] = await Promise.all([
    supabaseAdmin
      .from('search_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('kind', 'symptom')
      .gte('created_at', searchSince.toISOString()),
    supabaseAdmin
      .from('search_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('kind', 'symptom_refine')
      .gte('created_at', refineSince.toISOString()),
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
