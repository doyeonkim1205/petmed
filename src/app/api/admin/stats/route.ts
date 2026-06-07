import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date().toISOString().split('T')[0];

  const [
    { count: totalUsers },
    { count: todaySearches },
    { data: revenue },
    { count: activeSubscribers },
    { count: todaySignups },
    { data: profiles },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('search_logs').select('*', { count: 'exact', head: true }).gte('created_at', today),
    supabase.from('payment_history').select('amount').eq('status', 'done'),
    supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', today),
    supabase.from('profiles').select('plan'),
  ]);

  const counts: Record<string, number> = {};
  (profiles || []).forEach((p: { plan: string }) => {
    counts[p.plan] = (counts[p.plan] || 0) + 1;
  });
  const planDistribution = Object.entries(counts).map(([plan, count]) => ({ plan, count }));

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

  // 보관함 — saved_analyses (부모): 논문분석 + 사진분석 세션.
  //   saved_papers 와 부모/자식 관계라 합산 금지. 별도 지표로 노출.
  //   특히 사진분석(symptom_photo)은 saved_papers row 를 안 만들어 기존 통계에서 누락됐었음.
  const { data: savedAnalyses } = await supabase.from('saved_analyses').select('kind');
  const totalSavedAnalyses = savedAnalyses?.length || 0;
  const totalPhotoAnalyses = (savedAnalyses || []).filter(
    (a: { kind: string }) => a.kind === 'symptom_photo',
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

  return NextResponse.json({
    totalUsers: totalUsers || 0,
    todaySearches: todaySearches || 0,
    totalRevenue,
    activeSubscribers: activeSubscribers || 0,
    todaySignups: todaySignups || 0,
    planDistribution: planDistribution || [],
    heavyUsers,
    usageSummary: {
      totalRecords: records?.length || 0,
      totalPets: pets?.length || 0,
      totalSavedPapers: saved?.length || 0,
      totalSavedAnalyses,
      totalPhotoAnalyses,
    },
  });
}
