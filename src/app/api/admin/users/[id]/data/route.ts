import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';
import { logActivityServer } from '@/lib/activityLogServer';

/**
 * 회원 데이터 열람 (읽기 전용) — 관리자가 특정 유저의 실제 데이터를 섹션별로 조회.
 *
 * ⚠️ 이 라우트는 절대 읽기 전용이다. 유저 콘텐츠를 바꾸는 mutation 을 여기 추가하지 말 것.
 *    (플랜/역할 변경·환불·삭제 등 운영 작업은 /api/admin/users/[id] 계열에서만.)
 * ⚠️ 의료·개인정보 열람이므로 매 조회를 admin.view_user_data 로 감사 로그에 남긴다.
 *
 * GET ?section=overview|pets|records&page=1
 */
const SECTIONS = ['overview', 'pets', 'records', 'meds', 'stats', 'preventive'] as const;
type Section = (typeof SECTIONS)[number];

const RECORDS_PAGE_SIZE = 50;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user: admin, error } = await verifyAdmin(request);
  if (error) return error;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') || 'overview') as Section;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));

  if (!SECTIONS.includes(section)) {
    return NextResponse.json({ error: '알 수 없는 섹션입니다.' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 대상 유저 존재 확인 (프로필 없으면 열람 자체가 무의미)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, nickname, avatar_url, plan, role, created_at')
    .eq('id', id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
  }

  // 감사 로그 — 누가·언제·누구를·어느 섹션 열람했는지. (개인정보처리방침 12조 근거)
  await logActivityServer(admin?.id ?? null, 'admin.view_user_data', {
    resourceType: 'user',
    resourceId: id,
    details: { section, ...(section === 'records' ? { page } : {}) },
  });

  if (section === 'overview') {
    const [
      { data: subscription },
      { count: searchCount },
      { data: payments },
      { count: recordCount },
      { count: petCount },
      { count: medCount },
      { count: preventiveCount },
      { count: labCount },
      { count: savedAnalysesCount },
    ] = await Promise.all([
      supabase.from('subscriptions').select('*').eq('user_id', id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('search_logs').select('*', { count: 'exact', head: true }).eq('user_id', id),
      supabase.from('payment_history').select('id, amount, status, created_at, store, environment').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
      supabase.from('health_records').select('*', { count: 'exact', head: true }).eq('user_id', id),
      supabase.from('pets').select('*', { count: 'exact', head: true }).eq('user_id', id),
      supabase.from('medications').select('*', { count: 'exact', head: true }).eq('user_id', id),
      supabase.from('preventive_cares').select('*', { count: 'exact', head: true }).eq('user_id', id),
      supabase.from('lab_tests').select('*', { count: 'exact', head: true }).eq('user_id', id),
      supabase.from('saved_analyses').select('*', { count: 'exact', head: true }).eq('user_id', id),
    ]);

    return NextResponse.json({
      profile,
      subscription,
      payments: payments || [],
      counts: {
        records: recordCount || 0,
        pets: petCount || 0,
        meds: medCount || 0,
        preventive: preventiveCount || 0,
        labs: labCount || 0,
        searches: searchCount || 0,
        savedAnalyses: savedAnalysesCount || 0,
      },
    });
  }

  if (section === 'pets') {
    const { data: pets } = await supabase
      .from('pets')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: true });
    return NextResponse.json({ pets: pets || [] });
  }

  if (section === 'meds') {
    const [{ data: meds }, { data: checks }] = await Promise.all([
      supabase
        .from('medications')
        .select('*, pets:pet_id (id, name, type)')
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
      // 복약 체크 완료 건수 집계용 (medication_id 별 checked=true 개수).
      supabase
        .from('medication_checks')
        .select('medication_id')
        .eq('user_id', id)
        .eq('checked', true),
    ]);
    const checkedCount: Record<string, number> = {};
    for (const c of checks || []) checkedCount[c.medication_id] = (checkedCount[c.medication_id] || 0) + 1;
    const withCounts = (meds || []).map((m) => ({ ...m, checkedCount: checkedCount[m.id] || 0 }));
    return NextResponse.json({ meds: withCounts });
  }

  if (section === 'preventive') {
    const { data: cares } = await supabase
      .from('preventive_cares')
      .select('*, pets:pet_id (id, name, type)')
      .eq('user_id', id)
      .order('next_due_date', { ascending: true });
    return NextResponse.json({ preventive: cares || [] });
  }

  if (section === 'stats') {
    // 건강통계 — 체중(weight_logs) + 지표(health_metrics). 최근순, 각 200건 상한.
    const [{ data: weights }, { data: metrics }] = await Promise.all([
      supabase
        .from('weight_logs')
        .select('id, pet_id, weight, measured_at')
        .eq('user_id', id)
        .order('measured_at', { ascending: false })
        .limit(200),
      supabase
        .from('health_metrics')
        .select('id, pet_id, metric_type, value, unit, input_pct, measured_at')
        .eq('user_id', id)
        .order('measured_at', { ascending: false })
        .limit(200),
    ]);
    return NextResponse.json({ weights: weights || [], metrics: metrics || [] });
  }

  // section === 'records'
  const from = (page - 1) * RECORDS_PAGE_SIZE;
  const to = from + RECORDS_PAGE_SIZE - 1;
  const { data: records, count } = await supabase
    .from('health_records')
    .select('*, pets:pet_id (id, name, type), medications (id, name, dosage, frequency), record_files (id)', { count: 'exact' })
    .eq('user_id', id)
    .order('visit_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  return NextResponse.json({
    records: records || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / RECORDS_PAGE_SIZE),
  });
}
