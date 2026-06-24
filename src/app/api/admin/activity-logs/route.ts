import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';
import { kstDateToUtcRange } from '@/lib/dailyBoundary';

export async function GET(request: Request) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const userSearch = searchParams.get('userId') || '';
  const action = searchParams.get('action') || '';   // 단일 action (정확 매칭)
  const category = searchParams.get('category') || ''; // 카테고리 (prefix 매칭), 예: 'auth', 'cron', 'admin'
  const excludeCron = searchParams.get('excludeCron') === '1';  // cron.* 제외
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
        .ilike('email', `%${userSearch.replace(/[%,()\\*"]/g, '')}%`)
        .limit(1)
        .maybeSingle();
      if (profile) resolvedUserId = profile.id;
      else return NextResponse.json({ logs: [], total: 0, page, totalPages: 0 });
    } else {
      resolvedUserId = userSearch;
    }
  }

  let query = supabase
    .from('activity_logs')
    .select('*', { count: 'exact' });

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
  if (action) query = query.eq('action', action);
  else if (category === 'deleted_user') {
    // 탈퇴 유저 필터: profiles 에 없는 user_id 만.
    //   기존엔 살아있는 profile id 전부를 IN 절 inline → 유저 수백+ 시 URL 길이 초과로 깨짐.
    //   대신 "고아(탈퇴) user_id" 만 RPC 로 받아 in() — 탈퇴 유저는 소수라 항상 작은 목록.
    const { data: orphans } = await supabase.rpc('get_orphan_activity_user_ids');
    const orphanIds = (orphans ?? []).map((o: { user_id: string }) => o.user_id);
    if (orphanIds.length === 0) {
      return NextResponse.json({ logs: [], total: 0, page, totalPages: 0 });
    }
    query = query.in('user_id', orphanIds);
  } else if (category) query = query.like('action', `${category}.%`);

  // cron 제외 플래그 — action / category 필터와 동시 사용 가능. cron 카테고리
  // 자체를 보고 있을 땐 자가모순이라 무시.
  if (excludeCron && category !== 'cron' && !action.startsWith('cron.')) {
    query = query.not('action', 'like', 'cron.%');
  }

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
