import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const plan = searchParams.get('plan') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let query = supabase
    .from('profiles')
    .select('id, email, nickname, plan, role, created_at', { count: 'exact' });

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

  return NextResponse.json({
    users: data || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
