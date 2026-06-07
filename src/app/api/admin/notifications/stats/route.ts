import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';

/**
 * 관리자 알림 발송 페이지용 통계 엔드포인트.
 *
 * 반환값:
 *   - subscriberCounts: 대상 그룹별 "활성 구독자 수" (push_subscriptions row 기준)
 *   - recentSends: 최근 관리자가 보낸 푸시 내역
 *   - diagnostics: 푸시 시스템 건강 진단 (cron 24시간 통계 / 제공자별 구독 분포 /
 *     유령 후보 — 알림 ON 인데 push_subscriptions 없음)
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
  const [allProfiles, plusProfiles, freeProfiles, allSubs] = await Promise.all([
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('plan', 'plus'),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('plan', 'free'),
    supabaseAdmin.from('push_subscriptions').select('user_id, endpoint'),
  ]);

  const subsRows = allSubs.data || [];
  const subscribedUserIds = new Set<string>(subsRows.map((s: any) => s.user_id));

  const [plusUsers, freeUsers] = await Promise.all([
    supabaseAdmin.from('profiles').select('id').eq('plan', 'plus'),
    supabaseAdmin.from('profiles').select('id').eq('plan', 'free'),
  ]);

  const countSubsIn = (users: any[] | null) =>
    (users || []).filter((u: any) => subscribedUserIds.has(u.id)).length;

  const subscriberCounts: Record<TargetKey, { total: number; subscribed: number }> = {
    all: { total: allProfiles.count || 0, subscribed: subscribedUserIds.size },
    plus: { total: plusProfiles.count || 0, subscribed: countSubsIn(plusUsers.data) },
    free: { total: freeProfiles.count || 0, subscribed: countSubsIn(freeUsers.data) },
  };

  // 2) 최근 20건 발송 내역
  const { data: recent } = await supabaseAdmin
    .from('activity_logs')
    .select('id, created_at, details')
    .eq('action', 'admin.push_send')
    .order('created_at', { ascending: false })
    .limit(20);

  // 3) 진단 통계 — cron 24시간 / 제공자 분포 / 유령 후보
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [cronLogs, pushOnUsers] = await Promise.all([
    supabaseAdmin
      .from('activity_logs')
      .select('details')
      .eq('action', 'cron.push_notifications')
      .gte('created_at', since),
    // is_push_enabled=true 인 유저 — 알림 켜기 의사 표명한 유저
    supabaseAdmin.from('profiles').select('id').eq('is_push_enabled', true),
  ]);

  // cron 24시간 통계
  let cronRuns = 0;
  let cronSent = 0;
  let cronFailed = 0;
  for (const log of cronLogs.data || []) {
    cronRuns++;
    const details = (log as any).details || {};
    cronSent += Number(details.sent || 0);
    cronFailed += Number(details.failed || 0);
  }

  // 제공자별 구독 분포 (FCM / Apple / Mozilla / 기타)
  const providerCounts = { fcm: 0, apple: 0, mozilla: 0, other: 0 };
  for (const sub of subsRows) {
    const ep: string = (sub as any).endpoint || '';
    if (ep.includes('fcm.googleapis.com') || ep.includes('android.googleapis.com')) providerCounts.fcm++;
    else if (ep.includes('web.push.apple.com')) providerCounts.apple++;
    else if (ep.includes('mozilla.com')) providerCounts.mozilla++;
    else providerCounts.other++;
  }

  // 유령 후보: 알림 ON 인데 push_subscriptions 에 row 없는 유저.
  // 일반적인 원인: cron 410/404 → 서버에서 row 삭제됐는데 브라우저는 구독 살아있다고 믿는 상태.
  // 다음 앱 로드 때 AuthContext auto-resub 가 자동 복구해야 정상.
  const ghostCandidateIds = (pushOnUsers.data || [])
    .map((p: any) => p.id)
    .filter((id: string) => !subscribedUserIds.has(id));

  // 유령 후보의 이메일 조회 (관리자가 빠르게 식별 가능하도록).
  //   auth.admin.listUsers 는 perPage 1000 cap 이라 유저 1000+ 시 누락 → profiles.email 로
  //   유령 후보 id 만 직접 조회 (cap 없음 + 필요한 row 만).
  let ghostCandidates: Array<{ id: string; email: string | null }> = [];
  if (ghostCandidateIds.length > 0) {
    const { data: ghostProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .in('id', ghostCandidateIds);
    const emailById = new Map<string, string>(
      (ghostProfiles || []).map((p: any) => [p.id, p.email]),
    );
    ghostCandidates = ghostCandidateIds.map((id: string) => ({
      id,
      email: emailById.get(id) ?? null,
    }));
  }

  // cron 실행 건강 — pg_cron 의 job_run_details 에서 마지막 실행 시각.
  // activity_logs 와 별개로 cron 자체 기록 → 발송 0 인 빈 분도 포함.
  // 2분 이상 지나면 lagging, 1시간 이상이면 dead 로 판정.
  let cronHealth: { lastRunAt: string | null; status: 'healthy' | 'lagging' | 'dead' | 'unknown' } = {
    lastRunAt: null,
    status: 'unknown',
  };
  try {
    const { data: cronRun } = await supabaseAdmin
      .rpc('get_cron_last_run', { p_jobname: 'push-notifications' })
      .maybeSingle<{ start_time: string; status: string }>();
    if (cronRun?.start_time) {
      const lastMs = new Date(cronRun.start_time).getTime();
      const minsSince = (Date.now() - lastMs) / 60000;
      cronHealth = {
        lastRunAt: cronRun.start_time,
        status: minsSince < 2 ? 'healthy' : minsSince < 60 ? 'lagging' : 'dead',
      };
    }
  } catch {
    // 함수 미존재 또는 권한 오류 — unknown 으로 남김
  }

  const diagnostics = {
    // cron24h.runs 는 이제 "발송 활동이 있었던 분(분 단위)" 의미.
    // 빈 분은 activity_logs 에 안 남기므로 작은 숫자 정상.
    // "cron 살아있나" 는 cronHealth 로 따로 표시.
    cron24h: { runs: cronRuns, sent: cronSent, failed: cronFailed },
    cronHealth,
    providerCounts,
    ghostCandidates,
  };

  return NextResponse.json({
    subscriberCounts,
    recentSends: recent || [],
    diagnostics,
  });
}
