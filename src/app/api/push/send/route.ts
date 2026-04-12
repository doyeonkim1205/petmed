import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';
import webpush from 'web-push';

export async function POST(request: Request) {
  const { error } = await verifyAdmin(request);
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

  const payload = JSON.stringify({ title, body, url: url || '/' });
  let sent = 0;
  let failed = 0;

  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
        payload,
      );
      sent++;
    } catch {
      failed++;
      await supabase.from('push_subscriptions').delete().eq('id', sub.id);
    }
  }

  return NextResponse.json({ sent, failed });
}
