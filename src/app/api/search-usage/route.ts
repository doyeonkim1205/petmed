import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';
import { getPlanConfig } from '@/lib/plans';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET: Check remaining search count for the user
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

  const plan = profile?.plan || 'free';
  const config = getPlanConfig(plan);
  const isApp = request.headers.get('x-platform') === 'app';
  const dailyLimit = (plan === 'free' && isApp) ? 5 : config.searchPerDay;

  // Count today's searches
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from('search_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString());

  const used = count || 0;
  const unlimited = dailyLimit === 0;
  return NextResponse.json({
    plan,
    limit: dailyLimit,
    used,
    remaining: unlimited ? 999 : Math.max(0, dailyLimit - used),
    unlimited,
    period: 'day',
  });
}

/**
 * POST: Log a search and check if allowed
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  const { query, petType } = await request.json();

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();

  const plan = profile?.plan || 'free';
  const config = getPlanConfig(plan);
  const isApp = request.headers.get('x-platform') === 'app';
  const dailyLimit = (plan === 'free' && isApp) ? 5 : config.searchPerDay;

  // Count today's searches
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from('search_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString());

  if (dailyLimit > 0 && (count || 0) >= dailyLimit) {
    return NextResponse.json({
      allowed: false,
      reason: `오늘의 검색 횟수(${dailyLimit}회)를 모두 사용했습니다.${plan === 'premium' ? ' 추가 용량이 필요하시면 문의해 주세요.' : ' 업그레이드하여 더 많은 검색을 이용하세요.'}`,
      plan,
    });
  }

  // Log the search
  await supabaseAdmin.from('search_logs').insert({
    user_id: userId,
    query: query || '',
    pet_type: petType || 'dog',
  });

  return NextResponse.json({ allowed: true, plan });
}
