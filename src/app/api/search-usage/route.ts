import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const FREE_DAILY_LIMIT = 3;
const PREMIUM_MONTHLY_LIMIT = 50;

/**
 * GET: Check remaining search count for the user
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  // Get user plan
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();

  const plan = profile?.plan || 'free';
  const isPremium = plan === 'premium';

  if (isPremium) {
    // Count this month's searches
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from('search_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString());

    const used = count || 0;
    return NextResponse.json({
      plan,
      limit: PREMIUM_MONTHLY_LIMIT,
      used,
      remaining: Math.max(0, PREMIUM_MONTHLY_LIMIT - used),
      period: 'month',
    });
  } else {
    // Count today's searches
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from('search_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfDay.toISOString());

    const used = count || 0;
    return NextResponse.json({
      plan,
      limit: FREE_DAILY_LIMIT,
      used,
      remaining: Math.max(0, FREE_DAILY_LIMIT - used),
      period: 'day',
    });
  }
}

/**
 * POST: Log a search and check if allowed
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  const { query, petType } = await request.json();

  // Get user plan
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();

  const plan = profile?.plan || 'free';
  const isPremium = plan === 'premium';

  // Check limit
  if (isPremium) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from('search_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString());

    if ((count || 0) >= PREMIUM_MONTHLY_LIMIT) {
      return NextResponse.json({
        allowed: false,
        reason: `이번 달 검색 횟수(${PREMIUM_MONTHLY_LIMIT}회)를 모두 사용했습니다.`,
        plan,
      });
    }
  } else {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from('search_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfDay.toISOString());

    if ((count || 0) >= FREE_DAILY_LIMIT) {
      return NextResponse.json({
        allowed: false,
        reason: `오늘의 무료 검색 횟수(${FREE_DAILY_LIMIT}회)를 모두 사용했습니다.`,
        plan,
      });
    }
  }

  // Log the search
  await supabaseAdmin.from('search_logs').insert({
    user_id: userId,
    query: query || '',
    pet_type: petType || 'dog',
  });

  return NextResponse.json({ allowed: true, plan });
}
