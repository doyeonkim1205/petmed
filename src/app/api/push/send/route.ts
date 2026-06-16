import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';
import { sendFcmToUser } from '@/lib/fcmAdmin';
import webpush from 'web-push';

export async function POST(request: Request) {
  const { user, error } = await verifyAdmin(request);
  if (error) return error;

  const { title, body, url, userId, target, userEmail } = await request.json();
  if (!title || !body) {
    return NextResponse.json({ error: '제목과 내용이 필요합니다.' }, { status: 400 });
  }

  webpush.setVapidDetails(
    'mailto:admin@pawdex.store',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Resolve target user IDs
  let targetUserIds: string[] | null = null; // null = all

  if (userId) {
    targetUserIds = [userId];
  } else if (target === 'user' && userEmail) {
    const { data: profile } = await supabase.from('profiles').select('id').eq('email', userEmail).single();
    if (!profile) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    targetUserIds = [profile.id];
  } else if (target === 'plus') {
    const { data: profiles } = await supabase.from('profiles').select('id').eq('plan', 'plus');
    targetUserIds = (profiles || []).map((p) => p.id);
  } else if (target === 'free') {
    const { data: profiles } = await supabase.from('profiles').select('id').eq('plan', 'free');
    targetUserIds = (profiles || []).map((p) => p.id);
  }
  // target === 'all' → targetUserIds stays null → no filter

  let query = supabase.from('push_subscriptions').select('*');
  if (targetUserIds) query = query.in('user_id', targetUserIds);
  const { data: subs } = await query;

  // tag: 관리자 발송별 unique → 같은 사용자에 여러 번 보내도 서로 안 덮어씀.
  // user_id 까지 포함해 다른 사용자 알림과도 분리.
  const adminTag = `admin-${Date.now()}`;
  let sent = 0;
  let failed = 0;

  for (const sub of subs || []) {
    try {
      // sub.user_id 별로 tag 다르게 → 같은 발송이라도 사용자별 독립 알림.
      const payload = JSON.stringify({
        title,
        body,
        url: url || '/',
        tag: `${adminTag}-${sub.user_id}`,
      });
      // urgency high + TTL 5분 — 즉시 전달 힌트 (배터리 세이버/Doze 우회)
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
        payload,
        { urgency: 'high', TTL: 300 },
      );
      sent++;
    } catch (err: any) {
      failed++;
      // 410 / 404 만 영구 삭제 — 일시적 실패엔 유지
      const statusCode = err?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }

  // 네이티브(FCM) 발송 — web-push 와 동일 대상에게.
  let fcmUserIds: string[];
  if (targetUserIds) {
    fcmUserIds = targetUserIds;
  } else {
    const { data: allFcm } = await supabase.from('fcm_tokens').select('user_id');
    fcmUserIds = Array.from(new Set((allFcm || []).map((r) => r.user_id as string)));
  }
  for (const uid of fcmUserIds) {
    const fcm = await sendFcmToUser(supabase, uid, {
      title,
      body,
      url: url || '/',
      tag: `${adminTag}-${uid}`,
    });
    sent += fcm.sent;
    failed += fcm.failed;
  }

  // 관리자 발송 기록 — target='user' 일 땐 resolved 이메일도 기록 (감사 추적).
  // 관리자가 이메일 오타로 엉뚱한 사람한테 발송했는지 나중에 검증 가능.
  await supabase.from('activity_logs').insert({
    user_id: user!.id,
    action: 'admin.push_send',
    resource_type: 'push',
    details: {
      title,
      body,
      target: target || 'all',
      sent,
      failed,
      ...(target === 'user' && userEmail ? { targetEmail: userEmail } : {}),
    },
  });

  return NextResponse.json({ sent, failed });
}
