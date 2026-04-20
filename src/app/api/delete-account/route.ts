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
  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `token=${providerToken}`,
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

    // Log account deletion before deleting data
    await adminClient.from('activity_logs').insert({
      user_id: userId,
      action: 'auth.delete_account',
      details: { provider },
    }).then(() => {});

    // Cancel active subscriptions before deleting
    await adminClient.from('subscriptions')
      .update({ status: 'canceled', canceled_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'active');

    // Delete user data in FK-safe order (children before parents)
    // -- subscription / payment related
    await adminClient.from('subscription_events').delete().eq('user_id', userId);
    await adminClient.from('payment_history').delete().eq('user_id', userId);
    await adminClient.from('subscriptions').delete().eq('user_id', userId);

    // -- health records related
    await adminClient.from('medication_checks').delete().eq('user_id', userId);
    await adminClient.from('medications').delete().eq('user_id', userId);
    await adminClient.from('record_files').delete().eq('user_id', userId);
    await adminClient.from('health_records').delete().eq('user_id', userId);
    await adminClient.from('pets').delete().eq('user_id', userId);

    // -- search / analysis related
    await adminClient.from('saved_analyses').delete().eq('user_id', userId);
    await adminClient.from('saved_papers').delete().eq('user_id', userId);
    await adminClient.from('search_logs').delete().eq('user_id', userId);

    // -- session / notification related
    await adminClient.from('active_sessions').delete().eq('user_id', userId);
    await adminClient.from('push_subscriptions').delete().eq('user_id', userId);

    // -- profile 만 삭제 (last, as other tables may FK to these)
    //    activity_logs 는 감사 / 서비스 통계용으로 보존. 프로필이 삭제되면
    //    user_id (UUID) 는 유사-가명 상태가 되고, 관리자 UI 에서는
    //    "탈퇴 유저 (uuid8)" 로만 표시됨 (식별 불가).
    //    개인정보 처리방침에 이 비식별 보관 규정 명시 필요.
    await adminClient.from('profiles').delete().eq('id', userId);

    // Delete uploaded files from storage (best-effort)
    try {
      const { data: files } = await adminClient.storage
        .from('medical-files')
        .list(userId);
      if (files && files.length > 0) {
        const paths = files.map((f) => `${userId}/${f.name}`);
        await adminClient.storage.from('medical-files').remove(paths);
      }
    } catch {
      // Storage deletion is best-effort; don't block account deletion
    }

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
