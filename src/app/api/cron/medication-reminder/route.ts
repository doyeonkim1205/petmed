import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  // Find active medications that haven't ended
  const today = new Date().toISOString().split('T')[0];
  const { data: medications } = await supabase
    .from('medications')
    .select('user_id, name')
    .or(`end_date.is.null,end_date.gte.${today}`)
    .gte('start_date', '2000-01-01');

  if (!medications || medications.length === 0) {
    return NextResponse.json({ message: 'No reminders to send', sent: 0 });
  }

  // Group by user
  const userMeds: Record<string, string[]> = {};
  for (const med of medications) {
    if (!userMeds[med.user_id]) userMeds[med.user_id] = [];
    userMeds[med.user_id].push(med.name);
  }

  let sent = 0;
  for (const [userId, meds] of Object.entries(userMeds)) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (!subs || subs.length === 0) continue;

    const payload = JSON.stringify({
      title: '투약 알림',
      body: `${meds[0]}${meds.length > 1 ? ` 외 ${meds.length - 1}개` : ''} 투약 시간입니다.`,
      url: '/records',
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
          payload
        );
        sent++;
      } catch {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }

  return NextResponse.json({ message: 'Reminders sent', sent });
}
