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
 *   7. activity_logs 기록은 sent>0 || failed>0 일 때만. 빈 분(noise)
 *      은 안 남김 → 하루 1440 → ~10 row 로 감소. cron 자체 실행 기록은
 *      pg_cron 의 cron.job_run_details 에 항상 남아 있음 (admin 진단
 *      카드의 cronHealth 가 이걸 사용).
 *
 * 통합 정책 (펫 단위):
 *   - 같은 (user_id, pet_id, currentTime) 조합 = 1알림.
 *   - 투약: 펫 단위 1알림. title "💊 [펫] 약 먹을 시간이에요" / body "A, B · 오후 12시 30분"
 *   - 예약·퇴원 (07:00): 펫별 events 합쳐서 통합 메시지
 *     · 같은 record 의 예약+퇴원 → "X 예약·퇴원이 있어요"
 *     · 다중 mix → "예약 1건, 퇴원 1건"
 *   - 1일전 알림 제거 (당일만). collision 방지 + UX 단순화.
 *   - 옛 SW (v17~v26) 은 tag 처리 못해도 알림 자체가 1개라 collision X.
 *
 * 미래 노트:
 *   - 트래픽 증가 시 같은 분 중복 호출 방지를 더 단단히 할 거면 Redis 락
 *     대신 pg_try_advisory_xact_lock(hashtext('cron-push-' || time)) 권장.
 *     Supabase 자체 기능이라 외부 인프라 불필요.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import * as Sentry from '@sentry/nextjs';
import { logActivityServer } from '@/lib/activityLogServer';
import { isTrialActive } from '@/lib/plans';
import { categoryLabelI18n } from '@/lib/preventiveCare';
import { sendFcmToUser } from '@/lib/fcmAdmin';
import type { PreventiveCategory } from '@/lib/supabase';
import { secureEqual } from '@/lib/secureCompare';

type Lang = 'ko' | 'en';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// 동시 webpush 호출 제한 — 너무 많이 병렬 쏘면 FCM 이 429 로 응답.
// 10 이면 유저 1000명×2기기 = 2000콜이 ~200 청크로 나눠져 실행.
const PUSH_CONCURRENCY = 10;

// 알림 메시지 글자수 제한 (한글 기준).
// title: 20자 이하 (이모지 포함) → 잠금화면 안 잘림
// body : 45자 이하 → 한 줄 내
// 펫 이름 12자. record title 25자 ellipsis 처리.
const PET_NAME_MAX = 12;
const RECORD_TITLE_MAX = 25;

/** 길이 초과 시 ellipsis. 빈 값은 fallback 으로 대체. */
function truncate(text: string | null | undefined, maxLen: number, fallback: string): string {
  const t = (text || '').trim();
  if (!t) return fallback;
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 1) + '…';
}

/**
 * 24h 시각을 한국어 자연 표현으로 변환.
 * - 정시 → "오전 9시" / "오후 1시" / "오후 12시"
 * - 분 있음 → "오전 9시 45분" / "오후 1시 30분"
 *
 * 유저 입력 UI (TimePicker) 가 오전/오후 + 12시간 형식이라 알림 표기도
 * 동일하게 맞춤. "09시" 같은 24h padded 형식은 인지 불일치 발생.
 *
 * 엣지 케이스:
 *   00:00 → "오전 12시" (자정)
 *   12:00 → "오후 12시" (정오)
 */
function formatKoreanTime(hour24: number, minute: number): string {
  const ampm = hour24 < 12 ? '오전' : '오후';
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return minute === 0 ? `${ampm} ${hour12}시` : `${ampm} ${hour12}시 ${minute}분`;
}

/** locale 별 시각 표기 — EN: "9 AM" / "12:30 PM". */
function formatTimeI18n(hour24: number, minute: number, locale: Lang): string {
  if (locale !== 'en') return formatKoreanTime(hour24, minute);
  const ampm = hour24 < 12 ? 'AM' : 'PM';
  let h = hour24 % 12;
  if (h === 0) h = 12;
  return minute === 0 ? `${h} ${ampm}` : `${h}:${String(minute).padStart(2, '0')} ${ampm}`;
}

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

/**
 * 펫별 예약·퇴원 이벤트로부터 통합 알림 메시지 빌드.
 * 같은 record 안에 예약+퇴원 둘 다 있으면 "예약·퇴원" 으로 묶음.
 * 카테고리 우선순위: 퇴원 포함 → hospitalization, 아니면 appointment.
 */
function buildScheduleMessage(
  petName: string,
  appts: Array<{ id: string; title: string }>,
  dischs: Array<{ id: string; title: string }>,
  locale: Lang,
): { title: string; body: string; category: 'appointment' | 'hospitalization' } {
  const apptCount = appts.length;
  const dischCount = dischs.length;
  const en = locale === 'en';
  const fb = en ? 'schedule' : '일정';

  // 같은 record 가 예약+퇴원 둘 다 가진 케이스 검출.
  const apptIds = new Set(appts.map((a) => a.id));
  const sameRecord = dischs.find((d) => apptIds.has(d.id));

  // Case 1: 같은 record 1건의 예약+퇴원 → 단일 통합 메시지
  if (apptCount === 1 && dischCount === 1 && sameRecord) {
    const t = truncate(sameRecord.title, RECORD_TITLE_MAX, fb);
    return {
      title: en ? `🏥 ${petName}'s schedule today` : `🏥 오늘 ${petName} 일정`,
      body: en ? `"${t}" has an appointment & discharge` : `"${t}" 예약·퇴원이 있어요`,
      category: 'hospitalization',
    };
  }

  // Case 2: 퇴원만
  if (apptCount === 0 && dischCount > 0) {
    if (dischCount === 1) {
      const t = truncate(dischs[0].title, RECORD_TITLE_MAX, fb);
      return {
        title: en ? `🏥 ${petName}'s discharge today` : `🏥 오늘 ${petName} 퇴원`,
        body: en ? `"${t}" is scheduled for discharge` : `"${t}" 퇴원 예정이에요`,
        category: 'hospitalization',
      };
    }
    return {
      title: en ? `🏥 ${petName}'s discharge today` : `🏥 오늘 ${petName} 퇴원`,
      body: en ? `${dischCount} discharges` : `퇴원 ${dischCount}건이 있어요`,
      category: 'hospitalization',
    };
  }

  // Case 3: 예약만
  if (dischCount === 0 && apptCount > 0) {
    if (apptCount === 1) {
      const t = truncate(appts[0].title, RECORD_TITLE_MAX, fb);
      return {
        title: en ? `📅 ${petName}'s appointment today` : `📅 오늘 ${petName} 예약`,
        body: en ? `"${t}" is scheduled` : `"${t}" 일정이 있어요`,
        category: 'appointment',
      };
    }
    if (apptCount === 2) {
      const a = truncate(appts[0].title, 12, fb);
      const b = truncate(appts[1].title, 12, fb);
      return {
        title: en ? `📅 ${petName}'s appointments today` : `📅 오늘 ${petName} 예약`,
        body: en ? `"${a}", "${b}" are scheduled` : `"${a}", "${b}" 일정이 있어요`,
        category: 'appointment',
      };
    }
    return {
      title: en ? `📅 ${petName}'s appointments today` : `📅 오늘 ${petName} 예약`,
      body: en ? `${apptCount} appointments` : `예약 ${apptCount}건이 있어요`,
      category: 'appointment',
    };
  }

  // Case 4: 예약+퇴원 mix
  return {
    title: en ? `🏥 ${petName}'s schedule today` : `🏥 오늘 ${petName} 일정`,
    body: en ? `${apptCount} appointment(s), ${dischCount} discharge(s)` : `예약 ${apptCount}건, 퇴원 ${dischCount}건 있어요`,
    category: 'hospitalization',
  };
}

/**
 * 펫별 예방(백신·심장사상충·구충 등) 통합 알림 메시지 빌드.
 * items: 오늘 발송 대상 예방들 (dday 0=당일, 3=3일 전).
 */
function buildPreventiveMessage(
  petName: string,
  items: Array<{ category: string; name: string | null; dday: number }>,
  locale: Lang,
): { title: string; body: string } {
  const en = locale === 'en';
  const fb = en ? 'schedule' : '일정';
  // 제품명이 카테고리명과 다르면 "카테고리(제품)" 로, 같으면 카테고리명만.
  const labelOf = (it: { category: string; name: string | null }) => {
    const catLabel = categoryLabelI18n(it.category as PreventiveCategory, locale);
    return it.name && it.name !== catLabel ? `${catLabel}(${it.name})` : catLabel;
  };
  if (items.length === 1) {
    const { dday } = items[0];
    const label = truncate(labelOf(items[0]), RECORD_TITLE_MAX, fb);
    if (dday === 0) {
      return {
        title: en ? `💉 ${petName}'s health schedule today` : `💉 ${petName} 오늘의 건강 일정`,
        body: en ? `Time for "${label}"` : `"${label}" 챙겨주세요`,
      };
    }
    return {
      title: en ? `💉 ${petName}'s health schedule in ${dday} days` : `💉 ${petName} 건강 일정 ${dday}일 전`,
      body: en ? `"${label}" is coming up` : `"${label}" 예정이에요`,
    };
  }
  const first = truncate(labelOf(items[0]), 12, fb);
  return {
    title: en ? `💉 ${petName} has schedules to handle` : `💉 ${petName} 챙길 일정이 있어요`,
    body: en ? `"${first}" and ${items.length - 1} more` : `${first} 외 ${items.length - 1}개 챙겨주세요`,
  };
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (!secureEqual(authHeader, `Bearer ${process.env.CRON_SECRET}`)) {
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

  // 1. Medication alarms — pet_id 직접 사용.
  // 복약 재구조화 후 medications.pet_id 가 곧바로 채워짐(진료기록 딸린 약은 백필,
  // 펫 단위 독립 약은 등록 시 직접). 과거엔 health_records!inner(pet_id) 로 조인했으나
  // 그러면 record_id NULL 인 독립 약(영양제 등)이 INNER JOIN 에서 빠져 알림이 누락됨.
  const { data: medications } = await supabaseAdmin
    .from('medications')
    .select('user_id, name, alarm_times, start_date, end_date, pet_id')
    .eq('alarm_enabled', true)
    .lte('start_date', todayKST)
    .or(`end_date.gte.${todayKST},end_date.is.null`);

  // medByUserPet: Map<userId, Map<petId, drugNames[]>>
  // 같은 유저의 같은 펫 같은 시각 약 = 1 알림.
  // 다른 펫의 같은 시각 약 = 알림 분리.
  const medByUserPet = new Map<string, Map<string, string[]>>();

  for (const med of medications || []) {
    const times = med.alarm_times as string[] | null;
    if (!times) continue;
    const hasMatch = times.some((t: string) => {
      const [h, m] = t.split(':').map(Number);
      return String(h).padStart(2, '0') === currentHour && m === currentMinute;
    });
    if (!hasMatch) continue;

    // pet_id 직접 사용 (독립 약 포함). 백필 누락 등으로 비어 있으면 안전하게 스킵.
    const petId = (med as unknown as { pet_id: string | null }).pet_id;
    if (!petId) continue;

    let petsMap = medByUserPet.get(med.user_id);
    if (!petsMap) {
      petsMap = new Map();
      medByUserPet.set(med.user_id, petsMap);
    }
    const drugs = petsMap.get(petId) || [];
    drugs.push(med.name);
    petsMap.set(petId, drugs);
  }

  // 예약/퇴원/결제 대상 수집 (07:00 에만). 1일전 알림은 제거 — 당일만.
  const apptToday: Array<{ id: string; user_id: string; pet_id: string; title: string }> = [];
  const dischargeToday: Array<{ id: string; user_id: string; pet_id: string; title: string }> = [];
  // 예방(백신·심장사상충·구충 등) — next_due_date 가 당일(D-0) 또는 3일 후(D-3) 인 항목.
  const preventiveDue: Array<{ user_id: string; pet_id: string; category: string; name: string; dday: number }> = [];
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
    const [apptsToday2, dischToday2, expiring] = await Promise.all([
      supabaseAdmin
        .from('health_records')
        .select('id, user_id, pet_id, title, next_appointment_date')
        .eq('next_appointment_date', todayKST),
      supabaseAdmin
        .from('health_records')
        .select('id, user_id, pet_id, title, discharge_date')
        .eq('discharge_date', todayKST),
      supabaseAdmin
        .from('subscriptions')
        .select('id, user_id, plan, status, period_end, billing_type, product_id')
        .in('status', ['active', 'canceled'])
        .gte('period_end', new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString())
        .lt('period_end', new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString())
        .is('reminder_3day_sent_at', null),
    ]);

    for (const r of apptsToday2.data || []) {
      apptToday.push({ id: r.id, user_id: r.user_id, pet_id: r.pet_id, title: r.title });
    }
    for (const r of dischToday2.data || []) {
      dischargeToday.push({ id: r.id, user_id: r.user_id, pet_id: r.pet_id, title: r.title });
    }
    expiringSoon = expiring.data || [];

    // 예방 알림 — D-0(당일) + D-3(3일 전) 두 시점에 발송. next_due_date 가 고정이라
    // 각 시점에 07:00 한 번씩만 매칭됨(별도 sent 플래그 불필요).
    const plus3 = new Date(kstDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: prevData } = await supabaseAdmin
      .from('preventive_cares')
      .select('user_id, pet_id, category, name, next_due_date')
      .eq('alarm_enabled', true)
      .in('next_due_date', [todayKST, plus3]);
    for (const r of prevData || []) {
      preventiveDue.push({
        user_id: r.user_id,
        pet_id: r.pet_id,
        category: r.category,
        name: r.name,
        dday: r.next_due_date === todayKST ? 0 : 3,
      });
    }
  }

  // 예약·퇴원 펫별 그룹화: Map<userId, Map<petId, {appts[], dischs[]}>>
  type ScheduleEvents = {
    appts: Array<{ id: string; title: string }>;
    dischs: Array<{ id: string; title: string }>;
  };
  const scheduleByUserPet = new Map<string, Map<string, ScheduleEvents>>();

  const ensurePetEvents = (userId: string, petId: string): ScheduleEvents => {
    let petsMap = scheduleByUserPet.get(userId);
    if (!petsMap) {
      petsMap = new Map();
      scheduleByUserPet.set(userId, petsMap);
    }
    let ev = petsMap.get(petId);
    if (!ev) {
      ev = { appts: [], dischs: [] };
      petsMap.set(petId, ev);
    }
    return ev;
  };

  for (const r of apptToday) {
    ensurePetEvents(r.user_id, r.pet_id).appts.push({ id: r.id, title: r.title });
  }
  for (const r of dischargeToday) {
    ensurePetEvents(r.user_id, r.pet_id).dischs.push({ id: r.id, title: r.title });
  }

  // 예방 펫별 그룹화: Map<userId, Map<petId, {category, name, dday}[]>>
  // 라벨은 발송 시점에 유저 locale 로 resolve (buildPreventiveMessage).
  const preventiveByUserPet = new Map<string, Map<string, Array<{ category: string; name: string | null; dday: number }>>>();
  for (const p of preventiveDue) {
    let petsMap = preventiveByUserPet.get(p.user_id);
    if (!petsMap) { petsMap = new Map(); preventiveByUserPet.set(p.user_id, petsMap); }
    const arr = petsMap.get(p.pet_id) || [];
    arr.push({ category: p.category, name: p.name, dday: p.dday });
    petsMap.set(p.pet_id, arr);
  }

  // paid user 프리페치 — N+1 쿼리 제거.
  // 투약/예약·퇴원/결제 대상 user_id 를 전부 모아 profiles 한 번에 조회.
  const allTargetUserIds = new Set<string>([
    ...medByUserPet.keys(),
    ...scheduleByUserPet.keys(),
    ...preventiveByUserPet.keys(),
    ...expiringSoon.map((r) => r.user_id),
  ]);

  // 트라이얼 중엔 전체 유저를 plus 로 취급 (getEffectivePlan 과 동일 규칙).
  // 트라이얼 종료 후엔 실제 plan 이 'plus' 인 유저만.
  const paidSet = new Set<string>();
  // 유저별 알림 언어 — profiles.preferred_language ('en'/'ko'/null). 기본 ko.
  const langByUser = new Map<string, Lang>();
  if (allTargetUserIds.size > 0) {
    const ids = Array.from(allTargetUserIds);
    if (isTrialActive()) {
      for (const uid of ids) paidSet.add(uid);
    } else {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, plan')
        .in('id', ids);
      for (const p of profiles || []) {
        if (p.plan && p.plan !== 'free') paidSet.add(p.id);
      }
    }
    // 언어는 별도 조회 — preferred_language 컬럼이 (prod 마이그레이션 전이라) 없더라도
    // error 만 받고 graceful 하게 전부 ko 로 fallback (알림 자체는 정상 발송).
    const { data: langs, error: langErr } = await supabaseAdmin
      .from('profiles')
      .select('id, preferred_language')
      .in('id', ids);
    if (!langErr) {
      for (const p of langs || []) {
        if ((p as { preferred_language?: string | null }).preferred_language === 'en') langByUser.set(p.id, 'en');
      }
    }
  }
  const userLang = (uid: string): Lang => langByUser.get(uid) ?? 'ko';

  // 펫 정보 일괄 프리페치 — 메시지에 펫 이름 사용.
  // 매칭된 모든 pet_id 모음 (투약 + 예약·퇴원 양쪽).
  const allPetIds = new Set<string>();
  for (const petsMap of medByUserPet.values()) {
    for (const petId of petsMap.keys()) allPetIds.add(petId);
  }
  for (const petsMap of scheduleByUserPet.values()) {
    for (const petId of petsMap.keys()) allPetIds.add(petId);
  }
  for (const petsMap of preventiveByUserPet.values()) {
    for (const petId of petsMap.keys()) allPetIds.add(petId);
  }

  const petMap = new Map<string, { name: string; type: string }>();
  if (allPetIds.size > 0) {
    const { data: pets } = await supabaseAdmin
      .from('pets')
      .select('id, name, type')
      .in('id', Array.from(allPetIds));
    for (const p of pets || []) {
      petMap.set(p.id, { name: p.name, type: p.type });
    }
  }

  // 발송 작업 큐 구성 — 전부 모아서 동시성 제한으로 한 번에 병렬 발송.
  // tag: 같은 (user, pet, time/date) 조합은 같은 tag → 같은 분 재발송 시 덮어씀.
  //      다른 펫끼리는 다른 tag → 분리 표시.
  type SendTask = {
    userId: string;
    notification: { title: string; body: string; url: string; category?: string; tag: string };
    afterSend?: () => Promise<void>;
  };
  const tasks: SendTask[] = [];

  // 1) 투약 — 펫 단위로 1 알림.
  //    title : "💊 오후 12시 30분 살구의 약" / body : "타이레놀, 비타민 시간이에요"
  //    tag   : med-{userId}-{petId}-{HH:MM}
  //    펫 이름은 시간 표기로 인한 글자 압박 때문에 8자 한도 (그 외엔 12자).
  //    title 에 조사 "의" 를 붙여 "살구의 약" 으로 → "살구 약" 의 의미 모호함
  //    (살구 맛 약 / 살구라는 약) 회피.
  //    body 의 3+ 케이스는 "[첫 약] 외 N-1개" 패턴으로 1/2개 케이스와 통일.
  //    이전 "약 N개 먹을 시간" 은 title 의 "약" 과 중복 + "먹을" 이 약간 어색.
  for (const [userId, petsMap] of medByUserPet) {
    if (!paidSet.has(userId)) continue;
    const lang = userLang(userId);
    const en = lang === 'en';
    const drugFb = en ? 'medication' : '약';
    const timeLabel = formatTimeI18n(parseInt(currentHour, 10), currentMinute, lang);
    for (const [petId, drugs] of petsMap) {
      const pet = petMap.get(petId);
      const petName = truncate(pet?.name, PET_NAME_MAX, en ? 'your pet' : '반려동물');

      let drugText: string;
      if (drugs.length === 1) {
        drugText = truncate(drugs[0], 30, drugFb);
      } else if (drugs.length === 2) {
        drugText = `${truncate(drugs[0], 12, drugFb)}, ${truncate(drugs[1], 12, drugFb)}`;
      } else {
        drugText = en
          ? `${truncate(drugs[0], 15, drugFb)} +${drugs.length - 1} more`
          : `${truncate(drugs[0], 15, drugFb)} 외 ${drugs.length - 1}개`;
      }

      tasks.push({
        userId,
        notification: {
          title: en ? `💊 Time for ${petName}'s meds` : `💊 ${petName} 약 먹을 시간이에요`,
          body: `${drugText} · ${timeLabel}`,
          url: '/',
          category: 'medication',
          tag: `med-${userId}-${petId}-${currentTime}`,
        },
      });
    }
  }

  // 2) 예약·퇴원 — 펫 단위로 1 알림 (07:00 에만).
  //    같은 record 의 예약+퇴원 → 통합 메시지.
  //    tag: schedule-{userId}-{petId}-{YYYYMMDD}
  for (const [userId, petsMap] of scheduleByUserPet) {
    if (!paidSet.has(userId)) continue;
    const lang = userLang(userId);
    for (const [petId, ev] of petsMap) {
      if (ev.appts.length === 0 && ev.dischs.length === 0) continue;
      const pet = petMap.get(petId);
      const petName = truncate(pet?.name, PET_NAME_MAX, lang === 'en' ? 'your pet' : '반려동물');
      const { title, body, category } = buildScheduleMessage(petName, ev.appts, ev.dischs, lang);
      tasks.push({
        userId,
        notification: {
          title,
          body,
          url: '/records',
          category,
          tag: `schedule-${userId}-${petId}-${todayKST.replace(/-/g, '')}`,
        },
      });
    }
  }

  // 2-b) 예방 — 펫 단위로 1 알림 (07:00 에만). D-0/D-3 대상.
  //      tag: preventive-{userId}-{petId}-{YYYYMMDD}
  for (const [userId, petsMap] of preventiveByUserPet) {
    if (!paidSet.has(userId)) continue;
    const lang = userLang(userId);
    for (const [petId, items] of petsMap) {
      if (items.length === 0) continue;
      const pet = petMap.get(petId);
      const petName = truncate(pet?.name, PET_NAME_MAX, lang === 'en' ? 'your pet' : '반려동물');
      const { title, body } = buildPreventiveMessage(petName, items, lang);
      tasks.push({
        userId,
        notification: {
          title,
          body,
          url: '/records/preventive',
          // 예방 알림은 병원 아이콘(hos.webp) 사용 — sw.js 가 category 로 분기.
          category: 'hospitalization',
          tag: `preventive-${userId}-${petId}-${todayKST.replace(/-/g, '')}`,
        },
      });
    }
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

      let notification: { title: string; body: string; url: string; category: string; tag: string };
      // tag = sub-3day-{sub.id} — 구독 1건당 1개 알림이라 record id 기반.
      const tag = `sub-3day-${sub.id}`;
      const en = userLang(sub.user_id) === 'en';
      // category 'subscription' → sw.js 에서 오른쪽 alarm.webp 아이콘 분기.
      if (sub.status === 'canceled') {
        notification = {
          title: en ? '📢 Plus subscription ending' : '📢 Plus 구독 기간 만료 안내',
          body: en
            ? 'It switches to Free in 3 days. To keep your benefits, please update your subscription settings.'
            : '3일 후 무료 플랜으로 전환됩니다. 혜택 유지를 원하시면 구독 설정을 변경해 주세요.',
          url: '/profile/subscription',
          category: 'subscription',
          tag,
        };
      } else if (sub.billing_type === 'recurring') {
        const price = sub.product_id ? priceMap.get(sub.product_id) : null;
        // 가격 표시 — DB 에서 못 가져오면 일반 안내로 fallback.
        const bodyWithPrice = en
          ? (price ? `Your Plus subscription fee of ₩${price.toLocaleString()} will be charged in 3 days.` : 'Your Plus subscription fee will be charged in 3 days.')
          : (price ? `3일 후 Plus 구독료 ${price.toLocaleString()}원이 자동 결제됩니다.` : '3일 후 Plus 구독료가 자동 결제됩니다.');
        notification = {
          title: en ? '🔄 Upcoming recurring payment' : '🔄 정기 결제 예정 안내',
          body: bodyWithPrice,
          url: '/profile/subscription',
          category: 'subscription',
          tag,
        };
      } else {
        notification = {
          title: en ? '✨ Plus access ending soon' : '✨ Plus 이용 기간 종료 임박',
          body: en
            ? 'Your access expires in 3 days. To keep using the service, please renew your subscription.'
            : '3일 후 이용 기간이 만료됩니다. 서비스 지속을 원하시면 구독을 갱신해 주세요.',
          url: '/profile/subscription',
          category: 'subscription',
          tag,
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

  // 빈 분 (sent=0 && failed=0) 은 noise — activity_logs 에 안 남김.
  // pg_cron 의 cron.job_run_details 에는 모든 실행이 기록되므로
  // "cron 살아있나?" 는 거기서 확인 가능 (admin 진단 카드 cronHealth).
  if (totalSent > 0 || totalFailed > 0) {
    await logActivityServer(null, 'cron.push_notifications', {
      details: { time: currentTime, date: todayKST, sent: totalSent, failed: totalFailed },
    });
  }

  return NextResponse.json({
    time: currentTime,
    date: todayKST,
    sent: totalSent,
    failed: totalFailed,
    taskCount: tasks.length,
  });
}

async function sendPushToUser(
  userId: string,
  notification: { title: string; body: string; url: string; category?: string; tag?: string },
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

  // 네이티브(FCM) 토큰에도 발송 — web-push 결과와 합산.
  const fcm = await sendFcmToUser(supabaseAdmin, userId, notification);
  sent += fcm.sent;
  failed += fcm.failed;

  return { sent, failed };
}
