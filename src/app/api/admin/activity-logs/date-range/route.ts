import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const { user, error } = await verifyAdmin(request);
  if (error) return error;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 현재 관리자의 구독 시작일을 기본 시작일로 사용
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('period_start')
    .eq('user_id', user!.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // 구독이 없으면 가장 오래된 활동 로그 날짜 사용
  let fromDate = '';
  if (sub?.period_start) {
    fromDate = sub.period_start.split('T')[0];
  } else {
    const { data: oldest } = await supabase
      .from('activity_logs')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    if (oldest) {
      fromDate = oldest.created_at.split('T')[0];
    }
  }

  return NextResponse.json({ from: fromDate });
}
