import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';
import webpush from 'web-push';

export async function POST(request: Request) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const { title, body, url, userId } = await request.json();
  if (!title || !body) {
    return NextResponse.json({ error: '제목과 내용이 필요합니다.' }, { status: 400 });
  }

  webpush.setVapidDetails(
    'mailto:admin@pawdex.store',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let query = supabase.from('push_subscriptions').select('*');
  if (userId) query = query.eq('user_id', userId);
  const { data: subs } = await query;

  const payload = JSON.stringify({ title, body, url: url || '/' });
  let sent = 0;
  let failed = 0;

  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        payload
      );
      sent++;
    } catch {
      failed++;
      // Remove invalid subscriptions (410 Gone)
      await supabase.from('push_subscriptions').delete().eq('id', sub.id);
    }
  }

  return NextResponse.json({ sent, failed });
}
