import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Unlink from OAuth provider using server-side admin keys
async function unlinkKakao(kakaoUserId: string) {
  const adminKey = process.env.KAKAO_ADMIN_KEY;
  if (!adminKey || !kakaoUserId) return;

  await fetch('https://kapi.kakao.com/v1/user/unlink', {
    method: 'POST',
    headers: {
      Authorization: `KakaoAK ${adminKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `target_id_type=user_id&target_id=${kakaoUserId}`,
  });
}

async function revokeGoogle(providerToken: string | undefined) {
  if (!providerToken) return;
  await fetch(`https://oauth2.googleapis.com/revoke?token=${providerToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const accessToken = authHeader.slice(7);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 });
    }

    // Parse optional provider token (for Google revoke)
    let providerToken: string | undefined;
    try {
      const body = await request.json();
      providerToken = body.providerToken;
    } catch {
      // Body may be empty
    }

    // Verify the caller's session
    const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: '유효하지 않은 세션입니다.' }, { status: 401 });
    }

    // Unlink from OAuth provider (best-effort, don't block deletion)
    const provider = user.app_metadata?.provider;
    try {
      if (provider === 'kakao') {
        const kakaoId = user.user_metadata?.sub || user.user_metadata?.provider_id;
        await unlinkKakao(kakaoId);
      } else if (provider === 'google') {
        await revokeGoogle(providerToken);
      }
    } catch {
      // Continue with deletion even if unlink fails
    }

    // Create admin client
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Delete user data in order (foreign key safe)
    const userId = user.id;

    // Cancel active subscriptions before deleting
    await adminClient.from('subscriptions')
      .update({ status: 'canceled', canceled_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'active');

    await adminClient.from('payment_history').delete().eq('user_id', userId);
    await adminClient.from('subscriptions').delete().eq('user_id', userId);
    await adminClient.from('medication_checks').delete().eq('user_id', userId);
    await adminClient.from('medications').delete().eq('user_id', userId);
    await adminClient.from('record_files').delete().eq('user_id', userId);
    await adminClient.from('health_records').delete().eq('user_id', userId);
    await adminClient.from('pets').delete().eq('user_id', userId);
    await adminClient.from('profiles').delete().eq('id', userId);

    // Delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      return NextResponse.json({ error: '계정 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
