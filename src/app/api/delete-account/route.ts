import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ES256 JWT 서명에 Node crypto 를 쓰므로 Node 런타임 고정 (Edge 금지).
export const runtime = 'nodejs';

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

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Apple "Sign in with Apple" client_secret JWT (ES256) 생성.
 * 필요한 env (Apple Developer 계정 발급): APPLE_TEAM_ID / APPLE_KEY_ID /
 * APPLE_CLIENT_ID(네이티브=번들ID 또는 Services ID) / APPLE_PRIVATE_KEY(.p8 내용).
 * 하나라도 없으면 null → 호출부에서 best-effort no-op.
 */
function buildAppleClientSecret(): string | null {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const clientId = process.env.APPLE_CLIENT_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!teamId || !keyId || !clientId || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const payload = base64url(
    JSON.stringify({
      iss: teamId,
      iat: now,
      exp: now + 300,
      aud: 'https://appleid.apple.com',
      sub: clientId,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signer = crypto.createSign('SHA256');
  signer.update(signingInput);
  // ES256 은 JOSE(r||s, p1363) 포맷 서명이 필요 — Node 기본 DER 이므로 명시.
  const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${base64url(signature)}`;
}

/**
 * Apple 토큰 revoke (5.1.1 대응). 탈퇴 직전 클라가 재인증으로 받은 일회성
 * authorizationCode 를 받아 ① refresh_token 교환 → ② revoke.
 * env 미설정/코드 없음/네트워크 실패 모두 best-effort no-op (탈퇴 흐름 차단 금지).
 */
async function revokeApple(authorizationCode: string | undefined) {
  if (!authorizationCode) return;
  const clientId = process.env.APPLE_CLIENT_ID;
  const clientSecret = buildAppleClientSecret();
  if (!clientId || !clientSecret) return;

  // 1) authorization_code → refresh_token
  const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: 'authorization_code',
    }).toString(),
  });
  if (!tokenRes.ok) return;
  const tokenJson = (await tokenRes.json().catch(() => null)) as { refresh_token?: string } | null;
  const refreshToken = tokenJson?.refresh_token;
  if (!refreshToken) return;

  // 2) refresh_token revoke → Apple 측 연결 해제
  await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token: refreshToken,
      token_type_hint: 'refresh_token',
    }).toString(),
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

    // Parse optional payload (provider token + 탈퇴 이유)
    let providerToken: string | undefined;
    let appleAuthCode: string | undefined;
    let reason: string | null = null;
    let reasonDetail: string | null = null;
    try {
      const body = await request.json();
      providerToken = body.providerToken;
      if (typeof body.appleAuthCode === 'string') appleAuthCode = body.appleAuthCode;
      if (typeof body.reason === 'string') reason = body.reason.slice(0, 50);
      if (typeof body.reasonDetail === 'string') reasonDetail = body.reasonDetail.slice(0, 200);
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
      } else if (provider === 'apple') {
        await revokeApple(appleAuthCode);
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

    // Log account deletion before deleting data.
    // details 에 탈퇴 이유 포함 (서비스 개선 용도, 비식별).
    await adminClient.from('activity_logs').insert({
      user_id: userId,
      action: 'auth.delete_account',
      details: { provider, reason, reasonDetail },
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
    await adminClient.from('weight_logs').delete().eq('user_id', userId);
    await adminClient.from('pets').delete().eq('user_id', userId);

    // -- search / analysis related
    await adminClient.from('saved_analyses').delete().eq('user_id', userId);
    await adminClient.from('saved_papers').delete().eq('user_id', userId);
    await adminClient.from('search_logs').delete().eq('user_id', userId);

    // -- session / notification related
    await adminClient.from('active_sessions').delete().eq('user_id', userId);
    await adminClient.from('push_subscriptions').delete().eq('user_id', userId);
    await adminClient.from('recent_hospitals').delete().eq('user_id', userId);

    // -- profile 만 삭제 (last, as other tables may FK to these)
    //    activity_logs 는 감사 / 서비스 통계용으로 보존. 프로필이 삭제되면
    //    user_id (UUID) 는 유사-가명 상태가 되고, 관리자 UI 에서는
    //    "탈퇴 유저 (uuid8)" 로만 표시됨 (식별 불가).
    //    개인정보 처리방침에 이 비식별 보관 규정 명시 필요.
    await adminClient.from('profiles').delete().eq('id', userId);

    // Delete uploaded files from storage (best-effort).
    //
    // 파일 경로 구조: {userId}/{recordId}/{fileName} (3 levels)
    // storage.list(userId) 는 한 레벨만 반환 (recordId 폴더들). 이걸 바로
    // remove 에 넣으면 폴더 경로라 실제 파일은 지워지지 않음. 실제 파일을
    // 지우려면 각 recordId 폴더 안까지 한 번 더 내려가야 함.
    try {
      const { data: recordFolders } = await adminClient.storage
        .from('medical-files')
        .list(userId);
      if (recordFolders && recordFolders.length > 0) {
        const allFilePaths: string[] = [];
        for (const folder of recordFolders) {
          const { data: files } = await adminClient.storage
            .from('medical-files')
            .list(`${userId}/${folder.name}`);
          if (files) {
            for (const file of files) {
              allFilePaths.push(`${userId}/${folder.name}/${file.name}`);
            }
          }
        }
        if (allFilePaths.length > 0) {
          await adminClient.storage.from('medical-files').remove(allFilePaths);
        }
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
