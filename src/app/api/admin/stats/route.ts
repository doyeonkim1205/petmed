import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';
import { startOfDayKST } from '@/lib/dailyBoundary';

export async function GET(request: Request) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // KST 자정 기준 "오늘" — Vercel(UTC)에서 new Date().toISOString() 의 날짜 부분을
  //   쓰면 KST 0~9시 사이 어제로 어긋남. startOfDayKST 로 KST 자정 UTC 타임스탬프 사용.
  const today = startOfDayKST().toISOString();

  const [
    { count: totalUsers },
    { count: todaySearches },
    { data: revenue },
    { data: subsRows },
    { count: todaySignups },
    { data: profiles },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('search_logs').select('*', { count: 'exact', head: true }).gte('created_at', today),
    // 매출 = 실결제(production)만. 샌드박스/테스트 결제는 이력엔 남아도 매출 합계 제외.
    supabase.from('payment_history').select('amount').eq('status', 'done').eq('environment', 'production'),
    // 구독 지표는 행 수가 아니라 distinct user_id 로 센다(과거/중복 행 방지).
    //   상태별 분리: 자동갱신(active) vs 해지예정(canceled + 기간 미래).
    supabase.from('subscriptions').select('user_id, status, period_end, canceled_at'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', today),
    supabase.from('profiles').select('plan'),
  ]);

  const counts: Record<string, number> = {};
  (profiles || []).forEach((p: { plan: string }) => {
    counts[p.plan] = (counts[p.plan] || 0) + 1;
  });
  const planDistribution = Object.entries(counts).map(([plan, count]) => ({ plan, count }));

  // 구독 지표 — "활성 구독자" 단일 숫자(status='active' 행 수)는 해지했지만 기간 남은
  //   유저를 놓치고 행 중복도 못 거른다. 그래서 셋으로 분리해 distinct user_id 로 집계:
  //   - plusUsers     : profiles.plan='plus' = 현재 Plus 권한 보유자(앱이 실제로 보는 값)
  //   - autoRenewing  : status='active' & canceled_at 없음 & 기간 미래 = 자동갱신 중
  //   - canceling     : (status='canceled' or canceled_at 있음) & 기간 미래 = 해지 예정(만료까지 이용)
  // ⚠️ 해지 판정을 status 만으로 하면 안 된다 — 스토어(구글/애플) 해지는 status='active' 를 유지한 채
  //    canceled_at 만 찍는다(자동갱신 OFF). status='canceled' 는 토스 직접해지에서만 세팅됨.
  //    따라서 canceled_at 도 함께 봐야 자동갱신/해지예정이 실제와 일치한다(푸시 크론과 동일 기준).
  const nowIso = new Date().toISOString();
  const autoRenewSet = new Set<string>();
  const cancelingSet = new Set<string>();
  for (const s of (subsRows || []) as { user_id: string; status: string; period_end: string | null; canceled_at: string | null }[]) {
    const inPeriod = !!s.period_end && s.period_end > nowIso;
    if (!inPeriod) continue; // 만료 행은 자동갱신도 해지예정도 아님
    const isCanceled = s.status === 'canceled' || !!s.canceled_at;
    if (isCanceled) cancelingSet.add(s.user_id);
    else if (s.status === 'active') autoRenewSet.add(s.user_id);
  }
  const plusUsers = counts['plus'] || 0;
  const autoRenewing = autoRenewSet.size;
  const canceling = cancelingSet.size;

  const totalRevenue = (revenue || []).reduce((sum: number, r: { amount: number }) => sum + r.amount, 0);

  // Heavy user monitoring: users with high record/pet/saved counts
  // (이전의 get_user_*_counts RPC 호출은 결과를 쓰지 않는 dead code 라 제거 — 아래 직접 집계만 사용)
  const heavyUsers: { email: string; nickname: string; plan: string; records: number; pets: number; savedPapers: number }[] = [];

  const profileMap = new Map<string, { email: string; nickname: string; plan: string }>();
  const { data: allProfiles } = await supabase.from('profiles').select('id, email, nickname, plan');
  for (const p of allProfiles || []) {
    profileMap.set(p.id, { email: p.email, nickname: p.nickname, plan: p.plan });
  }

  // Count records per user
  const { data: records } = await supabase.from('health_records').select('user_id');
  const recordMap = new Map<string, number>();
  for (const r of records || []) {
    recordMap.set(r.user_id, (recordMap.get(r.user_id) || 0) + 1);
  }

  // Count pets per user
  const { data: pets } = await supabase.from('pets').select('user_id');
  const petMap = new Map<string, number>();
  for (const p of pets || []) {
    petMap.set(p.user_id, (petMap.get(p.user_id) || 0) + 1);
  }

  // Count saved papers per user — 개별 PubMed 논문 (saved_analyses 의 자식 row)
  const { data: saved } = await supabase.from('saved_papers').select('user_id');
  const savedMap = new Map<string, number>();
  for (const s of saved || []) {
    savedMap.set(s.user_id, (savedMap.get(s.user_id) || 0) + 1);
  }

  // 보관함 — saved_analyses (부모): 논문 분석 세션. saved_papers(자식) 와 부모/자식
  //   관계라 합산 금지. 사진 분석 저장 기능 제거됨 → symptom_photo 는 제외(과거 잔존 row
  //   대비, JS 필터라 legacy null kind = 논문 은 포함). 보관함 UI 와 동일 기준.
  const { data: savedAnalyses } = await supabase.from('saved_analyses').select('kind');
  const totalSavedAnalyses = (savedAnalyses || []).filter(
    (a: { kind: string | null }) => a.kind !== 'symptom_photo',
  ).length;

  // Build heavy users list (anyone with records >= 50, pets >= 5, or savedPapers >= 30)
  const allUserIds = new Set([...recordMap.keys(), ...petMap.keys(), ...savedMap.keys()]);
  for (const userId of allUserIds) {
    const rc = recordMap.get(userId) || 0;
    const pc = petMap.get(userId) || 0;
    const sc = savedMap.get(userId) || 0;
    if (rc >= 50 || pc >= 5 || sc >= 30) {
      const profile = profileMap.get(userId);
      if (profile) {
        heavyUsers.push({
          email: profile.email,
          nickname: profile.nickname,
          plan: profile.plan,
          records: rc,
          pets: pc,
          savedPapers: sc,
        });
      }
    }
  }
  heavyUsers.sort((a, b) => b.records - a.records);

  // 가입 경로(provider) 분포 — auth.users 는 public 스키마가 아니라 admin API 로 읽는다.
  //   app_metadata.provider: google | kakao | apple | email.
  const providerCounts: Record<string, number> = {};
  {
    const perPage = 1000;
    let page = 1;
    for (;;) {
      const { data: pageData, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage });
      if (listErr || !pageData?.users?.length) break;
      for (const u of pageData.users) {
        const prov = (u.app_metadata?.provider as string) || 'email';
        providerCounts[prov] = (providerCounts[prov] || 0) + 1;
      }
      if (pageData.users.length < perPage) break;
      page++;
    }
  }

  // 플랫폼 분포 — 유저별 "가장 최근 세션의 platform" 기준 distinct 카운트.
  //   active_sessions.platform 은 로그인 하트비트로 채워지므로, 배포 이후 재로그인한
  //   유저부터 집계됨(과거 무료 유저는 platform=null → untracked 로 분리 노출).
  const { data: platformSessions } = await supabase
    .from('active_sessions')
    .select('user_id, platform, last_active')
    .not('platform', 'is', null)
    .order('last_active', { ascending: false });
  const seenPlatformUser = new Set<string>();
  const platformCounts = { ios: 0, android: 0, web: 0 };
  for (const s of platformSessions || []) {
    if (seenPlatformUser.has(s.user_id)) continue; // 최신순 정렬 → 처음 본 게 최신 세션
    seenPlatformUser.add(s.user_id);
    const p = s.platform as 'ios' | 'android' | 'web';
    if (p === 'ios' || p === 'android' || p === 'web') {
      platformCounts[p]++;
    }
  }
  const platformTracked = seenPlatformUser.size;
  const platformUntracked = Math.max((totalUsers || 0) - platformTracked, 0);

  return NextResponse.json({
    providerCounts,
    platformCounts,
    platformTracked,
    platformUntracked,
    totalUsers: totalUsers || 0,
    todaySearches: todaySearches || 0,
    totalRevenue,
    plusUsers,
    autoRenewing,
    canceling,
    // 하위호환: 기존 activeSubscribers 소비처가 있으면 자동갱신 수로 매핑
    activeSubscribers: autoRenewing,
    todaySignups: todaySignups || 0,
    planDistribution: planDistribution || [],
    heavyUsers,
    usageSummary: {
      totalRecords: records?.length || 0,
      totalPets: pets?.length || 0,
      totalSavedPapers: saved?.length || 0,
      totalSavedAnalyses,
    },
  });
}
