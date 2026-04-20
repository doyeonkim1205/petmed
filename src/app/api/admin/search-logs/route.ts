import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';

type LogKind = 'disease' | 'symptom' | 'symptom_refine';
type SearchType = 'all' | 'disease' | 'symptom';

interface MergedLog {
  id: string;
  user_id: string | null;
  query: string;
  pet_type: 'dog' | 'cat' | null;
  kind: LogKind;
  created_at: string;
}

/**
 * 관리자 검색 로그 통합 API.
 *
 * 두 테이블을 병합해서 반환:
 *   - search_logs:         질병명 검색 (PubMed 논문 검색) — kind='disease'
 *   - activity_logs.symptom.search / symptom.refine: 증상 분석 — kind='symptom' / 'symptom_refine'
 *
 * 쿼리 파라미터:
 *   - type: 'all' | 'disease' | 'symptom' (기본 'all')
 *   - from: YYYY-MM-DD (이상)
 *   - to:   YYYY-MM-DD (이하, 23:59:59 까지)
 *   - userId: 이메일 (부분 일치) 또는 UUID
 *   - page: 1-based (기본 1)
 *
 * 페이징 전략 — 메모리 병합:
 *   두 테이블에서 필터 적용 후 각각 최대 PAGE_POOL_MAX 건씩 가져와서
 *   서버에서 병합 + 정렬 + 슬라이스. 현재 데이터 규모 (~150 건) 에는
 *   충분히 안전하며, VIEW / UNION 보다 스키마 변경에 유연.
 */
const PAGE_SIZE = 30;
const PAGE_POOL_MAX = 1000; // 각 테이블에서 최대 조회 건수

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
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', `%${userSearch}%`)
        .limit(1)
        .maybeSingle();
      if (profile) resolvedUserId = profile.id;
      else return NextResponse.json({ logs: [], total: 0, page, totalPages: 0 });
    } else {
      resolvedUserId = userSearch;
    }
  }

  const merged: MergedLog[] = [];

  // 1. search_logs 조회 (type === 'all' || 'disease')
  if (type === 'all' || type === 'disease') {
    let q = supabase
      .from('search_logs')
      .select('id, user_id, query, pet_type, created_at');
    if (from) q = q.gte('created_at', from);
    if (to) q = q.lte('created_at', `${to}T23:59:59`);
    if (resolvedUserId) q = q.eq('user_id', resolvedUserId);

    const { data } = await q
      .order('created_at', { ascending: false })
      .range(0, PAGE_POOL_MAX - 1);

    for (const row of data || []) {
      merged.push({
        id: row.id,
        user_id: row.user_id,
        query: row.query ?? '',
        pet_type: (row.pet_type === 'dog' || row.pet_type === 'cat') ? row.pet_type : null,
        kind: 'disease',
        created_at: row.created_at,
      });
    }
  }

  // 2. activity_logs 조회 (type === 'all' || 'symptom') — symptom.search / symptom.refine
  if (type === 'all' || type === 'symptom') {
    let q = supabase
      .from('activity_logs')
      .select('id, user_id, action, details, created_at')
      .in('action', ['symptom.search', 'symptom.refine']);
    if (from) q = q.gte('created_at', from);
    if (to) q = q.lte('created_at', `${to}T23:59:59`);
    if (resolvedUserId) q = q.eq('user_id', resolvedUserId);

    const { data } = await q
      .order('created_at', { ascending: false })
      .range(0, PAGE_POOL_MAX - 1);

    for (const row of data || []) {
      const details = (row.details ?? {}) as { symptoms?: string; petType?: string };
      const petTypeRaw = details.petType;
      merged.push({
        id: row.id,
        user_id: row.user_id,
        query: details.symptoms ?? '',
        pet_type: (petTypeRaw === 'dog' || petTypeRaw === 'cat') ? petTypeRaw : null,
        kind: row.action === 'symptom.refine' ? 'symptom_refine' : 'symptom',
        created_at: row.created_at,
      });
    }
  }

  // 3. 정렬 (created_at DESC, id 보조)
  merged.sort((a, b) => {
    if (a.created_at !== b.created_at) {
      return a.created_at < b.created_at ? 1 : -1;
    }
    return a.id < b.id ? 1 : -1;
  });

  const total = merged.length;
  const slice = merged.slice(offset, offset + PAGE_SIZE);

  // 4. 프로필 조인
  const userIds = Array.from(
    new Set(slice.map((l) => l.user_id).filter((v): v is string => !!v)),
  );
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

  const logs = slice.map((l) => ({
    ...l,
    profile: l.user_id ? profileMap.get(l.user_id) ?? null : null,
  }));

  return NextResponse.json({
    logs,
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
}
