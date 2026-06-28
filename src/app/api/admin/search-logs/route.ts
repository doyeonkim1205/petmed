import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';
import { kstDateToUtcRange } from '@/lib/dailyBoundary';

type LogKind = 'disease' | 'symptom' | 'symptom_refine' | 'symptom_photo';
type SearchType = 'all' | 'disease' | 'symptom' | 'symptom_photo';

/**
 * 관리자 검색 로그 조회 API.
 *
 * 질병 검색과 증상 분석을 모두 search_logs 한 테이블에 저장.
 * kind 컬럼으로 구분:
 *   - 'disease':         PubMed 논문 검색 (질병명)
 *   - 'symptom':         증상 분석 (초회)
 *   - 'symptom_refine':  증상 분석 (재분석)
 *
 * 쿼리 파라미터:
 *   - type: 'all' | 'disease' | 'symptom' (기본 'all')
 *       'symptom' 은 symptom + symptom_refine 모두 포함
 *   - from: YYYY-MM-DD (이상)
 *   - to:   YYYY-MM-DD (이하, 23:59:59 까지)
 *   - userId: 이메일 (부분 일치) 또는 UUID
 *   - page: 1-based (기본 1)
 */
const PAGE_SIZE = 30;

export async function GET(request: Request) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const type = (searchParams.get('type') || 'all') as SearchType;
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const userSearch = searchParams.get('userId') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 이메일 검색 → user_id 로 해석
  let resolvedUserId = '';
  if (userSearch) {
    if (userSearch.includes('@')) {
      // PostgREST 필터에서 의미를 갖는 문자 제거 (활동로그와 동일 정책).
      //   %/_ 와일드카드·or() 구분자가 검색을 깨거나 의도 밖 매칭하는 것 방지.
      const safe = userSearch.replace(/[%,()\\*"]/g, '').trim();
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', `%${safe}%`)
        .limit(1)
        .maybeSingle();
      if (profile) resolvedUserId = profile.id;
      else return NextResponse.json({ logs: [], total: 0, page, totalPages: 0 });
    } else {
      resolvedUserId = userSearch;
    }
  }

  let query = supabase
    .from('search_logs')
    .select('id, user_id, query, pet_type, kind, created_at, result_summary', { count: 'exact' });

  // 날짜 필터는 KST 달력 날짜 → UTC 경계로 변환 (안 하면 9시간 어긋남).
  if (from) {
    const r = kstDateToUtcRange(from);
    if (r) query = query.gte('created_at', r.startIso);
  }
  if (to) {
    const r = kstDateToUtcRange(to);
    if (r) query = query.lte('created_at', r.endIso);
  }
  if (resolvedUserId) query = query.eq('user_id', resolvedUserId);
  if (type === 'disease') query = query.eq('kind', 'disease');
  else if (type === 'symptom') query = query.in('kind', ['symptom', 'symptom_refine']);
  else if (type === 'symptom_photo') query = query.eq('kind', 'symptom_photo');

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const rows = data ?? [];

  // 프로필 조인
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v)));
  const profileMap = new Map<string, { email: string; nickname: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, nickname')
      .in('id', userIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { email: p.email, nickname: p.nickname });
    }
  }

  const logs = rows.map((r) => {
    const petType = r.pet_type?.toLowerCase?.().trim?.();
    // 관찰 모드 필드(result_summary jsonb) — 없으면 null. 사진분석은 input_type 등도 같이 들어있음.
    const rs = (r.result_summary && typeof r.result_summary === 'object' ? r.result_summary : {}) as Record<string, unknown>;
    return {
      id: r.id,
      user_id: r.user_id,
      query: typeof r.query === 'string' ? r.query : '',
      pet_type: (petType === 'dog' || petType === 'cat') ? petType : null,
      kind: r.kind as LogKind,
      created_at: r.created_at,
      profile: r.user_id ? profileMap.get(r.user_id) ?? null : null,
      device_id: typeof rs.device_id === 'string' ? rs.device_id : null,
      platform: typeof rs.platform === 'string' ? rs.platform : null,
      has_pet: typeof rs.has_pet === 'boolean' ? rs.has_pet : null,
      text_length: typeof rs.text_length === 'number' ? rs.text_length : null,
    };
  });

  return NextResponse.json({
    logs,
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
  });
}
