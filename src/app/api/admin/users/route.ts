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
    query = query.or(`email.ilike.%${search}%,nickname.ilike.%${search}%`);
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
