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
  const action = searchParams.get('action') || '';   // 단일 action (정확 매칭)
  const category = searchParams.get('category') || ''; // 카테고리 (prefix 매칭), 예: 'auth', 'cron', 'admin'
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
  if (action) query = query.eq('action', action);
  else if (category) query = query.like('action', `${category}.%`);

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Attach profile info (FK points to auth.users, not profiles).
  // Cron/system logs have user_id=null; admin actions have targetUserId
  // in details. Fetch every id we encounter, then decorate.
  const logs = data || [];
  if (logs.length > 0) {
    const ids = new Set<string>();
    for (const log of logs) {
      if (log.user_id) ids.add(log.user_id);
      const targetId = (log.details as Record<string, unknown>)?.targetUserId;
      if (typeof targetId === 'string' && targetId) ids.add(targetId);
    }

    if (ids.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, nickname')
        .in('id', [...ids]);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      for (const log of logs) {
        const actor = log.user_id ? profileMap.get(log.user_id) ?? null : null;
        const targetIdRaw = (log.details as Record<string, unknown>)?.targetUserId;
        const targetId = typeof targetIdRaw === 'string' ? targetIdRaw : null;
        const target = targetId ? profileMap.get(targetId) ?? null : null;

        (log as { actor?: unknown }).actor = actor;
        (log as { target?: unknown }).target = target;
        (log as { profiles?: unknown }).profiles = actor; // backward compat
      }
    }
  }

  return NextResponse.json({
    logs,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
