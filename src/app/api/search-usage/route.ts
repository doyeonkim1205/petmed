import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';
import { getPlanConfig } from '@/lib/plans';
import { startOfDayKST } from '@/lib/dailyBoundary';

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

  // Count today's searches (KST 기준 자정부터 + 질병 검색만)
  const { count } = await supabaseAdmin
    .from('search_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', 'disease')
    .gte('created_at', startOfDayKST().toISOString());

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

  // Count today's searches (KST 기준 자정부터 + 질병 검색만)
  const { count } = await supabaseAdmin
    .from('search_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', 'disease')
    .gte('created_at', startOfDayKST().toISOString());

  if (dailyLimit > 0 && (count || 0) >= dailyLimit) {
    // 메시지는 `\n` 기준으로 두 줄 구성.
    // 첫 줄: 한도 안내, 둘째 줄: 리셋 시각.
    // 클라이언트가 split 해서 첫 줄은 일반 폰트, 둘째 줄은 작게 렌더.
    return NextResponse.json({
      allowed: false,
      reason: `오늘의 검색 횟수(${dailyLimit}회)를 모두 사용했습니다.\n밤 12시(자정)에 초기화됩니다.`,
      plan,
    });
  }

  // Log the search (명시적으로 kind='disease' 지정. DEFAULT 'disease' 라 생략해도 되지만 의도 명확히)
  await supabaseAdmin.from('search_logs').insert({
    user_id: userId,
    query: query || '',
    pet_type: petType || 'dog',
    kind: 'disease',
  });

  return NextResponse.json({ allowed: true, plan });
}
