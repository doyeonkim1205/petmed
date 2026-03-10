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

  // Current time in KST (UTC+9)
  const now = new Date();
  const kstHour = (now.getUTCHours() + 9) % 24;
  const kstMinute = now.getUTCMinutes();
  const currentTime = `${String(kstHour).padStart(2, '0')}:${String(kstMinute).padStart(2, '0')}`;
  // Match within the same hour (e.g., cron runs at 09:00 UTC -> 18:00 KST, matches "18:00", "18:30" etc.)
  const currentHourPrefix = `${String(kstHour).padStart(2, '0')}:`;

  const today = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Find active medications with alarm enabled
  const { data: medications } = await supabase
    .from('medications')
    .select('user_id, name, alarm_times')
    .eq('alarm_enabled', true)
    .lte('start_date', today)
    .or(`end_date.is.null,end_date.gte.${today}`);

  if (!medications || medications.length === 0) {
    return NextResponse.json({ message: 'No reminders to send', sent: 0, time: currentTime });
  }

  // Filter medications that match the current hour
  const matchingMeds: Record<string, string[]> = {};
  for (const med of medications) {
    const times: string[] = med.alarm_times || [];
    const hasMatch = times.some((t: string) => t.startsWith(currentHourPrefix));
    if (hasMatch) {
      if (!matchingMeds[med.user_id]) matchingMeds[med.user_id] = [];
      matchingMeds[med.user_id].push(med.name);
    }
  }

  let sent = 0;
  for (const [userId, meds] of Object.entries(matchingMeds)) {
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

  return NextResponse.json({ message: 'Reminders sent', sent, time: currentTime, matched: Object.keys(matchingMeds).length });
}
