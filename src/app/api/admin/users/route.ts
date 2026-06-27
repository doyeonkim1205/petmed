import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const plan = searchParams.get('plan') || '';
  const platform = searchParams.get('platform') || ''; // ios | android | web
  const provider = searchParams.get('provider') || ''; // email | google | kakao | apple
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── 플랫폼/가입 필터 — profiles 에 없는 값(active_sessions/auth.users)이라, 먼저 해당
  //    user_id 집합을 구해 profiles 쿼리에 .in() 으로 교차. (현 규모용 — 유저 급증 시 비정규화 검토)
  let restrictIds: string[] | null = null;
  if (platform) {
    const { data: sess } = await supabase.from('active_sessions').select('user_id').eq('platform', platform);
    restrictIds = [...new Set((sess || []).map((s) => s.user_id))];
  }
  if (provider) {
    const provSet = new Set<string>();
    for (let p = 1; p <= 20; p++) {
      const { data: pageData } = await supabase.auth.admin.listUsers({ page: p, perPage: 1000 });
      const list = pageData?.users || [];
      for (const u of list) {
        if (((u.app_metadata?.provider as string) || 'email') === provider) provSet.add(u.id);
      }
      if (list.length < 1000) break;
    }
    restrictIds = restrictIds === null ? [...provSet] : restrictIds.filter((id) => provSet.has(id));
  }
  // 필터 결과가 빈 집합이면 즉시 빈 결과 (in([]) 대신 명시적 처리)
  if (restrictIds !== null && restrictIds.length === 0) {
    return NextResponse.json({ users: [], total: 0, page, totalPages: 0 });
  }

  let query = supabase
    .from('profiles')
    .select('id, email, nickname, plan, role, created_at', { count: 'exact' });

  if (restrictIds !== null) {
    query = query.in('id', restrictIds);
  }

  if (search) {
    // PostgREST or() 필터 구문에서 의미를 갖는 문자 제거 — `,` `(` `)` 는 조건 구분/그룹,
    //   `%` `*` 는 와일드카드, `\` `"` 는 이스케이프/인용. 안 막으면 검색이 깨지거나
    //   필터 인젝션 가능. 이메일/닉네임 검색엔 이 문자들이 사실상 안 쓰여 제거해도 무방.
    const safe = search.replace(/[%,()\\*"]/g, '').trim();
    if (safe) {
      query = query.or(`email.ilike.%${safe}%,nickname.ilike.%${safe}%`);
    }
  }
  if (plan) {
    query = query.eq('plan', plan);
  }

  const { data, count, error: dbError } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  const users = data || [];
  const ids = users.map((u) => u.id);

  // ── 플랫폼: 로그인 하트비트로 채워지는 active_sessions.platform 중 가장 최근 세션 기준 ──
  // (한 유저가 여러 기기여도 마지막 활동 기기의 플랫폼을 대표값으로.)
  const platformByUser: Record<string, string> = {};
  if (ids.length) {
    const { data: sessions } = await supabase
      .from('active_sessions')
      .select('user_id, platform, last_active')
      .in('user_id', ids)
      .order('last_active', { ascending: false });
    for (const s of sessions || []) {
      if (s.platform && !platformByUser[s.user_id]) platformByUser[s.user_id] = s.platform;
    }
  }

  // ── 가입 경로(provider): auth.users 의 app_metadata.provider (email|google|kakao|apple) ──
  // auth 스키마는 admin API 로만 읽는다(stats 라우트와 동일 컨벤션). 페이지당 20건 병렬 조회.
  const providerByUser: Record<string, string> = {};
  await Promise.all(
    ids.map(async (id) => {
      try {
        const { data: au } = await supabase.auth.admin.getUserById(id);
        providerByUser[id] = (au?.user?.app_metadata?.provider as string) || 'email';
      } catch {
        /* 개별 실패는 무시 — provider 미상 처리 */
      }
    }),
  );

  const enriched = users.map((u) => ({
    ...u,
    platform: platformByUser[u.id] || null,
    provider: providerByUser[u.id] || 'email',
  }));

  return NextResponse.json({
    users: enriched,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
