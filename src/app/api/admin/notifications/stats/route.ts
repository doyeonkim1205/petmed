import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';

/**
 * 관리자 알림 발송 페이지용 통계 엔드포인트.
 *
 * 반환값:
 *   - subscriberCounts: 대상 그룹별 "활성 구독자 수" (push_subscriptions 에 row 있는 유저 기준)
 *   - recentSends: 최근 관리자가 보낸 푸시 내역 (activity_logs)
 *
 * 한 엔드포인트에서 두 가지 묶어서 반환 — 페이지 마운트 시 한 번만 호출.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type TargetKey = 'all' | 'plus' | 'free';

export async function GET(request: Request) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  // 1) 대상 그룹별 활성 구독자 수
  // push_subscriptions 에 row 존재 = 현재 기기에 구독 endpoint 등록 = 실제 발송 가능한 유저.
  // 전체 유저 수와 나란히 표시해서 "이 그룹에 몇 명이 알림을 켰는지" 한눈에 파악.
  const [allProfiles, plusProfiles, freeProfiles, allSubs] = await Promise.all([
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('plan', 'plus'),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('plan', 'free'),
    supabaseAdmin.from('push_subscriptions').select('user_id'),
  ]);

  // 구독자 user_id 집합
  const subscribedUserIds = new Set<string>((allSubs.data || []).map((s: any) => s.user_id));

  // 플랜별 유저 id 재조회 (plan 필터링용).
  // select 로 한 번 더 부르는 대신 카운트만 별도 쿼리: 플랜별 구독자 수 정확히 세려면 join 필요.
  // 간단하게 플랜별 유저 ID 배열을 받아 Set 교집합으로 계산.
  const [plusUsers, freeUsers] = await Promise.all([
    supabaseAdmin.from('profiles').select('id').eq('plan', 'plus'),
    supabaseAdmin.from('profiles').select('id').eq('plan', 'free'),
  ]);

  const countSubsIn = (users: any[] | null) =>
    (users || []).filter((u: any) => subscribedUserIds.has(u.id)).length;

  const subscriberCounts: Record<TargetKey, { total: number; subscribed: number }> = {
    all: {
      total: allProfiles.count || 0,
      subscribed: subscribedUserIds.size,
    },
    plus: {
      total: plusProfiles.count || 0,
      subscribed: countSubsIn(plusUsers.data),
    },
    free: {
      total: freeProfiles.count || 0,
      subscribed: countSubsIn(freeUsers.data),
    },
  };

  // 2) 최근 20건 발송 내역
  const { data: recent } = await supabaseAdmin
    .from('activity_logs')
    .select('id, created_at, details')
    .eq('action', 'admin.push_send')
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({
    subscriberCounts,
    recentSends: recent || [],
  });
}
