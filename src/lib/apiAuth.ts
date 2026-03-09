import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Verify Supabase access token from Authorization header.
 * Optionally checks device session validity via X-Device-Id header.
 */
export async function verifyAuth(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }) };
  }

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, error: NextResponse.json({ error: '유효하지 않은 세션입니다.' }, { status: 401 }) };
  }

  // Check device session if X-Device-Id header is present
  const deviceId = request.headers.get('x-device-id');
  if (deviceId) {
    const { data: session } = await supabaseAdmin
      .from('active_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
      .single();

    if (!session) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'session_evicted', message: '다른 기기에서 로그인하여 현재 세션이 종료되었습니다.' },
          { status: 403 },
        ),
      };
    }

    // Piggyback heartbeat: update last_active
    await supabaseAdmin
      .from('active_sessions')
      .update({ last_active: new Date().toISOString() })
      .eq('id', session.id);
  }

  return { user, error: null };
}
