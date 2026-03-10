import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const userSearch = searchParams.get('userId') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 30;
  const offset = (page - 1) * limit;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // If user search looks like email, find the user_id first
  let resolvedUserId = '';
  if (userSearch) {
    if (userSearch.includes('@')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', `%${userSearch}%`)
        .limit(1)
        .single();
      if (profile) resolvedUserId = profile.id;
      else return NextResponse.json({ logs: [], total: 0, page, totalPages: 0 });
    } else {
      resolvedUserId = userSearch;
    }
  }

  let query = supabase
    .from('activity_logs')
    .select('*', { count: 'exact' });

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', `${to}T23:59:59`);
  if (resolvedUserId) query = query.eq('user_id', resolvedUserId);

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Attach profile info (FK points to auth.users, not profiles)
  const logs = data || [];
  if (logs.length > 0) {
    const userIds = [...new Set(logs.map((l: any) => l.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, nickname')
      .in('id', userIds);
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    for (const log of logs) {
      (log as any).profiles = profileMap.get(log.user_id) || null;
    }
  }

  return NextResponse.json({
    logs,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
