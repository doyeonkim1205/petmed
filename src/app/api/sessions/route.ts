import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST: Register or heartbeat a device session
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request, { skipDeviceCheck: true });
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  const { device_id, platform } = await request.json();
  if (!device_id) {
    return NextResponse.json({ error: 'device_id is required' }, { status: 400 });
  }
  // 어드민 유입 분석용 플랫폼 라벨. 신뢰 가능한 값만 통과(클라가 보낸 임의 문자열 차단).
  const platformLabel = ['ios', 'android', 'web'].includes(platform) ? platform : null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();

  const plan = getEffectivePlan(profile?.plan);
  const maxDevices = getPlanConfig(plan).maxDevices;

  // Upsert this device session
  await supabaseAdmin
    .from('active_sessions')
    .upsert(
      {
        user_id: userId,
        device_id,
        last_active: new Date().toISOString(),
        // platform 은 알 때만 갱신 — null 로 덮어 기존 라벨을 지우지 않는다.
        ...(platformLabel ? { platform: platformLabel } : {}),
      },
      { onConflict: 'user_id,device_id' },
    );

  // Clean stale sessions (7 days inactive)
  await supabaseAdmin
    .from('active_sessions')
    .delete()
    .eq('user_id', userId)
    .lt('last_active', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  // Get all active sessions ordered by last_active
  const { data: sessions } = await supabaseAdmin
    .from('active_sessions')
    .select('id, device_id, last_active')
    .eq('user_id', userId)
    .order('last_active', { ascending: false });

  const allSessions = sessions || [];
  const evictedIds: string[] = [];

  // Evict oldest sessions if over limit
  if (allSessions.length > maxDevices) {
    const toEvict = allSessions.slice(maxDevices);
    for (const s of toEvict) {
      evictedIds.push(s.device_id);
      await supabaseAdmin.from('active_sessions').delete().eq('id', s.id);
    }
  }

  return NextResponse.json({
    valid: true,
    activeSessions: Math.min(allSessions.length, maxDevices),
    maxDevices,
    evicted: evictedIds.length > 0 ? evictedIds : undefined,
  });
}

/**
 * DELETE: Remove a session on logout
 */
export async function DELETE(request: NextRequest) {
  const auth = await verifyAuth(request, { skipDeviceCheck: true });
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  const { device_id } = await request.json();
  if (!device_id) {
    return NextResponse.json({ error: 'device_id is required' }, { status: 400 });
  }

  await supabaseAdmin
    .from('active_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('device_id', device_id);

  return NextResponse.json({ ok: true });
}
