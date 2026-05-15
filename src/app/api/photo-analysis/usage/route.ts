import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { startOfDayKST } from '@/lib/dailyBoundary';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * 사진 증상 분석 일일 사용량 조회.
 * 응답: { plan, photo: { used, limit } }
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();

  const plan = getEffectivePlan(profile?.plan);
  const config = getPlanConfig(plan);
  const startOfDay = startOfDayKST();

  const { count } = await supabaseAdmin
    .from('search_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', 'symptom_photo')
    .gte('created_at', startOfDay.toISOString());

  return NextResponse.json({
    plan,
    photo: {
      used: count || 0,
      limit: config.photoAnalysisPerDay,
    },
  });
}
