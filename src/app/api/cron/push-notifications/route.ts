import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  webpush.setVapidDetails(
    'mailto:dylabs.pawdex@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const now = new Date();
  const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const currentHour = String(kstDate.getUTCHours()).padStart(2, '0');
  const currentMinute = kstDate.getUTCMinutes();
  // Round to nearest 15-min window: 0-14 → "00", 15-29 → "15", 30-44 → "30", 45-59 → "45"
  const windowStart = Math.floor(currentMinute / 15) * 15;
  const windowEnd = windowStart + 14;
  const currentTime = `${currentHour}:${String(currentMinute).padStart(2, '0')}`;
  const todayKST = kstDate.toISOString().split('T')[0]; // YYYY-MM-DD

  let totalSent = 0;
  let totalFailed = 0;

  // Helper: check if user is on a paid plan
  const paidUserCache = new Map<string, boolean>();
  async function isPaidUser(userId: string): Promise<boolean> {
    if (paidUserCache.has(userId)) return paidUserCache.get(userId)!;
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single();
    const paid = !!data && data.plan !== 'free';
    paidUserCache.set(userId, paid);
    return paid;
  }

  // 1. Medication alarms - check alarm_times for current hour
  const { data: medications } = await supabaseAdmin
    .from('medications')
    .select('user_id, name, alarm_times, start_date, end_date')
    .eq('alarm_enabled', true)
    .lte('start_date', todayKST)
    .or(`end_date.gte.${todayKST},end_date.is.null`);

  const medUserIds = new Set<string>();
  const medMessages = new Map<string, string[]>();

  for (const med of medications || []) {
    const times = med.alarm_times as string[] | null;
    if (!times) continue;

    // Match within 15-min window (e.g., cron at 13:30 matches "13:30", "13:35", etc.)
    const hasMatch = times.some((t: string) => {
      const [h, m] = t.split(':').map(Number);
      return String(h).padStart(2, '0') === currentHour && m >= windowStart && m <= windowEnd;
    });

    if (hasMatch) {
      medUserIds.add(med.user_id);
      const msgs = medMessages.get(med.user_id) || [];
      msgs.push(med.name);
      medMessages.set(med.user_id, msgs);
    }
  }

  // Send medication notifications (paid users only)
  for (const userId of medUserIds) {
    if (!(await isPaidUser(userId))) continue;
    const names = medMessages.get(userId) || [];
    const result = await sendPushToUser(userId, {
      title: '💊 투약 알림',
      body: `${names.join(', ')} 투약 시간입니다.`,
      url: '/records',
    });
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  // 2. Appointment reminders - check for tomorrow's appointments
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKST = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

  // Only run appointment check at 9 AM KST
  if (currentHour === '09') {
    const { data: appointments } = await supabaseAdmin
      .from('health_records')
      .select('user_id, title, next_appointment_date')
      .eq('next_appointment_date', tomorrowKST);

    for (const appt of appointments || []) {
      if (!(await isPaidUser(appt.user_id))) continue;
      const result = await sendPushToUser(appt.user_id, {
        title: '📅 예약일 알림',
        body: `내일 "${appt.title}" 예약이 있습니다.`,
        url: '/records',
      });
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    // 3. Discharge date reminders - check for tomorrow's discharge
    const { data: discharges } = await supabaseAdmin
      .from('health_records')
      .select('user_id, title, discharge_date')
      .eq('discharge_date', tomorrowKST);

    for (const d of discharges || []) {
      if (!(await isPaidUser(d.user_id))) continue;
      const result = await sendPushToUser(d.user_id, {
        title: '🏥 퇴원일 알림',
        body: `내일 "${d.title}" 퇴원 예정입니다.`,
        url: '/records',
      });
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    // 4. Today's appointments
    const { data: todayAppts } = await supabaseAdmin
      .from('health_records')
      .select('user_id, title, next_appointment_date')
      .eq('next_appointment_date', todayKST);

    for (const appt of todayAppts || []) {
      if (!(await isPaidUser(appt.user_id))) continue;
      const result = await sendPushToUser(appt.user_id, {
        title: '📅 오늘 예약',
        body: `오늘 "${appt.title}" 예약이 있습니다.`,
        url: '/records',
      });
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    // 5. Today's discharges
    const { data: todayDischarges } = await supabaseAdmin
      .from('health_records')
      .select('user_id, title, discharge_date')
      .eq('discharge_date', todayKST);

    for (const d of todayDischarges || []) {
      if (!(await isPaidUser(d.user_id))) continue;
      const result = await sendPushToUser(d.user_id, {
        title: '🏥 오늘 퇴원',
        body: `오늘 "${d.title}" 퇴원 예정입니다.`,
        url: '/records',
      });
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    // 6. Subscription billing/expiration reminders (3 days before period_end)
    //    Runs once per day at 9 AM KST. Idempotent via reminder_3day_sent_at column.
    //    Message branches based on billing_type:
    //    - recurring active: "3일 후 자동 결제됩니다 (3,900원)"
    //    - one_time active: "3일 후 만료됩니다, 재결제 필요"
    //    - canceled: "3일 후 무료 플랜으로 전환됩니다"
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const fourDaysFromNow = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

    const { data: expiringSoon } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, plan, status, period_end, billing_type, product_id')
      .in('status', ['active', 'canceled'])
      .gte('period_end', threeDaysFromNow.toISOString())
      .lt('period_end', fourDaysFromNow.toISOString())
      .is('reminder_3day_sent_at', null);

    for (const sub of expiringSoon || []) {
      if (sub.plan === 'free') continue;

      // Look up product price for recurring billing notice
      let priceText = '';
      if (sub.billing_type === 'recurring' && sub.product_id) {
        const { data: product } = await supabaseAdmin
          .from('payment_products')
          .select('price')
          .eq('id', sub.product_id)
          .single();
        if (product?.price) priceText = ` (${product.price.toLocaleString()}원)`;
      }

      let notification: { title: string; body: string; url: string };
      if (sub.status === 'canceled') {
        notification = {
          title: '⏰ 구독 만료 안내',
          body: 'PawDex Plus 구독이 3일 후 무료 플랜으로 전환됩니다.',
          url: '/profile/subscription',
        };
      } else if (sub.billing_type === 'recurring') {
        notification = {
          title: '🔄 자동 결제 안내',
          body: `3일 후 PawDex Plus가 자동 결제됩니다${priceText}. 해지를 원하시면 요금제 페이지에서 자동 갱신을 끄세요.`,
          url: '/profile/subscription',
        };
      } else {
        notification = {
          title: '⏰ 구독 만료 안내',
          body: 'PawDex Plus가 3일 후 만료됩니다. 계속 이용하려면 재결제해주세요.',
          url: '/profile/subscription',
        };
      }

      const result = await sendPushToUser(sub.user_id, notification);
      totalSent += result.sent;
      totalFailed += result.failed;

      await supabaseAdmin
        .from('subscriptions')
        .update({ reminder_3day_sent_at: new Date().toISOString() })
        .eq('id', sub.id);
    }
  }

  return NextResponse.json({
    time: currentTime,
    date: todayKST,
    sent: totalSent,
    failed: totalFailed,
  });
}

async function sendPushToUser(
  userId: string,
  notification: { title: string; body: string; url: string },
) {
  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  const payload = JSON.stringify(notification);
  let sent = 0;
  let failed = 0;

  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        payload,
      );
      sent++;
    } catch {
      failed++;
      // Remove invalid subscription (410 Gone)
      await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
    }
  }

  return { sent, failed };
}
