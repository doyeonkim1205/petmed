/**
 * 푸시 알림 cron — pg_cron(매분) → pg_net HTTP → 이 엔드포인트.
 *
 * ⚠️ 수정 시 체크리스트 (회귀 방어):
 *   1. paidSet 계산이 isTrialActive() 분기 거치는가?
 *      → free 유저도 트라이얼 중엔 plus 취급해서 받아야 함.
 *   2. 매칭 로직이 1분 단위 cron 가정에 맞는가? (m === currentMinute)
 *      → 15분 윈도우 매칭 쓰면 1분 cron 이 15번 중복 발송.
 *   3. 시간 분기 (예: 07:00 발송) 가 currentMinute === 0 으로 정확히
 *      한 번만 트리거되는가? (1분 cron 에서 60번 중복 방지)
 *   4. 새 알림 종류 추가 시:
 *      - allTargetUserIds 에 user_id 포함시키기
 *      - tasks 배열에 push (paidSet 필터 후)
 *      - 메시지에 emoji + 명확한 본문
 *   5. webpush 호출 후 410/404 받으면 push_subscriptions row 삭제됨.
 *      브라우저는 여전히 구독 상태라 믿는 "유령 상태" 발생 →
 *      AuthContext auto-resub 가 다음 앱 로드 시 upsert 로 복구함.
 *   6. Sentry warning 임계값 (실패율 > 50%) — 회귀 시 알림.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import * as Sentry from '@sentry/nextjs';
import { logActivityServer } from '@/lib/activityLogServer';
import { isTrialActive } from '@/lib/plans';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// 동시 webpush 호출 제한 — 너무 많이 병렬 쏘면 FCM 이 429 로 응답.
// 10 이면 유저 1000명×2기기 = 2000콜이 ~200 청크로 나눠져 실행.
const PUSH_CONCURRENCY = 10;

/** 작업 배열을 동시성 limit 로 병렬 실행. p-limit 외부 의존성 없이 가벼운 구현. */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return results;
}

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
  const currentTime = `${currentHour}:${String(currentMinute).padStart(2, '0')}`;
  const todayKST = kstDate.toISOString().split('T')[0]; // YYYY-MM-DD

  // Idempotency 가드: pg_net 재시도 등으로 같은 분 cron 이 겹치면 이미 기록된
  // activity_logs 가 있는지 확인하고 early return. 정상 케이스에선 매 분 새로
  // 기록되므로 문제없음.
  const windowStart = new Date(now.getTime() - 45 * 1000).toISOString();
  const { data: recentRun } = await supabaseAdmin
    .from('activity_logs')
    .select('id')
    .eq('action', 'cron.push_notifications')
    .gte('created_at', windowStart)
    .filter('details->>time', 'eq', currentTime)
    .limit(1);
  if (recentRun && recentRun.length > 0) {
    return NextResponse.json({ skipped: 'duplicate-minute', time: currentTime });
  }

  let totalSent = 0;
  let totalFailed = 0;

  // 1. Medication alarms - check alarm_times for current minute (exact)
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
    const hasMatch = times.some((t: string) => {
      const [h, m] = t.split(':').map(Number);
      return String(h).padStart(2, '0') === currentHour && m === currentMinute;
    });
    if (hasMatch) {
      medUserIds.add(med.user_id);
      const msgs = medMessages.get(med.user_id) || [];
      msgs.push(med.name);
      medMessages.set(med.user_id, msgs);
    }
  }

  // 예약/퇴원/결제 대상 user_id 수집 (07:00 block 에서만 채움)
  const apptTomorrow: Array<{ user_id: string; title: string }> = [];
  const dischargeTomorrow: Array<{ user_id: string; title: string }> = [];
  const apptToday: Array<{ user_id: string; title: string }> = [];
  const dischargeToday: Array<{ user_id: string; title: string }> = [];
  let expiringSoon: Array<{
    id: string;
    user_id: string;
    plan: string;
    status: string;
    period_end: string;
    billing_type: string | null;
    product_id: string | null;
  }> = [];

  if (currentHour === '07' && currentMinute === 0) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKST = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

    const [apptsT, dischT, apptsToday2, dischToday2, expiring] = await Promise.all([
      supabaseAdmin
        .from('health_records')
        .select('user_id, title, next_appointment_date')
        .eq('next_appointment_date', tomorrowKST),
      supabaseAdmin
        .from('health_records')
        .select('user_id, title, discharge_date')
        .eq('discharge_date', tomorrowKST),
      supabaseAdmin
        .from('health_records')
        .select('user_id, title, next_appointment_date')
        .eq('next_appointment_date', todayKST),
      supabaseAdmin
        .from('health_records')
        .select('user_id, title, discharge_date')
        .eq('discharge_date', todayKST),
      supabaseAdmin
        .from('subscriptions')
        .select('id, user_id, plan, status, period_end, billing_type, product_id')
        .in('status', ['active', 'canceled'])
        .gte('period_end', new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString())
        .lt('period_end', new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString())
        .is('reminder_3day_sent_at', null),
    ]);

    for (const r of apptsT.data || []) apptTomorrow.push({ user_id: r.user_id, title: r.title });
    for (const r of dischT.data || []) dischargeTomorrow.push({ user_id: r.user_id, title: r.title });
    for (const r of apptsToday2.data || []) apptToday.push({ user_id: r.user_id, title: r.title });
    for (const r of dischToday2.data || []) dischargeToday.push({ user_id: r.user_id, title: r.title });
    expiringSoon = expiring.data || [];
  }

  // paid user 프리페치 — N+1 쿼리 제거.
  // 투약/예약/퇴원/결제 대상 user_id 를 전부 모아 profiles 한 번에 조회.
  const allTargetUserIds = new Set<string>([
    ...medUserIds,
    ...apptTomorrow.map((r) => r.user_id),
    ...dischargeTomorrow.map((r) => r.user_id),
    ...apptToday.map((r) => r.user_id),
    ...dischargeToday.map((r) => r.user_id),
    ...expiringSoon.map((r) => r.user_id),
  ]);

  // 트라이얼 중엔 전체 유저를 plus 로 취급 (getEffectivePlan 과 동일 규칙).
  // 트라이얼 종료 후엔 실제 plan 이 'plus' 인 유저만.
  const paidSet = new Set<string>();
  if (allTargetUserIds.size > 0) {
    if (isTrialActive()) {
      for (const uid of allTargetUserIds) paidSet.add(uid);
    } else {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, plan')
        .in('id', Array.from(allTargetUserIds));
      for (const p of profiles || []) {
        if (p.plan && p.plan !== 'free') paidSet.add(p.id);
      }
    }
  }

  // 발송 작업 큐 구성 — 전부 모아서 동시성 제한으로 한 번에 병렬 발송.
  type SendTask = {
    userId: string;
    notification: { title: string; body: string; url: string; category?: string };
    // 발송 성공/실패 무관하게 호출 (예: reminder_3day_sent_at 기록 — 스팸 방지 용도).
    afterSend?: () => Promise<void>;
  };
  const tasks: SendTask[] = [];

  // 1) 투약
  for (const userId of medUserIds) {
    if (!paidSet.has(userId)) continue;
    const names = medMessages.get(userId) || [];
    tasks.push({
      userId,
      notification: {
        title: '💊 투약 알림',
        body: `${names.join(', ')} 투약 시간입니다.`,
        url: '/records',
        category: 'medication',
      },
    });
  }

  // 2) 예약/퇴원 (07:00)
  for (const r of apptTomorrow) {
    if (!paidSet.has(r.user_id)) continue;
    tasks.push({
      userId: r.user_id,
      notification: {
        title: '📅 예약일 알림',
        body: `내일 "${r.title}" 예약이 있습니다.`,
        url: '/records',
        category: 'appointment',
      },
    });
  }
  for (const r of dischargeTomorrow) {
    if (!paidSet.has(r.user_id)) continue;
    tasks.push({
      userId: r.user_id,
      notification: {
        title: '🏥 퇴원일 알림',
        body: `내일 "${r.title}" 퇴원 예정입니다.`,
        url: '/records',
        category: 'hospitalization',
      },
    });
  }
  for (const r of apptToday) {
    if (!paidSet.has(r.user_id)) continue;
    tasks.push({
      userId: r.user_id,
      notification: {
        title: '📅 오늘 예약',
        body: `오늘 "${r.title}" 예약이 있습니다.`,
        url: '/records',
        category: 'appointment',
      },
    });
  }
  for (const r of dischargeToday) {
    if (!paidSet.has(r.user_id)) continue;
    tasks.push({
      userId: r.user_id,
      notification: {
        title: '🏥 오늘 퇴원',
        body: `오늘 "${r.title}" 퇴원 예정입니다.`,
        url: '/records',
        category: 'hospitalization',
      },
    });
  }

  // 3) 3일 전 결제/만료 안내 — product price 프리페치 후 메시지 분기
  if (expiringSoon.length > 0) {
    const productIds = Array.from(
      new Set(expiringSoon.map((s) => s.product_id).filter((id): id is string => !!id)),
    );
    const priceMap = new Map<string, number>();
    if (productIds.length > 0) {
      const { data: products } = await supabaseAdmin
        .from('payment_products')
        .select('id, price')
        .in('id', productIds);
      for (const p of products || []) {
        if (typeof p.price === 'number') priceMap.set(p.id, p.price);
      }
    }

    for (const sub of expiringSoon) {
      if (sub.plan === 'free') continue;
      if (!paidSet.has(sub.user_id)) continue;

      let notification: { title: string; body: string; url: string };
      if (sub.status === 'canceled') {
        notification = {
          title: '⏰ 구독 만료 안내',
          body: 'PawDex Plus 구독이 3일 후 무료 플랜으로 전환됩니다.',
          url: '/profile/subscription',
        };
      } else if (sub.billing_type === 'recurring') {
        const price = sub.product_id ? priceMap.get(sub.product_id) : null;
        const priceText = price ? ` (${price.toLocaleString()}원)` : '';
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

      tasks.push({
        userId: sub.user_id,
        notification,
        afterSend: async () => {
          await supabaseAdmin
            .from('subscriptions')
            .update({ reminder_3day_sent_at: new Date().toISOString() })
            .eq('id', sub.id);
        },
      });
    }
  }

  // 병렬 발송 (동시성 제한). 각 task 는 한 유저의 모든 기기에 발송.
  const results = await runWithConcurrency(tasks, PUSH_CONCURRENCY, async (task) => {
    const result = await sendPushToUser(task.userId, task.notification);
    if (task.afterSend) await task.afterSend();
    return result;
  });
  for (const r of results) {
    totalSent += r.sent;
    totalFailed += r.failed;
  }

  // Sentry 모니터링: 실패율 비정상적으로 높을 때만 warning.
  // - 5건 이상 시도(작은 수치 노이즈 무시) AND 실패가 성공보다 많을 때
  // - 410/404 (정상적인 dead sub 정리) 도 failed 로 카운트되므로 적당한 임계값
  const totalAttempts = totalSent + totalFailed;
  if (totalAttempts >= 5 && totalFailed > totalSent) {
    Sentry.captureMessage(
      `cron.push_notifications: high failure rate ${totalFailed}/${totalAttempts}`,
      {
        level: 'warning',
        tags: { feature: 'cron', action: 'push_send' },
        extra: {
          time: currentTime,
          date: todayKST,
          sent: totalSent,
          failed: totalFailed,
          taskCount: tasks.length,
        },
      },
    );
  }

  await logActivityServer(null, 'cron.push_notifications', {
    details: { time: currentTime, date: todayKST, sent: totalSent, failed: totalFailed },
  });

  return NextResponse.json({
    time: currentTime,
    date: todayKST,
    sent: totalSent,
    failed: totalFailed,
  });
}

async function sendPushToUser(
  userId: string,
  notification: { title: string; body: string; url: string; category?: string },
) {
  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  const payload = JSON.stringify(notification);
  let sent = 0;
  let failed = 0;

  // 한 유저의 여러 기기는 병렬로 발송 (보통 1-3개라 전부 Promise.all).
  const deliveries = await Promise.all(
    (subs || []).map(async (sub) => {
      try {
        // urgency 'high' + TTL 5분: FCM 에게 "즉시 전달, 5분 안에 전달 못 하면
        // 폐기" 힌트. Android 배터리 세이버 / Doze 모드 지연을 최소화.
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
          },
          payload,
          { urgency: 'high', TTL: 300 },
        );
        return { ok: true as const };
      } catch (err: any) {
        const statusCode = err?.statusCode;
        // 410 Gone / 404 Not Found 만 영구 삭제.
        // 429 rate limit / 5xx / 네트워크 오류는 일시적 실패로 유지 → 다음 cron 재시도.
        if (statusCode === 410 || statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        }
        return { ok: false as const };
      }
    }),
  );

  for (const d of deliveries) {
    if (d.ok) sent++;
    else failed++;
  }

  return { sent, failed };
}
