import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Unlink from OAuth provider so consent screen reappears on next login
async function unlinkProvider(provider: string | undefined, providerToken: string | undefined) {
  if (!providerToken || !provider) return;

  try {
    if (provider === 'kakao') {
      await fetch('https://kapi.kakao.com/v1/user/unlink', {
        method: 'POST',
        headers: { Authorization: `Bearer ${providerToken}` },
      });
    } else if (provider === 'google') {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${providerToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    }
  } catch {
    // Best-effort: don't block deletion if unlink fails
  }
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

    // Parse provider info from request body
    let providerToken: string | undefined;
    let provider: string | undefined;
    try {
      const body = await request.json();
      providerToken = body.providerToken;
      provider = body.provider;
    } catch {
      // Body may be empty for email/password users
    }

    // Verify the caller's session
    const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: '유효하지 않은 세션입니다.' }, { status: 401 });
    }

    // Unlink from OAuth provider first (while token is still valid)
    await unlinkProvider(provider, providerToken);

    // Create admin client
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Delete user data in order (foreign key safe)
    const userId = user.id;
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
