import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const userId = searchParams.get('userId') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 30;
  const offset = (page - 1) * limit;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let query = supabase
    .from('activity_logs')
    .select('*, profiles!inner(email, nickname)', { count: 'exact' });

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', `${to}T23:59:59`);
  if (userId) query = query.eq('user_id', userId);

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return NextResponse.json({
    logs: data || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
